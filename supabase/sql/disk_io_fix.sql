-- Disk IO fix (Oct 2026). Paste the whole file into the Supabase SQL editor.
-- Safe to re-run.
--
-- Diagnosis (from disk_io_diagnostics.sql):
--   * net._http_response was 368 MB on disk while holding ~1,200 live rows —
--     ~97% of the whole 415 MB database. It is pg_net's log of every HTTP
--     response; the cron jobs only fire requests and never read it.
--   * pg_net's own TTL cleanup (the "DELETE FROM net._http_response ... ORDER
--     BY created LIMIT ..." query) ran ~227k times since Aug 22 and read
--     ~71M blocks (~540 GB) from disk — by far the top disk consumer. Once
--     the bloated table no longer fitted in the Micro instance's memory,
--     every cleanup pass went to disk (cache hit ratio 92.5%).
--   * The volume comes from three every-minute cron jobs (auto-invoices,
--     weekly-invoice-review, generate-invoices) plus send-lesson-reminders
--     every 5 min: ~4,600 HTTP calls/day, each one a response row to write
--     and later delete.
--
-- This file fixes the storage side. Reducing the every-minute schedules is a
-- separate step: it needs the three edge functions' code first, because the
-- invoice times are free-form (<input type="time">) and the functions may
-- only match the exact current minute.

-- 1. Drop the bloated response log. TRUNCATE (unlike DELETE) gives the
--    ~360 MB back immediately. Nothing reads these rows: every cron job is a
--    fire-and-forget net.http_post, and the app never calls
--    net._http_collect_response.
truncate table net._http_response;

-- 2. Keep 2 days of cron run history instead of 7. At ~4,600 runs/day that is
--    ~9k rows instead of ~32k. Re-scheduling under the same name updates the
--    existing job (id 18) in place.
select cron.schedule(
  'cleanup-job-run-details',
  '0 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '2 days'; $$
);

-- 3. Reset query statistics so the next diagnostics run shows only the
--    post-fix picture instead of totals going back to Aug 22.
select extensions.pg_stat_statements_reset();

-- 4. Confirm: should now read a few hundred kB, and the database size should
--    have dropped by roughly 360 MB.
select pg_size_pretty(pg_total_relation_size('net._http_response')) as http_response_size,
       pg_size_pretty(pg_database_size(current_database()))          as database_size;
