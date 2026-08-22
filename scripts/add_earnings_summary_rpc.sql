-- Replaces EarningsDashboard.tsx's client-side aggregation (which pulled every
-- lesson/invoice a coach has ever created just to sum "this month"/"this year")
-- with a single Postgres call that returns only the aggregated numbers.
--
-- SECURITY: no `security definer` here, deliberately — this stays `security
-- invoker` (the default) so the caller's own RLS policies on lessons/invoices
-- still apply. Do not add `security definer` without re-adding an explicit
-- coach_id ownership check, or any authenticated user could pass another
-- coach's id and read their earnings.

create or replace function public.get_earnings_summary(p_coach_id uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  with l as (
    select lsn.id, lsn.lesson_date, lsn.billing_status, lsn.rate, lsn.student_id, lsn.lesson_type,
           st.student_name
    from lessons lsn
    left join students st on st.id = lsn.student_id
    where lsn.coach_id = p_coach_id
  ),
  bounds as (
    select date_trunc('month', now())::date as month_start,
           date_trunc('year', now())::date as year_start
  ),
  this_month as (
    select
      coalesce(sum(l.rate) filter (where l.billing_status = 'paid'), 0) as revenue,
      count(*) as lesson_count
    from l, bounds
    where l.lesson_date >= bounds.month_start
  ),
  ytd as (
    select
      coalesce(sum(l.rate) filter (where l.billing_status = 'paid'), 0) as revenue,
      count(*) as lesson_count,
      count(distinct to_char(l.lesson_date, 'YYYY-MM')) filter (where l.billing_status = 'paid') as months_with_revenue
    from l, bounds
    where l.lesson_date >= bounds.year_start
  ),
  all_time as (
    select
      coalesce(sum(l.rate) filter (where l.billing_status = 'paid'), 0) as revenue,
      count(*) filter (where l.billing_status = 'paid') as paid_count
    from l
  ),
  unpaid_lessons as (
    select coalesce(sum(l.rate), 0) as total, count(*) as cnt
    from l where l.billing_status = 'unbilled'
  ),
  unpaid_invoices as (
    select coalesce(sum(inv.total), 0) as total, count(*) as cnt
    from invoices inv
    where inv.coach_id = p_coach_id and inv.status in ('unbilled', 'billed')
  ),
  months as (
    select date_trunc('month', now() - (n || ' months')::interval)::date as month_start
    from generate_series(0, 11) as n
  ),
  monthly as (
    select
      to_char(m.month_start, 'YYYY-MM') as key,
      coalesce(sum(l.rate) filter (where l.billing_status = 'paid'), 0) as revenue,
      count(l.id) as count
    from months m
    left join l on l.lesson_date >= m.month_start and l.lesson_date < (m.month_start + interval '1 month')
    group by m.month_start
    order by m.month_start
  ),
  top_students as (
    select l.student_name as name, sum(l.rate) as revenue, count(*) as count
    from l
    where l.billing_status = 'paid' and l.student_id is not null
    group by l.student_id, l.student_name
    order by sum(l.rate) desc
    limit 5
  ),
  by_type as (
    select trim(l.lesson_type) as type, sum(l.rate) as amount
    from l
    where l.billing_status = 'paid' and l.lesson_type is not null and trim(l.lesson_type) <> ''
    group by trim(l.lesson_type)
    order by sum(l.rate) desc
  )
  select jsonb_build_object(
    'thisMonth', (select jsonb_build_object('revenue', revenue, 'count', lesson_count) from this_month),
    'ytd', (select jsonb_build_object('revenue', revenue, 'count', lesson_count, 'monthsWithRevenue', months_with_revenue) from ytd),
    'allTime', (select jsonb_build_object('revenue', revenue, 'paidCount', paid_count) from all_time),
    'unpaidLessons', (select jsonb_build_object('total', total, 'count', cnt) from unpaid_lessons),
    'unpaidInvoices', (select jsonb_build_object('total', total, 'count', cnt) from unpaid_invoices),
    'monthly', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'revenue', revenue, 'count', count)), '[]'::jsonb) from monthly),
    'topStudents', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'revenue', revenue, 'count', count)), '[]'::jsonb) from top_students),
    'byType', (select coalesce(jsonb_agg(jsonb_build_object('type', type, 'amount', amount)), '[]'::jsonb) from by_type)
  );
$$;

grant execute on function public.get_earnings_summary(uuid) to authenticated;
