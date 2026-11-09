import { supabase } from "./supabaseClient";
import { fetchAllRows } from "./fetchAllRows";

// Spreadsheet (CSV) export of a coach's lessons and earnings for a date
// range — opened in Excel, Numbers or Google Sheets.
//
// "Earnings" means the same thing as on the Earnings page: the amount of
// lessons marked paid.

export type ExportLesson = {
  lesson_date: string;
  start_time: string | null;
  duration_minutes: number | null;
  lesson_type: string | null;
  hourly_rate: number | string | null;
  rate: number | string | null;
  billing_status: string | null;
  notes: string | null;
  student_name?: string | null;
  students?: { student_name?: string | null } | null;
  group_lesson_id?: string | null;
  invoice_lessons?: { invoices?: { invoice_number?: string | null } | null }[] | null;
};

export type Term = { singular: string; plural: string };

// ── CSV formatting ──────────────────────────────────────────────────────────

// Quote when needed, and neutralise text that a spreadsheet would run as a
// formula (=, +, -, @, tab, CR at the start), since names and notes are typed
// by people.
export function csvCell(value: unknown, { text = true } = {}): string {
  if (value == null) return "";
  let s = String(value);
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Byte-order mark so Excel opens UTF-8 (accented names) correctly; CRLF line
// endings as Excel expects.
export function toCsv(header: string[], rows: string[][]) {
  return "﻿" + [header.map((h) => csvCell(h)), ...rows].map((r) => r.join(",")).join("\r\n") + "\r\n";
}

const money = (n: number) => n.toFixed(2);
const amount = (v: number | string | null | undefined) => Number(v || 0);
const status = (s: string | null | undefined) => {
  const v = s || "unbilled";
  return v.charAt(0).toUpperCase() + v.slice(1);
};

// ── Builders ────────────────────────────────────────────────────────────────

export function buildLessonsCsv(lessons: ExportLesson[], term: Term, groupTitles: Map<string, string>) {
  const header = [
    "Date", "Start time", "Student", `${term.singular} type`, "Duration (min)",
    "Hourly rate", "Amount", "Status", "Invoice #", "Group class", "Notes",
  ];
  const rows = lessons.map((l) => {
    const invoiceNumbers = (l.invoice_lessons ?? [])
      .map((il) => il.invoices?.invoice_number)
      .filter(Boolean)
      .join("; ");
    return [
      csvCell(l.lesson_date, { text: false }),
      csvCell((l.start_time || "").slice(0, 5), { text: false }),
      csvCell(l.students?.student_name || l.student_name || ""),
      csvCell(l.lesson_type),
      csvCell(l.duration_minutes, { text: false }),
      csvCell(l.hourly_rate == null || l.hourly_rate === "" ? "" : money(amount(l.hourly_rate)), { text: false }),
      csvCell(money(amount(l.rate)), { text: false }),
      csvCell(status(l.billing_status)),
      csvCell(invoiceNumbers),
      csvCell(l.group_lesson_id ? groupTitles.get(l.group_lesson_id) || "Group" : ""),
      csvCell(l.notes),
    ];
  });
  return toCsv(header, rows);
}

function monthsBetween(from: string, to: string) {
  const months: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [endY, endM] = to.slice(0, 7).split("-").map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

export function buildMonthlySummaryCsv(lessons: ExportLesson[], term: Term, from: string, to: string) {
  type Totals = { count: number; total: number; paid: number; billed: number; unbilled: number };
  const empty = (): Totals => ({ count: 0, total: 0, paid: 0, billed: 0, unbilled: 0 });
  const byMonth = new Map(monthsBetween(from, to).map((m) => [m, empty()]));
  const grand = empty();

  for (const l of lessons) {
    const bucket = byMonth.get(l.lesson_date.slice(0, 7));
    if (!bucket) continue;
    const a = amount(l.rate);
    const s = (l.billing_status || "unbilled") as "paid" | "billed" | "unbilled";
    for (const t of [bucket, grand]) {
      t.count++;
      t.total += a;
      if (s === "paid") t.paid += a;
      else if (s === "billed") t.billed += a;
      else t.unbilled += a;
    }
  }

  const header = ["Month", term.plural, "Total amount", "Earned (paid)", "Billed, awaiting payment", "Not billed yet"];
  const line = (label: string, t: Totals) => [
    csvCell(label), csvCell(t.count, { text: false }), csvCell(money(t.total), { text: false }),
    csvCell(money(t.paid), { text: false }), csvCell(money(t.billed), { text: false }),
    csvCell(money(t.unbilled), { text: false }),
  ];
  const rows = [...byMonth.entries()].map(([month, t]) => {
    const [y, m] = month.split("-").map(Number);
    return line(new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }), t);
  });
  rows.push(line("Total", grand));
  return toCsv(header, rows);
}

export type ExportCardPayment = {
  paid_at: string | null;
  amount_cents: number;
  application_fee_cents: number;
  stripe_fee_cents: number | null;
  refunded_cents: number;
  status: string;
  invoice_ids: string[] | null;
  invoices?: { invoice_number?: string | null; students?: { student_name?: string | null } | null } | null;
};

const cents = (n: number) => csvCell((n / 100).toFixed(2), { text: false });

export function buildCardPaymentsCsv(payments: ExportCardPayment[]) {
  const header = ["Date", "Invoice #", "Student", "Paid by parent", "Stripe fee", "Billio fee", "Refunded", "You received", "Status"];
  const rows = payments.map((p) => {
    const extra = (p.invoice_ids?.length ?? 1) - 1;
    const number = p.invoices?.invoice_number ?? "";
    // A refund returns the matching share of Billio's fee; Stripe keeps its own.
    const billioFee = p.amount_cents ? p.application_fee_cents - Math.round(p.application_fee_cents * p.refunded_cents / p.amount_cents) : 0;
    return [
      csvCell(p.paid_at ? new Date(p.paid_at).toLocaleDateString("en-CA") : "", { text: false }),
      csvCell(extra > 0 ? `${number} + ${extra} more` : number),
      csvCell(p.invoices?.students?.student_name ?? ""),
      cents(p.amount_cents),
      p.stripe_fee_cents == null ? "" : cents(p.stripe_fee_cents),
      cents(billioFee),
      cents(p.refunded_cents),
      p.stripe_fee_cents == null ? "" : cents(p.amount_cents - p.refunded_cents - p.stripe_fee_cents - billioFee),
      csvCell(status(p.status === "partially_refunded" ? "partially refunded" : p.status === "succeeded" ? "paid" : p.status)),
    ];
  });
  return toCsv(header, rows);
}

// ── Data + download ─────────────────────────────────────────────────────────

/** Every completed card payment, oldest first. */
export function fetchCardPaymentsForExport(coachId: string, livemode: boolean) {
  return fetchAllRows<ExportCardPayment>((a, b) =>
    supabase
      .from("invoice_payments")
      .select(
        "paid_at, amount_cents, application_fee_cents, stripe_fee_cents, refunded_cents, status, invoice_ids, " +
          "invoices(invoice_number, students(student_name))"
      )
      .eq("coach_id", coachId)
      .eq("livemode", livemode)
      .in("status", ["succeeded", "partially_refunded", "refunded", "disputed"])
      .order("paid_at", { ascending: true })
      .order("id", { ascending: true })
      .range(a, b) as unknown as PromiseLike<{ data: ExportCardPayment[] | null; error: unknown }>
  );
}

/** Every lesson in [from, to], oldest first, plus group class titles. */
export async function fetchLessonsForExport(coachId: string, from: string, to: string) {
  const lessons = await fetchAllRows<ExportLesson>((a, b) =>
    supabase
      .from("lessons")
      .select(
        "id, lesson_date, start_time, duration_minutes, lesson_type, hourly_rate, rate, billing_status, notes, " +
          "student_name, group_lesson_id, students(student_name), invoice_lessons(invoices(invoice_number))"
      )
      .eq("coach_id", coachId)
      .gte("lesson_date", from)
      .lte("lesson_date", to)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true })
      .order("id", { ascending: true })
      .range(a, b) as unknown as PromiseLike<{ data: ExportLesson[] | null; error: unknown }>
  );

  const groupTitles = new Map<string, string>();
  if (lessons.some((l) => l.group_lesson_id)) {
    const { data, error } = await supabase.from("group_lessons").select("id, title").eq("coach_id", coachId);
    if (error) throw error;
    for (const g of data ?? []) if (g.title) groupTitles.set(g.id, g.title);
  }
  return { lessons, groupTitles };
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
