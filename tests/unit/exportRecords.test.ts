// CSV export of lessons and monthly earnings.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLessonsCsv, buildMonthlySummaryCsv, csvCell, toCsv, type ExportLesson } from "../../src/lib/exportRecords.ts";

const term = { singular: "Session", plural: "Sessions" };
const lesson = (date: string, extra: Partial<ExportLesson> = {}): ExportLesson => ({
  lesson_date: date, start_time: "15:00:00", duration_minutes: 60, lesson_type: "Freestyle",
  hourly_rate: 60, rate: 60, billing_status: "paid", notes: null,
  students: { student_name: "Ava Parker" }, group_lesson_id: null, invoice_lessons: [], ...extra,
});

// Minimal CSV reader for assertions (handles quotes and doubled quotes).
function parse(csv: string): string[][] {
  assert.ok(csv.startsWith("﻿"), "starts with a UTF-8 BOM for Excel");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const text = csv.slice(1);
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\r" && text[i + 1] === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; i++; }
    else cell += c;
  }
  return rows;
}

test("csvCell quotes commas, quotes and line breaks", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell("Smith, Jr."), '"Smith, Jr."');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell(null), "");
});

test("text that a spreadsheet would run as a formula is neutralised", () => {
  for (const evil of ["=SUM(A1:A9)", "+1", "-2+3", "@cmd", "\tx"]) {
    assert.ok(csvCell(evil).replace(/^"/, "").startsWith("'"), evil);
  }
  assert.equal(csvCell("-12.50", { text: false }), "-12.50", "numbers are left alone");
});

test("toCsv uses CRLF line endings", () => {
  assert.equal(toCsv(["a", "b"], [["1", "2"]]), "﻿a,b\r\n1,2\r\n");
});

test("lessons CSV: header uses the coach's term and every column is filled correctly", () => {
  const csv = buildLessonsCsv(
    [
      lesson("2026-03-02", {
        notes: 'Worked on "axel", spins',
        invoice_lessons: [{ invoices: { invoice_number: "INV-7" } }, { invoices: { invoice_number: "INV-9" } }],
      }),
      lesson("2026-03-04", {
        students: null, student_name: "Deleted Student", billing_status: null, rate: "45.5", hourly_rate: null,
        group_lesson_id: "g1",
      }),
      lesson("2026-03-05", { group_lesson_id: "g-unknown" }),
    ],
    term,
    new Map([["g1", "Teen Squad"]])
  );
  const [header, first, second, third] = parse(csv);
  assert.deepEqual(header, [
    "Date", "Start time", "Student", "Session type", "Duration (min)", "Hourly rate",
    "Amount", "Status", "Invoice #", "Group class", "Notes",
  ]);
  assert.deepEqual(first, ["2026-03-02", "15:00", "Ava Parker", "Freestyle", "60", "60.00", "60.00", "Paid", "INV-7; INV-9", "", 'Worked on "axel", spins']);
  assert.equal(second[2], "Deleted Student", "falls back to the name kept on the lesson");
  assert.equal(second[5], "", "no hourly rate");
  assert.equal(second[6], "45.50");
  assert.equal(second[7], "Unbilled", "missing status counts as unbilled");
  assert.equal(second[9], "Teen Squad");
  assert.equal(third[9], "Group", "unknown class still marked as a group");
});

test("monthly summary: every month in range, split by status, with a total row", () => {
  const csv = buildMonthlySummaryCsv(
    [
      lesson("2026-01-05", { rate: 100, billing_status: "paid" }),
      lesson("2026-01-20", { rate: 50, billing_status: "billed" }),
      lesson("2026-03-01", { rate: 40, billing_status: "unbilled" }),
      lesson("2026-03-31", { rate: 10, billing_status: null }),
    ],
    term,
    "2026-01-01",
    "2026-03-31"
  );
  const rows = parse(csv);
  assert.deepEqual(rows[0], ["Month", "Sessions", "Total amount", "Earned (paid)", "Billed, awaiting payment", "Not billed yet"]);
  assert.deepEqual(rows[1], ["January 2026", "2", "150.00", "100.00", "50.00", "0.00"]);
  assert.deepEqual(rows[2], ["February 2026", "0", "0.00", "0.00", "0.00", "0.00"], "empty months still listed");
  assert.deepEqual(rows[3], ["March 2026", "2", "50.00", "0.00", "0.00", "50.00"]);
  assert.deepEqual(rows[4], ["Total", "4", "200.00", "100.00", "50.00", "50.00"]);
  assert.equal(rows.length, 5);
});

test("monthly summary spans year boundaries", () => {
  const rows = parse(buildMonthlySummaryCsv([], term, "2025-11-15", "2026-02-10"));
  assert.deepEqual(rows.slice(1, -1).map((r) => r[0]), ["November 2025", "December 2025", "January 2026", "February 2026"]);
});
