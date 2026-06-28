-- Per-student reminder timing override. A coach picks a coach-wide default
-- set of offsets (coaches.lesson_reminder_offsets), but an individual
-- student can use a different set instead — e.g. everyone gets "1 day
-- before" except one student who only wants "1 hour before".
--
-- null = inherit the coach-wide default (the common case).
-- any array, including an empty one, = use exactly this instead of the
-- default. An empty array is a deliberate "no reminders for this student"
-- while still being opted in (lesson_reminders_enabled stays true) — the UI
-- warns about this rather than treating it as invalid.
alter table coach_students
  add column if not exists lesson_reminder_offsets integer[];

comment on column coach_students.lesson_reminder_offsets is
  'Per-student override of coaches.lesson_reminder_offsets. Null = inherit the coach default. Non-null (including empty array) = use exactly this set instead.';
