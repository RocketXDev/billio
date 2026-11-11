import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { localNow, nextRunDate, onCycle, reviewIsDue, runsOn, type Schedule } from "../../src/lib/invoiceSchedule.ts";

const weeks = (every: number, anchor: string | null, day = 1): Schedule =>
  ({ unit: "week", every, day, dayOfMonth: 1, anchor, time: "15:00" });
const months = (every: number, anchor: string | null, dayOfMonth = 15): Schedule =>
  ({ unit: "month", every, day: 0, dayOfMonth, anchor, time: "15:00" });

// All dates in a range that the schedule runs on.
function runs(schedule: Schedule, from: string, days: number) {
  const out: string[] = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const date = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    if (runsOn(schedule, date)) out.push(date);
  }
  return out;
}

test("plain weekly and monthly ignore the anchor, as before", () => {
  assert.deepEqual(runs(weeks(1, null), "2026-11-01", 21), ["2026-11-02", "2026-11-09", "2026-11-16"]);
  assert.deepEqual(runs(months(1, null), "2026-11-01", 62), ["2026-11-15", "2026-12-15"]);
  assert.equal(onCycle("week", 1, null, 1, 1, "2030-01-07"), true);
});

test("every 6 weeks: first matching weekday on or after the anchor, then every 6th", () => {
  // Anchor Wednesday Nov 11 → first Monday is Nov 16.
  assert.deepEqual(runs(weeks(6, "2026-11-11"), "2026-11-01", 100), ["2026-11-16", "2026-12-28", "2027-02-08"]);
  // Saving on the run day itself counts that day.
  assert.deepEqual(runs(weeks(2, "2026-11-16"), "2026-11-01", 30), ["2026-11-16", "2026-11-30"]);
});

test("every 3 months: from the anchor's month if its day hasn't passed, else the next", () => {
  assert.deepEqual(runs(months(3, "2026-11-10"), "2026-11-01", 300), ["2026-11-15", "2027-02-15", "2027-05-15", "2027-08-15"]);
  assert.deepEqual(runs(months(3, "2026-11-20"), "2026-11-01", 200), ["2026-12-15", "2027-03-15"]);
});

test("months shorter than the chosen day run on their last day", () => {
  assert.deepEqual(runs(months(1, null, 31), "2027-02-01", 28), ["2027-02-28"]);
  assert.deepEqual(runs(months(2, "2027-01-31", 31), "2027-01-01", 100), ["2027-01-31", "2027-03-31"]);
});

test("an every-N schedule with no anchor never runs, rather than too often", () => {
  assert.deepEqual(runs(weeks(6, null), "2026-11-01", 100), []);
  assert.deepEqual(runs(months(2, null), "2026-11-01", 100), []);
});

test("next run skips today once its time has passed", () => {
  const s = weeks(6, "2026-11-16");
  assert.equal(nextRunDate(s, "2026-11-16", "14:59"), "2026-11-16");
  assert.equal(nextRunDate(s, "2026-11-16", "15:00"), "2026-12-28");
  // The 15th has passed this month, so a yearly run starts in December.
  assert.equal(nextRunDate(months(12, "2026-11-16"), "2026-11-16", "16:00"), "2026-12-15");
  assert.equal(nextRunDate(months(12, "2026-11-16"), "2026-12-16", "09:00"), "2027-12-15");
});

test("review reminder: weekly as before, once after each run on a custom schedule", () => {
  assert.equal(reviewIsDue(weeks(1, null), "2026-11-22", "15:05"), true, "plain weekly: every week");
  // Generation every 6 weeks on Monday 3:00 PM, first run Nov 16.
  const gen = weeks(6, "2026-11-11");
  const sundays = ["2026-11-15", "2026-11-22", "2026-11-29", "2026-12-27", "2027-01-03"].filter((d) => reviewIsDue(gen, d, "15:05"));
  assert.deepEqual(sundays, ["2026-11-22", "2027-01-03"], "the Sunday after each run");
  assert.equal(reviewIsDue(gen, "2026-11-16", "15:05"), true, "same day, after the run");
  assert.equal(reviewIsDue(gen, "2026-11-16", "09:00"), false, "same day, before the run");
  assert.equal(reviewIsDue(gen, "2026-11-23", "09:00"), true, "so the next week's reminder covers it");
  assert.equal(reviewIsDue(gen, "2026-11-23", "15:05"), false, "but only once");
  // Every 3 months on the 15th: Nov 15 is itself a Sunday, so that day's 3:05 PM reminder covers it.
  assert.deepEqual(["2026-11-15", "2026-11-22", "2026-11-29", "2026-12-20", "2027-02-21"].filter((d) => reviewIsDue(months(3, "2026-11-10"), d, "15:05")),
    ["2026-11-15", "2027-02-21"]);
});

test("the coach's local date, not the server's", () => {
  const at = new Date("2026-11-11T05:30:00Z");
  assert.deepEqual(localNow("America/Denver", at), { date: "2026-11-10", time: "22:30" });
  assert.deepEqual(localNow("Europe/London", at), { date: "2026-11-11", time: "05:30" });
});

// supabase/ is gitignored, so this runs only when the functions are present locally.
for (const name of ["generate-invoices", "send-automatic-invoices", "send-weekly-invoice-review"]) {
  const file = new URL(`../../supabase/functions/${name}/index.ts`, import.meta.url);
  test(`${name} carries the same schedule rules as the app`, { skip: !existsSync(file) && "not present locally" }, () => {
    const lib = readFileSync(new URL("../../src/lib/invoiceSchedule.ts", import.meta.url), "utf8");
    const fromLib = lib.slice(lib.indexOf("export type ScheduleUnit"), lib.indexOf("/** The next date the schedule runs")).trim();
    const fn = readFileSync(file, "utf8");
    const copied = fn.slice(fn.indexOf("type ScheduleUnit"), fn.indexOf("// ── END schedule rules ──")).trim();
    assert.equal(copied, fromLib.replace(/^export /gm, ""));
  });
}
