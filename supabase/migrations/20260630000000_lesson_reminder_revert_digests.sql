-- Reverts the day/week "digest" behavior (one email listing multiple
-- lessons) back to the original model: every offset, no matter how far out
-- (30 min through 1 week before), reminds about exactly one lesson. Per-
-- student opt-in and per-student custom timing (20260629) are unaffected —
-- only the digest-specific tracking columns go away.
--
-- Safe to run whether or not 20260628_lesson_reminder_digests.sql was ever
-- actually applied — every statement is a no-op if its target doesn't exist.

alter table lesson_reminders_sent
  drop constraint if exists lesson_reminders_sent_digest_key;

alter table lesson_reminders_sent
  drop column if exists student_id,
  drop column if exists period_start;

-- lesson_id stays nullable even though every row populates it again now —
-- re-adding NOT NULL buys nothing and risks failing if any null-lesson_id
-- row was already written while digests were live.
