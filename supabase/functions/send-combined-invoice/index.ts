// Sends ONE SMS/email covering multiple students' invoices to their shared
// parent contact (e.g. siblings under the same coach), instead of one
// message per student. Mirrors send-single-invoice's helpers/patterns, but:
//   - always addresses the parent directly (parent_phone/parent_email),
//     since combining only makes sense as a parent-level action — it does
//     not run the per-student invoice_contact_target ("student"/"parent"/
//     "auto") resolution that send-single-invoice does
//   - re-verifies everything server-side rather than trusting the caller's
//     grouping, since this determines who gets billed together
//   - stamps a fresh invoice_group_id across every invoice in the send, so
//     get-payment-reminder-invoice / mark-invoice-paid / telnyx-inbound-sms
//     can cascade paid-status across the whole group later
//
// Combining only strictly requires a shared, non-empty parent PHONE number
// (most students won't have a parent email on file at all, and that's fine —
// email is only used for delivery when one happens to be present). Email is
// checked for a *conflict*, not presence: if two or more DISTINCT non-empty
// parent emails show up across the group, that's ambiguous and rejected;
// zero or one distinct email is fine either way.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const allowedOrigins = [
  "https://mybillioapp.com",
  "https://www.mybillioapp.com",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(req: Request, body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

function normalizePhone(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (String(phone).startsWith("+1") && digits.length === 11) return String(phone);
  throw new Error("Invalid phone number. Please enter a valid 10-digit US phone number.");
}

function phoneDigits(phone: string) {
  return String(phone || "").replace(/\D/g, "").slice(-10);
}

async function sendSMS(to: string, message: string) {
  const apiKey = Deno.env.get("TELNYX_API_KEY");
  const fromNumber = Deno.env.get("TELNYX_PHONE_NUMBER");

  if (!apiKey || !fromNumber) throw new Error("Missing Telnyx configuration.");

  const response = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromNumber, to, text: message }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.errors?.[0]?.detail || "SMS could not be sent.");
  }
  return result;
}

function formatLessonDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-").map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return dateStr;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function studentNameOf(invoice: any) {
  const student = Array.isArray(invoice.students) ? invoice.students[0] : invoice.students;
  return student?.student_name || invoice.student_name || "Student";
}

function lessonsOf(invoice: any) {
  return (invoice.invoice_lessons || [])
    .map((item: any) => (Array.isArray(item.lessons) ? item.lessons[0] : item.lessons))
    .filter(Boolean);
}

function buildStudentSectionHtml(studentName: string, lessons: any[], subtotal: number) {
  const lessonsHtml = lessons
    .map((lesson: any) => `
      <div style="border:1px solid #e2e8f0;border-radius:14px;padding:12px;margin-bottom:8px;background:#f8fafc !important;color:#111827 !important;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <strong style="font-size:14px;color:#111827 !important;">${formatLessonDate(lesson.lesson_date)}</strong>
              <div style="margin-top:4px;font-size:12px;color:#6b7280 !important;">
                ${lesson.start_time?.slice(0, 5) || ""} • ${lesson.duration_minutes || 0} min${lesson.lesson_type ? ` • ${lesson.lesson_type}` : ""}
              </div>
            </td>
            <td align="right">
              <strong style="font-size:16px;font-weight:800;color:#4338ca !important;">
                $${Number(lesson.rate || 0).toFixed(2)}
              </strong>
            </td>
          </tr>
        </table>
      </div>
    `)
    .join("");

  return `
    <div style="margin-bottom:22px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
        <tr>
          <td><strong style="font-size:16px;color:#0F172A !important;">${studentName}</strong></td>
          <td align="right"><strong style="font-size:16px;color:#5b3df5 !important;">$${subtotal.toFixed(2)}</strong></td>
        </tr>
      </table>
      ${lessonsHtml || `<p style="margin:0;color:#64748B !important;font-size:13px;">No lessons attached.</p>`}
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const { invoiceIds } = await req.json();

    if (!Array.isArray(invoiceIds) || invoiceIds.length < 2) {
      return jsonResponse(req, { error: "Combined sending requires at least two invoice ids." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !resendKey) {
      return jsonResponse(req, { error: "Server is missing required environment variables." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const resend = new Resend(resendKey);

    const { data: fetched, error: invoicesError } = await supabase
      .from("invoices")
      .select(`
        id,
        coach_id,
        student_id,
        invoice_number,
        status,
        total,
        student_name,
        students (
          id,
          student_name,
          email,
          phone_number,
          parent_name,
          parent_email,
          parent_phone,
          sms_consent
        ),
        coaches (
          id,
          visible_name
        ),
        invoice_lessons (
          lesson_id,
          lessons (
            id,
            lesson_date,
            start_time,
            duration_minutes,
            lesson_type,
            rate
          )
        )
      `)
      .in("id", invoiceIds);

    if (invoicesError || !fetched || fetched.length !== invoiceIds.length) {
      return jsonResponse(req, { error: "One or more invoices could not be found." }, 404);
    }

    // Preserve the caller's order — invoiceIds[0] is the invoice the coach
    // actually clicked "Send" on, and stays the "primary" for delivery-method
    // resolution and the payment-reminder token below.
    const group = invoiceIds.map((id: string) => fetched.find((inv: any) => inv.id === id)!);
    const primary = group[0];

    // ── Re-verify everything server-side — never trust the client's grouping ──
    if (group.some((inv: any) => inv.coach_id !== primary.coach_id)) {
      return jsonResponse(req, { error: "These invoices don't all belong to the same coach." }, 400);
    }
    if (group.some((inv: any) => (inv.status || "unbilled") !== "unbilled")) {
      return jsonResponse(req, { error: "One of these invoices has already been sent." }, 400);
    }
    if (group.some((inv: any) => !(Array.isArray(inv.students) ? inv.students[0] : inv.students))) {
      return jsonResponse(req, { error: "Combining requires a live student record for every invoice — one of these students has been deleted." }, 400);
    }

    // Shared parent phone is the ONLY strict requirement, matching "parent
    // phone number is equal and not null or empty".
    let sharedPhoneDigits = "";
    for (const inv of group) {
      const student = Array.isArray(inv.students) ? inv.students[0] : inv.students;
      let normalized: string;
      try {
        normalized = normalizePhone(student.parent_phone);
      } catch {
        return jsonResponse(req, { error: `${studentNameOf(inv)}'s parent phone number is missing or invalid.` }, 400);
      }
      const digits = phoneDigits(normalized);
      if (!sharedPhoneDigits) sharedPhoneDigits = digits;
      else if (digits !== sharedPhoneDigits) {
        return jsonResponse(req, { error: "These students don't share the same parent phone number." }, 400);
      }
    }

    // Parent email is optional — most students won't have one on file. Only
    // reject on a genuine conflict: two or more DISTINCT non-empty emails.
    const nonEmptyEmails = new Set<string>();
    for (const inv of group) {
      const student = Array.isArray(inv.students) ? inv.students[0] : inv.students;
      const email = String(student.parent_email || "").trim().toLowerCase();
      if (email) nonEmptyEmails.add(email);
    }
    if (nonEmptyEmails.size > 1) {
      return jsonResponse(req, { error: "These students don't share the same parent email on file." }, 400);
    }
    const sharedEmail = nonEmptyEmails.size === 1 ? [...nonEmptyEmails][0] : "";

    const primaryStudent = Array.isArray(primary.students) ? primary.students[0] : primary.students;
    const recipientPhone = normalizePhone(primaryStudent.parent_phone);
    const recipientEmail = sharedEmail;

    // ── Delivery method — resolved off the primary invoice's settings ──
    const { data: coachStudent } = await supabase
      .from("coach_students")
      .select("invoice_delivery_method")
      .eq("coach_id", primary.coach_id)
      .eq("student_id", primary.student_id)
      .maybeSingle();

    const savedDeliveryMethod = coachStudent?.invoice_delivery_method || "auto";
    let deliveryMethod = savedDeliveryMethod;

    const allConsent = () => group.every((inv: any) => {
      const student = Array.isArray(inv.students) ? inv.students[0] : inv.students;
      return !!student.sms_consent;
    });

    if (savedDeliveryMethod === "auto") {
      if (recipientEmail) {
        deliveryMethod = "email";
      } else if (allConsent()) {
        deliveryMethod = "text";
      } else {
        return jsonResponse(req, {
          error: "No shared parent email was found for this group, and not every student has SMS consent enabled. Please add a parent email or enable SMS consent, or send these invoices separately.",
        }, 400);
      }
    }

    if ((deliveryMethod === "email" || deliveryMethod === "both") && !recipientEmail) {
      return jsonResponse(req, { error: "No shared parent email was found for this group of students." }, 400);
    }

    if (deliveryMethod === "text" || deliveryMethod === "both") {
      const missingConsent = group.find((inv: any) => {
        const student = Array.isArray(inv.students) ? inv.students[0] : inv.students;
        return !student.sms_consent;
      });
      if (missingConsent) {
        return jsonResponse(req, {
          error: `${studentNameOf(missingConsent)} doesn't have SMS consent enabled, so this combined text can't be sent. Please update that student's profile, or send invoices separately.`,
        }, 400);
      }
    }

    // ── Payment reminder token — anchored to the primary invoice ──
    let payToken: string | null = null;
    try {
      const { data: existingToken } = await supabase
        .from("payment_reminder_tokens")
        .select("token, expires_at, used")
        .eq("invoice_id", primary.id)
        .eq("used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (
        existingToken?.token &&
        (!existingToken.expires_at || new Date(existingToken.expires_at) > new Date())
      ) {
        payToken = existingToken.token;
      } else {
        const tokenExpiresAt = new Date(
          Date.now() + 60 * 24 * 60 * 60 * 1000,
        ).toISOString();

        const { data: tokenRow } = await supabase
          .from("payment_reminder_tokens")
          .insert({
            invoice_id: primary.id,
            expires_at: tokenExpiresAt,
            used: false,
          })
          .select("token")
          .single();

        payToken = tokenRow?.token || null;
      }
    } catch (tokenErr) {
      console.log("Pay token error:", tokenErr);
    }

    const confirmPageBase =
      Deno.env.get("PAY_CONFIRM_URL") || "https://mybillioapp.com/pay";
    const payUrl = payToken
      ? `${confirmPageBase}?token=${encodeURIComponent(payToken)}`
      : "";

    const grandTotal = group.reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0);
    const coachName = (Array.isArray(primary.coaches) ? primary.coaches[0] : primary.coaches)?.visible_name || "Your Coach";

    // ── Build message content ──
    const studentSectionsHtml = group
      .map((inv: any) => buildStudentSectionHtml(studentNameOf(inv), lessonsOf(inv), Number(inv.total || 0)))
      .join("");

    const payButtonHtml = payUrl
      ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;">
              <tr>
                <td align="center">
                  <a href="${payUrl}"
                     style="display:inline-block;background:#5b3df5 !important;color:#ffffff !important;text-decoration:none;font-size:16px;font-weight:800;padding:14px 36px;border-radius:14px;">
                    I've Paid This Invoice
                  </a>
                </td>
              </tr>
            </table>`
      : "";

    const html = `
      <meta name="color-scheme" content="light only">
      <meta name="supported-color-schemes" content="light only">

      <div style="margin:0;padding:40px 16px;background:#f5f7fb !important;font-family:Inter,Arial,sans-serif;color:#0F172A !important;color-scheme:light;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff !important;color:#0F172A !important;border-radius:30px;overflow:hidden;border:1px solid #ececf3;">

          <div style="background:linear-gradient(135deg,#5b3df5,#7c6cff);padding:34px 28px;text-align:center;">
            <h1 style="margin:0;color:#F8FAFC !important;font-size:30px;font-weight:800;">
              ${coachName}
            </h1>
            <p style="margin:10px 0 0;color:#E0E7FF !important;font-size:15px;">
              Sent you a combined invoice
            </p>
          </div>

          <div style="padding:28px;background:#ffffff !important;color:#0F172A !important;">
            ${studentSectionsHtml}

            <div style="background:#eef2ff !important;border:1px solid #c7d2fe;border-radius:20px;padding:20px;margin-bottom:24px;text-align:center;color:#0F172A !important;">
              <div style="color:#64748B !important;font-size:14px;">Total Due</div>
              <div style="margin-top:8px;color:#5b3df5 !important;font-size:38px;font-weight:900;">
                $${grandTotal.toFixed(2)}
              </div>
            </div>

            ${payButtonHtml}

            <p style="margin:18px 0 0;color:#64748B !important;font-size:13px;line-height:1.6;text-align:center;">
              Please contact your coach if anything looks incorrect.
            </p>
          </div>
        </div>
      </div>
    `;

    const studentLines = group
      .map((inv: any) => `${studentNameOf(inv)}: $${Number(inv.total || 0).toFixed(2)}`)
      .join("\n");

    const smsMessage = `Billio: You have a new combined invoice from ${coachName}.

Students:
${studentLines}

Total Due: $${grandTotal.toFixed(2)}

Reply PAID once you've paid to mark these invoices as paid.
Reply STOP to opt out.`;

    if (deliveryMethod === "email" || deliveryMethod === "both") {
      const resendResult = await resend.emails.send({
        from: "Billio <notifications@mail.mybillioapp.com>",
        to: recipientEmail,
        subject: `Invoice from ${coachName}`,
        html,
      });

      if (resendResult.error) {
        return jsonResponse(req, {
          error: resendResult.error.message || "Invoice email could not be sent.",
        }, 500);
      }
    }

    if (deliveryMethod === "text" || deliveryMethod === "both") {
      try {
        await sendSMS(recipientPhone, smsMessage);
      } catch (smsError) {
        return jsonResponse(req, {
          error: smsError instanceof Error ? smsError.message : "Invoice text could not be sent.",
        }, 500);
      }
    }

    // ── Update lessons and invoice status across the whole group ──
    const groupId = crypto.randomUUID();
    const lessonIds = group
      .flatMap((inv: any) => (inv.invoice_lessons || []).map((item: any) => item.lesson_id))
      .filter(Boolean);

    if (lessonIds.length > 0) {
      const { error: lessonsUpdateError } = await supabase
        .from("lessons")
        .update({ billing_status: "billed" })
        .in("id", lessonIds);
      if (lessonsUpdateError) {
        console.error("Lessons update error:", lessonsUpdateError);
      }
    }

    const { error: invoiceUpdateError } = await supabase
      .from("invoices")
      .update({
        status: "billed",
        sent_at: new Date().toISOString(),
        delivery_method: deliveryMethod,
        recipient_email: recipientEmail || null,
        recipient_phone: recipientPhone || null,
        invoice_group_id: groupId,
      })
      .in("id", invoiceIds);

    if (invoiceUpdateError) {
      console.error("Invoice update error:", invoiceUpdateError);
      return jsonResponse(req, { error: "Invoices were sent but their status could not be updated." }, 500);
    }

    return jsonResponse(req, {
      success: true,
      recipientEmail,
      recipientPhone,
      deliveryMethod,
      groupId,
    });

  } catch (err) {
    return jsonResponse(req, {
      error: err instanceof Error ? err.message : String(err),
    }, 500);
  }
});
