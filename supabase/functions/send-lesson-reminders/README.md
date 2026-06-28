# send-lesson-reminders

Sends automated lesson reminders based on each coach's settings in the app
(Lessons page → bell icon: master on/off, which offsets, and which students
are opted in). See `index.ts` for the full logic and the migrations it
depends on, in order: `../../migrations/20260627000000_lesson_reminders.sql`
and `../../migrations/20260630000000_lesson_reminder_revert_digests.sql`.

(There were two intermediate migrations — `20260628..._digests.sql`, which
made 1-day/2-day/1-week offsets send a digest of multiple lessons, and
`20260629..._student_overrides.sql`, which let an individual student use
different offsets than the coach default — that both got reverted. Every
offset is single-lesson again, and every opted-in student follows the same
coach-wide offsets. Skip `20260628` and `20260629` entirely on a fresh
setup; `20260630` cleans up `20260628`'s schema changes, and
`20260631..._drop_coach_student_reminder_offsets.sql` drops `20260629`'s
now-unused per-student column. Both cleanup migrations are safe to run
whether or not the migration they clean up after was ever applied.)

## Reminder behavior

Every offset — 30 minutes through 1 week before — reminds about **one
specific lesson**. There's no digest/aggregation: a student with three
lessons this week and a "1 day before" offset gets three separate reminders,
one per lesson, each the day before that lesson.

Every student opted in (checked in the Students picker in the app) gets
reminders for all of the coach's configured offsets — there's no per-student
timing override.

## Before deploying

1. **Run the migrations**, in order, against your project — via
   `supabase db push`, or paste them into the SQL editor one at a time:
   `20260627...`, then `20260630...`, then `20260631...`.

2. **Sender address**: `index.ts` sends from `reminders@mail.mybillioapp.com`
   (same verified domain as `send-single-invoice`'s
   `notifications@mail.mybillioapp.com`, different local part so reminders
   are distinguishable from invoice emails in a mailbox). Change it if you'd
   rather reuse the exact same address.

3. **Set secrets** (`supabase secrets set KEY=value`, or in the dashboard
   under Edge Functions → Settings) — same provider accounts
   `send-single-invoice` already uses:
   - `RESEND_API_KEY` — same one `send-single-invoice` uses.
   - `TELNYX_API_KEY`, `TELNYX_PHONE_NUMBER` — same ones `send-single-invoice` uses.
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
     by Supabase — nothing to do there.

4. **Deploy:**
   ```
   supabase functions deploy send-lesson-reminders
   ```
   No `--no-verify-jwt` — same as `send-weekly-invoice-review`. Supabase's
   gateway checks the `Authorization` header is a valid project JWT before
   this code ever runs, so the cron job authenticates with your service
   role key instead of a separate custom secret.

## Scheduling it

Same pattern as your existing `send-weekly-invoice-review` cron — pg_cron
with the service role key as the bearer token:

```sql
select cron.schedule(
  'send-lesson-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/send-lesson-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <your service role key>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

If you'd rather not put SQL together by hand, the Supabase Dashboard's
Cron Jobs UI (Project → Integrations → Cron Jobs) does the same thing —
every 5 minutes, HTTP request to this function's URL with that same
`Authorization: Bearer <service role key>` header.

5 minutes is a reasonable cadence — frequent enough that a "1 hour before"
reminder fires within ~5 minutes of the hour mark, and the
`lesson_reminders_sent` unique constraint means a shorter or longer interval
can't cause duplicate sends, only a slightly different lead time.

## Testing it

Response body is `{ checked, sent, skipped, errors }`.

- Schedule a lesson ~10–20 minutes from now (in the coach's actual Settings
  timezone, not wherever you're physically sitting — that mismatch is what
  made the first test look like a no-op), check that student in the picker,
  select e.g. "30 min before", then trigger the function once you're inside
  that window.

## What I couldn't verify

I have no access to a working `node_modules`/Supabase CLI in the
environment I built this in, so none of this has actually been run, even
though the Resend/Telnyx calls mirror `send-single-invoice`'s real, working
integration exactly. Trigger it manually first and check the response body
before trusting the cron schedule.
