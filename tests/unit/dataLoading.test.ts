// Batch loading past Supabase's row cap and date-range lesson loading.
import { test } from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/query-core";
import { fetchAllRows } from "../../src/lib/fetchAllRows.ts";
import {
  currentWeekBounds, lessonMonthQuery, lessonRangeQuery, monthOf, shiftMonth,
} from "../../src/lib/lessonRange.ts";
import { fakeDb, supabase } from "./fakeSupabaseClient.ts";

const pad = (n: number) => String(n).padStart(2, "0");
const ds = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function makeLessons(n: number, start = "2025-01-01") {
  const base = new Date(`${start}T00:00:00`);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + Math.floor(i / 3));
    return { id: `l-${String(i).padStart(5, "0")}`, coach_id: "c1", lesson_date: ds(d), start_time: ["09:00", "09:00", "15:30"][i % 3] };
  });
}
const sortKey = (r: any) => `${r.lesson_date}|${r.start_time}|${r.id}`;
const pageAll = () => fetchAllRows((a, b) =>
  supabase.from("lessons").select("*").eq("coach_id", "c1")
    .order("lesson_date", { ascending: true }).order("start_time", { ascending: true })
    .order("id", { ascending: true }).range(a, b));

// ── fetchAllRows ────────────────────────────────────────────────────────────
for (const cap of [1000, 170, 5000]) {
  for (const n of [0, 1, 169, 170, 999, 1000, 1001, 1579, 2537]) {
    test(`fetchAllRows returns all ${n} rows exactly once, in order, with Max rows = ${cap}`, async () => {
      fakeDb.rows = makeLessons(n); fakeDb.cap = cap; fakeDb.calls = []; fakeDb.failOnCall = null;
      const rows = await pageAll();
      assert.equal(rows.length, n);
      assert.equal(new Set(rows.map((r: any) => r.id)).size, n, "no duplicates");
      assert.deepEqual(rows.map(sortKey), fakeDb.rows.map(sortKey).sort());
      assert.equal(fakeDb.calls.length, Math.ceil(n / Math.min(cap, 1000)) + 1, "one request per batch + a final empty one");
    });
  }
}

test("fetchAllRows throws on a failed batch instead of returning a partial list", async () => {
  fakeDb.rows = makeLessons(2500); fakeDb.cap = 1000; fakeDb.calls = []; fakeDb.failOnCall = 2;
  try {
    await assert.rejects(pageAll(), (err: any) => err.message === "boom");
    assert.equal(fakeDb.calls.length, 2);
  } finally {
    fakeDb.failOnCall = null;
  }
});

// ── Month / week ranges ─────────────────────────────────────────────────────
test("month helpers handle year boundaries and month lengths", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-11", 2), "2027-01");
  assert.equal(monthOf("2026-10-07"), "2026-10");
});

test("month query loads exactly that month for that coach, edges inclusive", async () => {
  fakeDb.rows = [
    ...["2026-01-31", "2026-02-01", "2026-02-14", "2026-02-28", "2026-03-01"].map((d, i) =>
      ({ id: `b${i}`, coach_id: "c1", lesson_date: d, start_time: "10:00" })),
    { id: "other-coach", coach_id: "c2", lesson_date: "2026-02-10", start_time: "10:00" },
  ];
  fakeDb.cap = 1000; fakeDb.calls = [];
  const q = lessonMonthQuery("c1", "2026-02");
  assert.deepEqual(q.queryKey, ["lessons", "c1", "month", "2026-02"]);
  const rows: any[] = await (q.queryFn as any)();
  assert.deepEqual(rows.map((r) => r.lesson_date), ["2026-02-01", "2026-02-14", "2026-02-28"]);
  assert.equal(fakeDb.calls[0].select, "*, students(student_name)");
});

test("leap-year February ends on the 29th", async () => {
  fakeDb.rows = [{ id: "l", coach_id: "c1", lesson_date: "2028-02-29", start_time: "10:00" }];
  const rows: any[] = await (lessonMonthQuery("c1", "2028-02").queryFn as any)();
  assert.equal(rows.length, 1);
});

test("range query (Dashboard week) is inclusive Mon–Sun", async () => {
  fakeDb.rows = ["2026-10-04", "2026-10-05", "2026-10-11", "2026-10-12"].map((d, i) =>
    ({ id: `w${i}`, coach_id: "c1", lesson_date: d, start_time: "10:00" }));
  const q = lessonRangeQuery("c1", "2026-10-05", "2026-10-11");
  assert.deepEqual(q.queryKey, ["lessons", "c1", "range", "2026-10-05", "2026-10-11"]);
  const rows: any[] = await (q.queryFn as any)();
  assert.deepEqual(rows.map((r) => r.lesson_date), ["2026-10-05", "2026-10-11"]);
});

test("currentWeekBounds is the Monday–Sunday containing today, for every day 2025–2028", () => {
  const RealDate = Date;
  try {
    for (let t = new RealDate(2025, 0, 1); t.getFullYear() < 2029; t.setDate(t.getDate() + 1)) {
      const fixed = new RealDate(t);
      fixed.setHours(23, 30);
      (globalThis as any).Date = class extends RealDate {
        constructor(...a: any[]) { super(...(a.length ? a : [fixed.getTime()]) as []); }
      };
      const { from, to } = currentWeekBounds();
      const today = ds(fixed);
      const f = new RealDate(`${from}T00:00:00`), e = new RealDate(`${to}T00:00:00`);
      assert.equal(f.getDay(), 1, `${today}: starts Monday`);
      assert.equal(e.getDay(), 0, `${today}: ends Sunday`);
      assert.ok(from <= today && today <= to, `${today} inside ${from}..${to}`);
    }
  } finally {
    (globalThis as any).Date = RealDate;
  }
});

// Same 42-cell grid as getCalendarMonthDays() in Lessons.tsx.
function gridDates(selected: string) {
  const s = new Date(`${selected}T00:00:00`);
  const first = new Date(s.getFullYear(), s.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return ds(d); });
}
const windowFor = (m: string) => [shiftMonth(m, -1), m, shiftMonth(m, 1)];

test("loaded months cover every cell of the month grid, for every date 2025–2030", () => {
  for (let d = new Date(2025, 0, 1); d.getFullYear() < 2031; d.setDate(d.getDate() + 1)) {
    const selected = ds(d);
    const months = windowFor(monthOf(selected));
    for (const cell of gridDates(selected)) assert.ok(months.includes(monthOf(cell)), `${selected}: ${cell} not loaded`);
  }
});

test("moving one month either way only needs months already loaded or prefetched", () => {
  for (let m = "2025-01"; m < "2031-01"; m = shiftMonth(m, 1)) {
    const have = new Set([...windowFor(m), shiftMonth(m, -2), shiftMonth(m, 2)]);
    for (const next of [shiftMonth(m, -1), shiftMonth(m, 1)])
      for (const need of windowFor(next)) assert.ok(have.has(need), `${m} -> ${next}: ${need}`);
  }
});

test('invalidateQueries({ queryKey: ["lessons", coachId] }) reaches every lesson range for that coach only', async () => {
  const qc = new QueryClient();
  const keys = [
    ["lessons", "c1", "month", "2026-10"], ["lessons", "c1", "range", "2026-10-05", "2026-10-11"],
    ["lessons", "c2", "month", "2026-10"], ["invoices", "c1"],
  ];
  for (const k of keys) qc.setQueryData(k, []);
  await qc.invalidateQueries({ queryKey: ["lessons", "c1"] });
  const invalid = keys.map((k) => qc.getQueryState(k)!.isInvalidated);
  assert.deepEqual(invalid, [true, true, false, false]);
});

test('invalidating ["invoices", coachId] also refreshes the Dashboard\'s own invoice cache', async () => {
  const qc = new QueryClient();
  qc.setQueryData(["invoices", "c1"], []);
  qc.setQueryData(["invoices", "c1", "dashboard"], []);
  await qc.invalidateQueries({ queryKey: ["invoices", "c1"] });
  assert.equal(qc.getQueryState(["invoices", "c1", "dashboard"])!.isInvalidated, true);
});
