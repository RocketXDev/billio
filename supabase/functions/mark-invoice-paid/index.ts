// Marks the invoice behind a payment-reminder token as paid (parent clicking
// "I've Paid" from the email/pay page). Combined-invoice support: if the
// anchor invoice belongs to a group (invoice_group_id, stamped by
// send-combined-invoice), the paid status — and the attached lessons'
// billing_status — cascades across every invoice in that group, since a
// combined message was one bill covering multiple students paid together.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.mybillioapp.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { token } = await req.json();
    if (!token) {
      return json({ error: "Missing token." }, 400);
    }

    // ── Look up the token ──────────────────────────────────────────
    const { data: tokenRow, error: tokenError } = await supabase
      .from("payment_reminder_tokens")
      .select("id, invoice_id, expires_at, used")
      .eq("token", token)
      .single();

    if (tokenError || !tokenRow) {
      return json({ error: "Invalid or expired link." }, 404);
    }

    // ── Load the invoice ───────────────────────────────────────────
    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, status, invoice_group_id, students(student_name)")
      .eq("id", tokenRow.invoice_id)
      .single();

    if (!invoice) {
      return json({ error: "Invoice not found." }, 404);
    }

    // Already paid — return success so a second click isn't an error.
    if (invoice.status === "paid" || tokenRow.used) {
      return json({ success: true, already_paid: true, invoice });
    }

    // Expired token.
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return json({ error: "This link has expired. Please open the Billio app." }, 400);
    }

    // ── Resolve the full group (or just this invoice, if ungrouped) ──
    let targetIds = [invoice.id];
    let group: { id: string; invoice_number: string; total: number; student_name: string }[] | null = null;

    if (invoice.invoice_group_id) {
      const { data: siblings } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, students(student_name)")
        .eq("invoice_group_id", invoice.invoice_group_id);

      if (siblings && siblings.length > 0) {
        targetIds = siblings.map((s: any) => s.id);
        group = siblings.map((s: any) => ({
          id: s.id,
          invoice_number: s.invoice_number,
          total: Number(s.total || 0),
          student_name: (Array.isArray(s.students) ? s.students[0] : s.students)?.student_name || "Student",
        }));
      }
    }

    // ── Mark invoice(s) paid ──────────────────────────────────────
    await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_via: "email_button",
      })
      .in("id", targetIds);

    // Burn the token so the link can't be replayed.
    await supabase
      .from("payment_reminder_tokens")
      .update({ used: true })
      .eq("id", tokenRow.id);

    // Mark attached lessons paid too, across every invoice in the group.
    const { data: invoiceLessons } = await supabase
      .from("invoice_lessons")
      .select("lesson_id")
      .in("invoice_id", targetIds);

    const lessonIds = (invoiceLessons || [])
      .map((item: any) => item.lesson_id)
      .filter(Boolean);

    if (lessonIds.length > 0) {
      await supabase
        .from("lessons")
        .update({ billing_status: "paid" })
        .in("id", lessonIds);
    }

    const grandTotal = group ? group.reduce((sum, g) => sum + g.total, 0) : null;

    return json({ success: true, already_paid: false, invoice, group, grandTotal });

  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
});
