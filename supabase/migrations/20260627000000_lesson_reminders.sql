-- Lesson reminders: off by default, configurable per coach (master switch +
-- which offsets before a lesson to fire at), and opt-in per student rather
-- than blanket-applied to everyone the coach teaches. Reuses
-- `invoice_timezone` for wall-clock timing rather than adding a second
-- timezone column, since coaches already set that once for invoice
-- automation (now centralized in Settings).

alter table coaches
  add column if not exists lesson_reminders_enabled boolean not null default false,
  add column if not exists lesson_reminder_offsets integer[] not null default '{}'::integer[];

comment on column coaches.lesson_reminders_enabled is
  'Master switch for automated lesson reminders. Off by default.';
comment on column coaches.lesson_reminder_offsets is
  'Minutes-before-lesson values to fire a reminder at, e.g. {60,1440} = 1 hour and 1 day before. Empty array = no reminders even if enabled.';

-- Reminders are opt-in per student, not blanket-applied to everyone the
-- coach teaches — a coach picks specific students in the reminder settings
-- UI, same idea as picking which lessons go on an invoice.
alter table coach_students
  add column if not exists lesson_reminders_enabled boolean not null default false;

comment on column coach_students.lesson_reminders_enabled is
  'Whether this specific student receives automated lesson reminders. Off by default even when the coach has reminders enabled overall.';

-- Tracks which (lesson, offset) reminders have already fired, so the
-- scheduled function can run as often as it wants (e.g. every 5 minutes)
-- without double-sending — it inserts a row here before sending, and the
-- unique constraint makes that insert the idempotency guard.
create table if not exists lesson_reminders_sent (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references lessons(id) on delete cascade,
  offset_minutes integer not null,
  channel text not null check (channel in ('email', 'sms', 'skipped_missing_info', 'skipped_sms_not_available')),
  sent_at timestamptz not null default now(),
  unique (lesson_id, offset_minutes)
);

alter table lesson_reminders_sent enable row level security;

-- No permissive policies: this table is written/read only by the
-- send-lesson-reminders Edge Function using the service role key, which
-- bypasses RLS entirely. Add a coach-scoped SELECT policy later if you want
-- to surface a "reminders sent" log in the UI.
