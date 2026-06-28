-- Per-student reminder timing overrides were tried and reverted — every
-- opted-in student now follows the coach-wide coaches.lesson_reminder_offsets
-- only. This drops the now-unused per-student column from
-- 20260629000000_lesson_reminder_student_overrides.sql.
--
-- Safe to run whether or not that migration was ever applied.
alter table coach_students
  drop column if exists lesson_reminder_offsets;
