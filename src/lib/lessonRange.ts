import { queryOptions } from "@tanstack/react-query";
import { supabase } from "./supabaseClient";
import { fetchAllRows } from "./fetchAllRows";

// Lessons are loaded by date range instead of a coach's whole history — no
// screen ever shows more than a month grid or a week at once, and the full
// history only grows. Every key stays under the ["lessons", coachId] prefix,
// so the existing invalidateQueries({ queryKey: ["lessons", coachId] }) calls
// after a mutation still refresh every loaded range.

function toDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// "YYYY-MM" month keys.
export function monthOf(dateString: string) {
  return dateString.slice(0, 7);
}

export function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return toDateString(new Date(year, monthNumber - 1 + delta, 1)).slice(0, 7);
}

function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: toDateString(new Date(year, monthNumber, 0)),
  };
}

// Monday–Sunday of the current local week.
export function currentWeekBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { from: toDateString(start), to: toDateString(end) };
}

function fetchLessonsBetween(coachId: string, from: string, to: string) {
  return fetchAllRows((rangeFrom, rangeTo) =>
    supabase
      .from("lessons")
      .select("*, students(student_name)")
      .eq("coach_id", coachId)
      .gte("lesson_date", from)
      .lte("lesson_date", to)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true })
      .order("id", { ascending: true })
      .range(rangeFrom, rangeTo)
  );
}

export function lessonMonthQuery(coachId: string, month: string) {
  const { from, to } = monthBounds(month);
  return queryOptions({
    queryKey: ["lessons", coachId, "month", month],
    queryFn: () => fetchLessonsBetween(coachId, from, to),
  });
}

export function lessonRangeQuery(coachId: string, from: string, to: string) {
  return queryOptions({
    queryKey: ["lessons", coachId, "range", from, to],
    queryFn: () => fetchLessonsBetween(coachId, from, to),
  });
}
