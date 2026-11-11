// Repeating schedules for automatic invoice generation and sending: weekly on
// a weekday, monthly on a day of the month, or every N weeks / N months.
//
// "Every N" counts from an anchor date (the day the coach saved the
// schedule), so "every 6 weeks on Monday" means the first Monday on or after
// the anchor, then every sixth Monday. The edge functions that run the
// schedules (generate, send, review reminder) carry a copy of everything from
// ScheduleUnit to reviewIsDue — change them together.

export type ScheduleUnit = "week" | "month";

export type Schedule = {
  unit: ScheduleUnit;
  every: number;
  day: number; // 0 = Sunday … 6 = Saturday (weeks)
  dayOfMonth: number; // 1–28 (months)
  anchor: string | null; // YYYY-MM-DD
  time: string; // HH:MM, the coach's local time
};

export const MAX_EVERY = 12;

const DAY_MS = 86_400_000;

function utc(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

/**
 * For a date that already falls on the schedule's weekday or day of month:
 * is it one of the every-Nth runs? Always true for plain weekly/monthly.
 * With no anchor yet, an every-N schedule never runs rather than running
 * too often.
 */
export function onCycle(unit: ScheduleUnit, every: number, anchor: string | null, day: number, dayOfMonth: number, date: string) {
  if (!every || every <= 1) return true;
  if (!anchor) return false;
  const a = new Date(utc(anchor));
  const t = new Date(utc(date));

  if (unit === "week") {
    const first = a.getTime() + ((day - a.getUTCDay() + 7) % 7) * DAY_MS;
    const diff = Math.round((t.getTime() - first) / DAY_MS);
    return diff >= 0 && diff % (7 * every) === 0;
  }

  const anchorRunDay = Math.min(dayOfMonth, daysInMonth(a.getUTCFullYear(), a.getUTCMonth()));
  const firstMonth = a.getUTCFullYear() * 12 + a.getUTCMonth() + (anchorRunDay >= a.getUTCDate() ? 0 : 1);
  const diff = t.getUTCFullYear() * 12 + t.getUTCMonth() - firstMonth;
  return diff >= 0 && diff % every === 0;
}

/** Whether the schedule runs on `date` (YYYY-MM-DD, the coach's local date). */
export function runsOn(schedule: Schedule, date: string) {
  const t = new Date(utc(date));
  const matchesDay = schedule.unit === "week"
    ? t.getUTCDay() === schedule.day
    : t.getUTCDate() === Math.min(schedule.dayOfMonth, daysInMonth(t.getUTCFullYear(), t.getUTCMonth()));
  return matchesDay && onCycle(schedule.unit, schedule.every, schedule.anchor, schedule.day, schedule.dayOfMonth, date);
}

/**
 * The weekly review reminder, when generation runs every N weeks or months:
 * only the first reminder after each run, so a coach on "every 6 weeks" gets
 * one, not six. Counts a run from its time, so a reminder earlier in the day
 * than that day's run waits for the next review day.
 */
export function reviewIsDue(generation: Schedule, today: string, reviewTime: string) {
  if (!generation.every || generation.every <= 1) return true;
  const start = utc(today);
  const genTime = generation.time.slice(0, 5);
  for (let back = 0; back <= 7; back++) {
    const date = new Date(start - back * DAY_MS).toISOString().slice(0, 10);
    if (!runsOn(generation, date)) continue;
    if (back === 0 && genTime > reviewTime) continue;
    if (back === 7 && genTime <= reviewTime) continue;
    return true;
  }
  return false;
}

/** The next date the schedule runs, from `today` at `now` (HH:MM), or null. */
export function nextRunDate(schedule: Schedule, today: string, now: string) {
  const start = utc(today);
  // Long enough to reach a run 12 months out.
  for (let i = 0; i <= 400; i++) {
    const date = new Date(start + i * DAY_MS).toISOString().slice(0, 10);
    if (i === 0 && schedule.time.slice(0, 5) <= now) continue;
    if (runsOn(schedule, date)) return date;
  }
  return null;
}

/** Today's date and time where the coach is. */
export function localNow(timeZone: string, at = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** "Monday, December 1" */
export function formatRunDate(date: string) {
  return new Date(utc(date)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}
