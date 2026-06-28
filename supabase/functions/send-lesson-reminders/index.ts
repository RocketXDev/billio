// Supabase Edge Function: send-lesson-reminders
//
// Meant to run on a schedule (every 5 minutes is a sane default — see
// README.md). On each run it:
//   1. Finds coaches with lesson_reminders_enabled = true and at least one
//      student opted in (coach_students.lesson_reminders_enabled = true).
//      Every opted-in student follows the same coach-wide offsets — there's
//      no per-student timing override.
//   2. For each lesson, for each of the coach's offsets, fires a reminder
//      about that ONE specific lesson once "now" has passed (lesson start
//      − offset) but the lesson hasn't started yet. Every offset works this
//      way — 30 minutes or 1 week before, it's always about the one lesson,
//      never a digest of multiple lessons.
//   3. Resolves a recipient: student email, then parent email, then (Pro
//      plans + sms_consent only) student/parent phone over SMS.
//   4. If neither is usable, skips that student and tells the coach why —
//      both as an in-app notification and an email.
//
// All timing is computed in the COACH'S OWN timezone (coaches.invoice_timezone,
// set in Settings — shared with invoice automation rather than asking twice).
//
// Provider integration (Resend for email, Telnyx for SMS) and the
// normalizePhone() helper are copied from send-single-invoice so reminders
// go out through the same accounts/sender identity as invoices already do.
//
// Auth: deployed WITH JWT verification (the Supabase default — no
// --no-verify-jwt), same as send-weekly-invoice-review. The cron job calls
// it with `Authorization: Bearer <service role key>`, which Supabase's
// gateway verifies before this code ever runs.
//
// Idempotency: before sending anything, this inserts a row into
// lesson_reminders_sent keyed on (lesson_id, offset_minutes) — see
// supabase/migrations/20260627000000_lesson_reminders.sql. If two runs
// overlap or the cron fires more often than expected, the second insert
// hits the unique-constraint conflict and that attempt just no-ops.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { DateTime } from "https://esm.sh/luxon@3.4.4";

const FALLBACK_TIMEZONE = "America/Denver";
// Widest offset preset is "1 week before" (10080 min) — look this far ahead
// so a lesson 7 days out is already in view when that offset needs to fire.
const LOOKAHEAD_DAYS = 8;

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Copied from send-single-invoice so a malformed number behaves the same
// way here as it does for invoices.
function normalizePhone(phone: string) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (String(phone).startsWith("+1") && digits.length === 11) return String(phone);

  throw new Error("Invalid phone number.");
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

interface Student {
  student_name: string;
  email: string | null;
  phone_number: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  sms_consent: boolean;
}

interface Lesson {
  id: string;
  lesson_date: string; // YYYY-MM-DD, coach-local wall-clock date
  start_time: string | null; // HH:MM, coach-local wall-clock time
  student_id: string;
  students: Student | null;
}

interface Coach {
  id: string;
  profile_id: string;
  plan: string | null;
  visible_name: string | null;
  invoice_timezone: string | null;
  lesson_reminder_offsets: number[] | null;
}

function zonedLessonStart(lessonDate: string, startTime: string, timeZone: string): DateTime {
  const [year, month, day] = lessonDate.split("-").map(Number);
  const [hour, minute] = startTime.split(":").map(Number);
  return DateTime.fromObject({ year, month, day, hour, minute }, { zone: timeZone });
}

function formatLongDate(dt: DateTime) {
  return dt.toFormat("cccc, LLLL d");
}

function singleLessonEmailHtml(coachName: string, studentName: string, dateLabel: string, timeLabel: string) {
  return `
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light only">

    <div style="margin:0;padding:40px 16px;background:#f5f7fb !important;font-family:Inter,Arial,sans-serif;color:#0F172A !important;color-scheme:light;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff !important;color:#0F172A !important;border-radius:30px;overflow:hidden;border:1px solid #ececf3;">

        <div style="background:linear-gradient(135deg,#5b3df5,#7c6cff);padding:34px 28px;text-align:center;">
          <h1 style="margin:0;color:#F8FAFC !important;font-size:26px;font-weight:800;">
            Lesson Reminder
          </h1>
          <p style="margin:10px 0 0;color:#E0E7FF !important;font-size:15px;">
            From ${coachName}
          </p>
        </div>

        <div style="padding:28px;background:#ffffff !important;color:#0F172A !important;">
          <div style="background:#eef2ff !important;border:1px solid #c7d2fe;border-radius:20px;padding:20px;margin-bottom:8px;text-align:center;color:#0F172A !important;">
            <div style="color:#64748B !important;font-size:14px;">${studentName}'s lesson</div>
            <div style="margin-top:8px;color:#5b3df5 !important;font-size:24px;font-weight:900;">${dateLabel}</div>
            <div style="margin-top:4px;color:#0F172A !important;font-size:20px;font-weight:700;">${timeLabel}</div>
          </div>

          <p style="margin:18px 0 0;color:#64748B !important;font-size:13px;line-height:1.6;text-align:center;">
            Please contact your coach if you need to reschedule.
          </p>
        </div>
      </div>
    </div>
  `;
}

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !resendKey) {
    return jsonResponse({ error: "Server is missing required environment variables." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const resend = new Resend(resendKey);

  const summary = { checked: 0, sent: 0, skipped: 0, errors: [] as string[] };

  const { data: coaches, error: coachesError } = await supabase
    .from("coaches")
    .select("id, profile_id, plan, visible_name, invoice_timezone, lesson_reminder_offsets")
    .eq("lesson_reminders_enabled", true);

  if (coachesError) {
    return jsonResponse({ error: coachesError.message }, 500);
  }

  for (const coach of (coaches ?? []) as Coach[]) {
    const offsets = coach.lesson_reminder_offsets ?? [];
    if (offsets.length === 0) continue;

    const timeZone = coach.invoice_timezone || FALLBACK_TIMEZONE;
    const isPro = coach.plan === "pro";
    const now = DateTime.utc();

    // Reminders are opt-in per student (picked in the Lessons → bell icon
    // settings UI), not blanket-applied to everyone the coach teaches. Every
    // enabled student follows the same coach-wide offsets — there's no
    // per-student timing override.
    const { data: enabledLinks, error: enabledLinksError } = await supabase
      .from("coach_students")
      .select("student_id")
      .eq("coach_id", coach.id)
      .eq("lesson_reminders_enabled", true);

    if (enabledLinksError) {
      summary.errors.push(`coach ${coach.id}: ${enabledLinksError.message}`);
      continue;
    }

    const enabledStudentIds = (enabledLinks ?? []).map((l: { student_id: string }) => l.student_id);
    if (enabledStudentIds.length === 0) continue;

    const windowStart = now.minus({ days: 1 }).toISODate();
    const windowEnd = now.plus({ days: LOOKAHEAD_DAYS }).toISODate();

    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select(
        "id, lesson_date, start_time, student_id, students(student_name, email, phone_number, parent_email, parent_phone, sms_consent)"
      )
      .eq("coach_id", coach.id)
      .in("student_id", enabledStudentIds)
      .gte("lesson_date", windowStart)
      .lte("lesson_date", windowEnd);

    if (lessonsError) {
      summary.errors.push(`coach ${coach.id}: ${lessonsError.message}`);
      continue;
    }

    for (const lesson of (lessons ?? []) as unknown as Lesson[]) {
      if (!lesson.start_time || !lesson.students) continue;

      const lessonStart = zonedLessonStart(lesson.lesson_date, lesson.start_time, timeZone);
      if (!lessonStart.isValid) continue;

      for (const offsetMinutes of offsets) {
        summary.checked++;
        const fireAt = lessonStart.minus({ minutes: offsetMinutes });
        if (now < fireAt || now >= lessonStart) continue;

        try {
          const outcome = await sendSingleLessonReminder(
            supabase,
            resend,
            coach,
            lesson,
            offsetMinutes,
            isPro,
            lessonStart,
            timeZone
          );
          if (outcome === "sent") summary.sent++;
          else if (outcome === "skipped") summary.skipped++;
        } catch (err) {
          summary.errors.push(`lesson ${lesson.id} offset ${offsetMinutes}: ${(err as Error).message}`);
        }
      }
    }
  }

  return jsonResponse(summary);
});

type Outcome = "sent" | "skipped";

function resolveChannel(student: Student, isPro: boolean): {
  channel: "email" | "sms" | "skipped_missing_info" | "skipped_sms_not_available";
  recipientEmail: string | null;
  recipientPhone: string | null;
} {
  const recipientEmail = student.email || student.parent_email || null;
  const rawPhone = student.phone_number || student.parent_phone || null;

  let recipientPhone: string | null = null;
  if (rawPhone) {
    try {
      recipientPhone = normalizePhone(rawPhone);
    } catch {
      // leave recipientPhone null — handled below as "can't text this"
    }
  }

  if (recipientEmail) return { channel: "email", recipientEmail, recipientPhone };
  if (recipientPhone && isPro && student.sms_consent) return { channel: "sms", recipientEmail, recipientPhone };
  if (rawPhone) return { channel: "skipped_sms_not_available", recipientEmail, recipientPhone };
  return { channel: "skipped_missing_info", recipientEmail, recipientPhone };
}

async function sendSingleLessonReminder(
  supabase: ReturnType<typeof createClient>,
  resend: Resend,
  coach: Coach,
  lesson: Lesson,
  offsetMinutes: number,
  isPro: boolean,
  lessonStart: DateTime,
  timeZone: string
): Promise<Outcome> {
  const student = lesson.students!;
  const { channel, recipientEmail, recipientPhone } = resolveChannel(student, isPro);

  // Claim this (lesson, offset) before doing anything else. If a concurrent
  // run already claimed it, this insert hits the unique constraint and
  // throws — that's the expected "someone else already handled this" path.
  const { error: claimError } = await supabase
    .from("lesson_reminders_sent")
    .insert({ lesson_id: lesson.id, offset_minutes: offsetMinutes, channel });

  if (claimError) {
    if (claimError.code === "23505") return "skipped"; // unique violation — already handled
    throw claimError;
  }

  const coachName = coach.visible_name || "your coach";
  const dateLabel = formatLongDate(lessonStart.setZone(timeZone));
  const timeLabel = lessonStart.setZone(timeZone).toFormat("h:mm a");

  if (channel === "email") {
    const result = await resend.emails.send({
      from: "Billio <reminders@mail.mybillioapp.com>",
      to: recipientEmail!,
      subject: `Reminder: ${student.student_name}'s lesson on ${dateLabel}`,
      html: singleLessonEmailHtml(coachName, student.student_name, dateLabel, timeLabel),
    });
    if (result.error) throw new Error(result.error.message || "Reminder email could not be sent.");
    return "sent";
  }

  if (channel === "sms") {
    const message = `Billio: Reminder from ${coachName} — ${student.student_name}'s lesson is on ${dateLabel} at ${timeLabel}. Reply STOP to opt out.`;
    await sendSMS(recipientPhone!, message);
    return "sent";
  }

  await notifyCoachMissingInfo(supabase, resend, coach, student, channel);
  return "skipped";
}

async function notifyCoachMissingInfo(
  supabase: ReturnType<typeof createClient>,
  resend: Resend,
  coach: Coach,
  student: Student,
  reason: "skipped_missing_info" | "skipped_sms_not_available"
) {
  const message =
    reason === "skipped_missing_info"
      ? `Couldn't send a lesson reminder for ${student.student_name} — no email or phone number on file. Add one in Students to fix this.`
      : `Couldn't text a lesson reminder for ${student.student_name} — SMS reminders need Pro, a valid US phone number, and the student's SMS consent checkbox. Email reminders still work if you add an email.`;

  await supabase.from("notifications").insert({
    profile_id: coach.profile_id,
    title: "Lesson reminder skipped",
    message,
    type: "lesson_reminder_issue",
    is_read: false,
  });

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", coach.profile_id)
    .single();

  if (profile?.email) {
    try {
      await resend.emails.send({
        from: "Billio <reminders@mail.mybillioapp.com>",
        to: profile.email,
        subject: "Lesson reminder skipped",
        html: `<p style="font-family:Inter,Arial,sans-serif;color:#0F172A;">${message}</p>`,
      });
    } catch (err) {
      console.log("Coach alert email error:", err);
    }
  }
}
