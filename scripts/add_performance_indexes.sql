-- Indexes for foreign/lookup columns filtered via .eq() throughout src/pages and src/hooks.
-- Postgres does not auto-index foreign keys, so these columns were getting sequential
-- scans on every query, growing worse (more disk I/O + CPU) as tables grow.
-- Safe to run any time: CREATE INDEX IF NOT EXISTS is a no-op if the index already exists.

-- Fires on every authenticated page load via useCoachIdentity()
create index if not exists idx_profiles_user_id on public.profiles (user_id);
create index if not exists idx_coaches_profile_id on public.coaches (profile_id);

-- lessons: filtered by coach_id (Dashboard/Earnings/Invoices/Lessons/Students/AiAssistant),
-- student_id (Invoices/Students/AiAssistant), group_lesson_id (GroupLessons),
-- recurring_series_id (RecurringLessons/Lessons)
create index if not exists idx_lessons_coach_id on public.lessons (coach_id);
create index if not exists idx_lessons_student_id on public.lessons (student_id);
create index if not exists idx_lessons_group_lesson_id on public.lessons (group_lesson_id);
create index if not exists idx_lessons_recurring_series_id on public.lessons (recurring_series_id);

-- invoices: filtered by coach_id (nearly every page), student_id (Invoices/Students)
create index if not exists idx_invoices_coach_id on public.invoices (coach_id);
create index if not exists idx_invoices_student_id on public.invoices (student_id);

-- invoice_lessons: join table, filtered by both sides constantly (invoice cleanup/status logic)
create index if not exists idx_invoice_lessons_invoice_id on public.invoice_lessons (invoice_id);
create index if not exists idx_invoice_lessons_lesson_id on public.invoice_lessons (lesson_id);

-- coach_students: filtered by coach_id (every page's student list) and student_id
create index if not exists idx_coach_students_coach_id on public.coach_students (coach_id);
create index if not exists idx_coach_students_student_id on public.coach_students (student_id);

-- notifications: filtered by profile_id on every Dashboard/DesktopLayout load
create index if not exists idx_notifications_profile_id on public.notifications (profile_id);

-- group_lessons / group_lesson_students
create index if not exists idx_group_lessons_coach_id on public.group_lessons (coach_id);
create index if not exists idx_group_lesson_students_group_lesson_id on public.group_lesson_students (group_lesson_id);

-- recurring_lessons
create index if not exists idx_recurring_lessons_coach_id on public.recurring_lessons (coach_id);

-- events (calendar) and google calendar import queue
create index if not exists idx_events_coach_id on public.events (coach_id);
create index if not exists idx_google_calendar_pending_imports_coach_id on public.google_calendar_pending_imports (coach_id);

-- invoice_brand_settings / event_invoices: filtered by user_id (PdfInvoice.tsx)
create index if not exists idx_invoice_brand_settings_user_id on public.invoice_brand_settings (user_id);
create index if not exists idx_event_invoices_user_id on public.event_invoices (user_id);
