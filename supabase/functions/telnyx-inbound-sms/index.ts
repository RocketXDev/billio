// Supabase Edge Function: telnyx-inbound-sms
// Receives inbound SMS webhooks from Telnyx. When a student (or parent)
// replies "PAID" or "PAID INV-0042", finds the matching invoice and marks
// it as paid, then sends a confirmation text.
//
// Matching logic:
//   1. "PAID INV-0042" → look up by invoice number, verify the sender's
//      phone belongs to that invoice (recipient, student, or parent phone)
//   2. Plain "PAID" → find open invoices where the sender's phone matches
//      the invoice recipient, the student's phone, or the parent's phone.
//      Exactly one match → mark it paid. Multiple (e.g. the same phone is
//      used with two different coaches) → send a numbered list of
//      "Coach Name — invoice (amount)" and remember it in
//      sms_pending_selections so a bare "1"/"2" reply can resolve it.
//   3. A bare number reply ("1", "2", ...) → look up the pending selection
//      for that phone and resolve it to the matching invoice.
//
// Combined-invoice support: invoices sent together by send-combined-invoice
// share an invoice_group_id. Everywhere this function would otherwise treat
// sibling invoices as separate options/targets, it now collapses them into
// ONE option (groupIntoOptions/describeOption) and, once an invoice is
// resolved by any path, expands it back out to its full group
// (resolveGroupMembers) before marking paid — so a parent replying PAID to
// a combined text pays every student in that group together, and never sees
// their own combined invoice presented as multiple numbered choices.
//
// Setup required:
// 1. Deploy with: supabase functions deploy telnyx-inbound-sms --no-verify-jwt
// 2. In the Telnyx portal: Messaging → edit your Messaging Profile →
//    Inbound tab → Webhook URL:
//    https://<your-project-ref>.supabase.co/functions/v1/telnyx-inbound-sms
// 3. Add columns/tables if you haven't yet:
//    alter table invoices add column if not exists paid_at timestamptz;
//    alter table invoices add column if not exists paid_via text;
//    alter table invoices add column if not exists invoice_group_id uuid;
//    create table if not exists sms_pending_selections (
//      phone text primary key,
//      invoice_ids uuid[] not null,
//      expires_at timestamptz not null,
//      created_at timestamptz not null default now()
//    );

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SELECTION_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function sendSMS(to: string, message: string) {
  const apiKey = Deno.env.get("TELNYX_API_KEY");
  const fromNumber = Deno.env.get("TELNYX_PHONE_NUMBER");
  if (!apiKey || !fromNumber) return;

  await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromNumber, to, text: message }),
  });
}

// Strip everything except digits so "+1 (719) 555-0123", "17195550123",
// and "+17195550123" all compare equal on their last 10 digits.
function phoneDigits(phone: string) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

// True if the sender's phone matches the invoice recipient phone,
// the student's own phone, or the parent's phone.
function phoneBelongsToInvoice(invoice: any, fromPhone: string) {
  const from = phoneDigits(fromPhone);
  if (!from) return false;

  const student = Array.isArray(invoice.students)
    ? invoice.students[0]
    : invoice.students;

  const knownPhones = [
    invoice.recipient_phone,
    student?.phone_number,
    student?.parent_phone,
  ]
    .map(phoneDigits)
    .filter(Boolean);

  return knownPhones.includes(from);
}

function getCoachName(invoice: any) {
  const coach = Array.isArray(invoice.coaches) ? invoice.coaches[0] : invoice.coaches;
  return coach?.visible_name || "Your coach";
}

function studentNameOf(invoice: any) {
  const student = Array.isArray(invoice.students) ? invoice.students[0] : invoice.students;
  return student?.student_name || "Student";
}

function describeInvoice(invoice: any) {
  return `${getCoachName(invoice)} — ${invoice.invoice_number} ($${Number(invoice.total || 0).toFixed(2)})`;
}

// Collapses a list of invoices into "options" — one per distinct
// invoice_group_id, or one per ungrouped invoice — so a combined invoice's
// siblings are presented (and later resolved) as a single choice.
type Option = { representative: any; members: any[] };

function groupIntoOptions(invoices: any[]): Option[] {
  const seenGroups = new Set<string>();
  const options: Option[] = [];
  for (const inv of invoices) {
    if (inv.invoice_group_id) {
      if (seenGroups.has(inv.invoice_group_id)) continue;
      seenGroups.add(inv.invoice_group_id);
      options.push({
        representative: inv,
        members: invoices.filter((i) => i.invoice_group_id === inv.invoice_group_id),
      });
    } else {
      options.push({ representative: inv, members: [inv] });
    }
  }
  return options;
}

function describeOption(opt: Option) {
  if (opt.members.length === 1) return describeInvoice(opt.representative);
  const coachName = getCoachName(opt.representative);
  const grandTotal = opt.members.reduce((s, m) => s + Number(m.total || 0), 0);
  const names = opt.members.map((m) => studentNameOf(m)).join(", ");
  return `${coachName} — ${names} ($${grandTotal.toFixed(2)} total)`;
}

// Given an anchor invoice (however it was resolved — direct match,
// invoice-number match, or numbered selection), expands it to every invoice
// sharing its invoice_group_id, or just itself if it isn't grouped.
async function resolveGroupMembers(supabase: any, anchorInvoice: any) {
  if (!anchorInvoice.invoice_group_id) return [anchorInvoice];
  const { data } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("invoice_group_id", anchorInvoice.invoice_group_id);
  return data && data.length > 0 ? data : [anchorInvoice];
}

const INVOICE_SELECT = `
  id,
  invoice_number,
  total,
  recipient_phone,
  status,
  sent_at,
  invoice_group_id,
  students (
    student_name,
    phone_number,
    parent_phone
  ),
  coaches (
    visible_name
  )
`;

serve(async (req) => {
  // Telnyx expects a 2xx quickly, otherwise it retries the webhook.
  // So we always return 200 even when we choose to do nothing.
  try {
    const body = await req.json();

    const eventType = body?.data?.event_type;
    if (eventType !== "message.received") {
      return new Response("ok", { status: 200 });
    }

    const payload = body?.data?.payload;
    const fromPhone: string = payload?.from?.phone_number || "";
    const text: string = (payload?.text || "").trim();

    if (!fromPhone || !text) {
      return new Response("ok", { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response("ok", { status: 200 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const phoneKey = phoneDigits(fromPhone);

    // Must start with PAID (case-insensitive). Anything after it is
    // treated as the invoice number, e.g. "PAID INV-0042".
    const paidMatch = text.match(/^\s*paid\b\s*(.*)$/i);
    // A bare numeric reply ("1", "2") answering a pending disambiguation.
    const bareNumberMatch = !paidMatch && text.match(/^\s*(\d{1,2})\s*$/);

    if (!paidMatch && !bareNumberMatch) {
      return new Response("ok", { status: 200 });
    }

    let invoice: any = null;

    if (bareNumberMatch) {
      // ── 0. Resolve a numbered reply against a pending selection ────
      const { data: pending } = await supabase
        .from("sms_pending_selections")
        .select("invoice_ids, expires_at")
        .eq("phone", phoneKey)
        .maybeSingle();

      const selectedIndex = parseInt(bareNumberMatch[1], 10);
      const valid =
        pending &&
        new Date(pending.expires_at) > new Date() &&
        selectedIndex >= 1 &&
        selectedIndex <= pending.invoice_ids.length;

      if (!valid) {
        await sendSMS(
          fromPhone,
          "Billio: That selection isn't valid anymore. Reply PAID to see your open invoices again.",
        );
        return new Response("ok", { status: 200 });
      }

      // invoice_ids stores one representative invoice id per option (a
      // combined invoice's group is represented by any one of its members).
      const invoiceId = pending.invoice_ids[selectedIndex - 1];
      const { data: selected } = await supabase
        .from("invoices")
        .select(INVOICE_SELECT)
        .eq("id", invoiceId)
        .single();

      await supabase.from("sms_pending_selections").delete().eq("phone", phoneKey);

      if (!selected || selected.status === "paid") {
        await sendSMS(
          fromPhone,
          "Billio: That invoice has already been handled. Reply PAID to see your current open invoices.",
        );
        return new Response("ok", { status: 200 });
      }

      invoice = selected;
    } else {
      // Normalize the invoice number from the reply: keep letters/digits only,
      // uppercase. "inv-0042", "INV 0042", "Inv0042." all become "INV0042".
      const repliedInvoiceNumber = (paidMatch![1] || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

      const { data: candidates } = await supabase
        .from("invoices")
        .select(INVOICE_SELECT)
        .neq("status", "paid")
        .order("sent_at", { ascending: false, nullsFirst: false })
        .limit(200);

      const openInvoices = candidates || [];

      if (repliedInvoiceNumber) {
        // ── 1. Look up by invoice number ─────────────────────────────
        // Matches on invoice_number, which is per-invoice, not per-group —
        // a coach texting a specific sibling's invoice number should still
        // pay the whole group they belong to (handled below via
        // resolveGroupMembers once `invoice` is set).
        invoice = openInvoices.find((inv: any) => {
          const normalized = String(inv.invoice_number || "")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "");
          return normalized && normalized === repliedInvoiceNumber;
        }) || null;

        if (!invoice) {
          await sendSMS(
            fromPhone,
            `Billio: We couldn't find an open invoice matching "${paidMatch![1].trim()}". Please double-check the invoice number, or contact your coach directly.`,
          );
          return new Response("ok", { status: 200 });
        }

        // Safety check: the reply must come from a phone connected to this
        // invoice — the number it was sent to, the student's phone, or the
        // parent's phone. Otherwise anyone guessing an invoice number could
        // mark it paid.
        if (!phoneBelongsToInvoice(invoice, fromPhone)) {
          await sendSMS(
            fromPhone,
            `Billio: This phone number isn't connected to invoice ${invoice.invoice_number}, so we can't mark it as paid. Please contact your coach directly.`,
          );
          return new Response("ok", { status: 200 });
        }
      } else {
        // ── 2. Plain "PAID" → match by the sender's phone number ─────
        // Matches against the invoice's recipient phone, the student's own
        // phone, AND the parent's phone — so either person can reply from
        // their own device regardless of which number the text went to.
        const openForThisPhone = openInvoices.filter((inv: any) =>
          phoneBelongsToInvoice(inv, fromPhone),
        );

        if (openForThisPhone.length === 0) {
          await sendSMS(
            fromPhone,
            "Billio: We couldn't find an open invoice for this number. Please contact your coach directly.",
          );
          return new Response("ok", { status: 200 });
        }

        // Collapse siblings sharing an invoice_group_id into one option, so
        // a combined invoice isn't presented as several numbered choices.
        const options = groupIntoOptions(openForThisPhone);

        if (options.length > 1) {
          // Multiple open options for this phone — most often this means
          // the same phone is shared across two different coaches (or one
          // combined invoice plus an unrelated separate one). Ask which
          // one, leading with the coach's name, and remember the order
          // (one representative invoice id per option) so a bare "1"/"2"
          // reply can resolve it.
          const lines = options
            .map((opt, idx) => `${idx + 1}) ${describeOption(opt)}`)
            .join("\n");

          await supabase.from("sms_pending_selections").upsert({
            phone: phoneKey,
            invoice_ids: options.map((opt) => opt.representative.id),
            expires_at: new Date(Date.now() + SELECTION_TTL_MS).toISOString(),
          });

          await sendSMS(
            fromPhone,
            `Billio: You have ${options.length} open invoices:\n\n${lines}\n\nReply with the number to mark it as paid, e.g. "1".`,
          );
          return new Response("ok", { status: 200 });
        }

        // Exactly one option (a single invoice, or a single combined
        // group) — this is the one they were texted about.
        invoice = options[0].representative;
      }
    }

    // ── Expand to the full group (or just this invoice, if ungrouped) ──
    const members = await resolveGroupMembers(supabase, invoice);
    const memberIds = members.map((m: any) => m.id);

    // ── Mark the invoice(s) as paid ────────────────────────────────
    await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_via: "sms_reply",
      })
      .in("id", memberIds);

    // Mark the attached lessons as paid too, across every member invoice
    const { data: invoiceLessons } = await supabase
      .from("invoice_lessons")
      .select("lesson_id")
      .in("invoice_id", memberIds);

    const lessonIds = (invoiceLessons || [])
      .map((item: any) => item.lesson_id)
      .filter(Boolean);

    if (lessonIds.length > 0) {
      await supabase
        .from("lessons")
        .update({ billing_status: "paid" })
        .in("id", lessonIds);
    }

    // Clean up any stale pending selection for this phone now that one
    // of its invoices has been resolved.
    await supabase.from("sms_pending_selections").delete().eq("phone", phoneKey);

    const confirmationText = members.length === 1
      ? `Billio: Thanks! Invoice ${invoice.invoice_number || ""} ($${Number(invoice.total || 0).toFixed(2)}) has been marked as paid. Your coach has been notified.`
      : (() => {
          const grandTotal = members.reduce((s: number, m: any) => s + Number(m.total || 0), 0);
          const lines = members.map((m: any) => `${studentNameOf(m)}: $${Number(m.total || 0).toFixed(2)}`).join(", ");
          return `Billio: Thanks! ${lines} — Total $${grandTotal.toFixed(2)} marked as paid. Your coach has been notified.`;
        })();

    await sendSMS(fromPhone, confirmationText);

    return new Response("ok", { status: 200 });
  } catch (_err) {
    // Still return 200 so Telnyx doesn't endlessly retry
    return new Response("ok", { status: 200 });
  }
});
