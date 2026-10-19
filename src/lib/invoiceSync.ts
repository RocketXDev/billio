import { supabase } from "./supabaseClient";

// Keeps invoices consistent with the lessons on them. Shared by every page
// that edits or deletes lessons (Lessons, Dashboard, Students, AI assistant).
//
// Both functions return the first error instead of throwing or showing UI,
// so each caller reports it its own way; they keep going past a failed
// invoice so one bad row doesn't leave the others stale.

type LessonBilling = { rate?: number | string | null; billing_status?: string | null } | null;

/**
 * An invoice's status follows its lessons: all paid → paid, all billed →
 * billed, any unbilled → unbilled, a billed/paid mix → billed. An invoice
 * with no lessons counts as unbilled.
 */
export function invoiceStatusFromLessons(lessons: LessonBilling[]) {
  if (lessons.length === 0) return "unbilled";
  const statuses = lessons.map((lesson) => lesson?.billing_status || "unbilled");
  if (statuses.every((s) => s === "paid")) return "paid";
  if (statuses.every((s) => s === "billed")) return "billed";
  if (statuses.some((s) => s === "unbilled")) return "unbilled";
  return "billed";
}

/** After a lesson's billing status changes, recompute every invoice it's on. */
export async function syncInvoiceStatusFromLesson(lessonId: string): Promise<unknown | null> {
  const { data: links, error: linkError } = await supabase
    .from("invoice_lessons")
    .select("invoice_id")
    .eq("lesson_id", lessonId);
  if (linkError) return linkError;

  let firstError: unknown | null = null;
  for (const { invoice_id: invoiceId } of links ?? []) {
    const { data: attached, error: lessonsError } = await supabase
      .from("invoice_lessons")
      .select("lessons(id, billing_status)")
      .eq("invoice_id", invoiceId);
    if (lessonsError || !attached) {
      firstError ??= lessonsError;
      continue;
    }

    const lessons = (attached as unknown as { lessons: LessonBilling }[]).map((row) => row.lessons);
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status: invoiceStatusFromLessons(lessons) })
      .eq("id", invoiceId);
    if (updateError) firstError ??= updateError;
  }
  return firstError;
}

/**
 * Call BEFORE deleting a lesson: takes it off its invoices. An invoice left
 * with no lessons is deleted; the rest get a new total and status. Only
 * touches invoices that belong to `coachId`.
 */
export async function cleanupInvoicesAfterLessonDelete(lessonId: string, coachId: string): Promise<unknown | null> {
  const { data: links, error: linkError } = await supabase
    .from("invoice_lessons")
    .select("invoice_id, invoices(coach_id)")
    .eq("lesson_id", lessonId);
  if (linkError) return linkError;

  let firstError: unknown | null = null;
  const owned = ((links ?? []) as unknown as { invoice_id: string; invoices: { coach_id?: string } | null }[])
    .filter((link) => link.invoices?.coach_id === coachId);

  for (const { invoice_id: invoiceId } of owned) {
    const { data: remaining, error: remainingError } = await supabase
      .from("invoice_lessons")
      .select("lesson_id, lessons(id, rate, billing_status)")
      .eq("invoice_id", invoiceId)
      .neq("lesson_id", lessonId);
    if (remainingError) {
      firstError ??= remainingError;
      continue;
    }

    if (!remaining || remaining.length === 0) {
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceId).eq("coach_id", coachId);
      if (error) firstError ??= error;
      continue;
    }

    const lessons = (remaining as unknown as { lessons: LessonBilling }[]).map((row) => row.lessons);
    const total = lessons.reduce((sum, lesson) => sum + Number(lesson?.rate || 0), 0);
    const { error } = await supabase
      .from("invoices")
      .update({ subtotal: total, total, status: invoiceStatusFromLessons(lessons) })
      .eq("id", invoiceId)
      .eq("coach_id", coachId);
    if (error) firstError ??= error;
  }
  return firstError;
}
