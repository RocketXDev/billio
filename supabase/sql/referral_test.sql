-- ============================================================================
-- Referral program — test run for coach 454a3e1c-9666-4a12-a383-434708c78088
-- ============================================================================
-- Run the parts in order in the Supabase SQL editor.
--
-- Parts 1–3 are read-only.
-- Part 4 writes, then deliberately aborts so nothing is saved — see the note
-- above it before running.
-- ============================================================================


-- ── Part 1. Did the migration actually apply? ───────────────────────────────
select item, result from (
  select 1 as ord, 'coaches.referral_code column' as item,
         case when exists (select 1 from information_schema.columns
                            where table_schema = 'public' and table_name = 'coaches'
                              and column_name = 'referral_code')
              then 'OK' else 'MISSING' end as result
  union all select 2, 'coaches.stripe_customer_id column',
         case when exists (select 1 from information_schema.columns
                            where table_schema = 'public' and table_name = 'coaches'
                              and column_name = 'stripe_customer_id')
              then 'OK' else 'MISSING' end
  union all select 3, 'referrals table',
         case when to_regclass('public.referrals') is not null then 'OK' else 'MISSING' end
  union all select 4, 'referral_rewards table',
         case when to_regclass('public.referral_rewards') is not null then 'OK' else 'MISSING' end
  union all select 5, 'trigger: assign code on insert',
         case when exists (select 1 from pg_trigger where tgname = 'trg_coaches_referral_code')
              then 'OK' else 'MISSING' end
  union all select 6, 'trigger: qualify on subscribe',
         case when exists (select 1 from pg_trigger where tgname = 'trg_coaches_referral_qualify')
              then 'OK' else 'MISSING' end
  union all select 7, 'RLS on referrals',
         case when (select relrowsecurity from pg_class where oid = 'public.referrals'::regclass)
              then 'OK' else 'NOT ENABLED' end
  union all select 8, 'RLS on referral_rewards',
         case when (select relrowsecurity from pg_class where oid = 'public.referral_rewards'::regclass)
              then 'OK' else 'NOT ENABLED' end
  union all select 9, 'coaches still missing a code',
         (select count(*)::text from public.coaches where referral_code is null)
  union all select 10, 'functions present',
         (select string_agg(proname, ', ' order by proname)
            from pg_proc
           where pronamespace = 'public'::regnamespace
             and proname in ('claim_referral', 'get_referral_summary', 'get_referral_activity',
                             'lookup_referral_code', 'billio_grant_referral_rewards',
                             'billio_mask_name', 'billio_current_coach_id',
                             'billio_generate_referral_code'))
) t order by ord;


-- ── Part 2. This coach's current state ──────────────────────────────────────
select c.id,
       c.referral_code,
       c.plan,
       c.trial_used,
       c.trial_end,
       c.stripe_customer_id,
       c.stripe_subscription_id,
       p.full_name
  from public.coaches c
  join public.profiles p on p.id = c.profile_id
 where c.id = '454a3e1c-9666-4a12-a383-434708c78088';

-- Their referrals and rewards so far (expect empty on a fresh install).
select status, count(*)
  from public.referrals
 where referrer_coach_id = '454a3e1c-9666-4a12-a383-434708c78088'
 group by status;

select id, months, status, amount_cents, earned_at, applied_at, stripe_credit_txn_id
  from public.referral_rewards
 where coach_id = '454a3e1c-9666-4a12-a383-434708c78088'
 order by earned_at;

-- The code as the signup form sees it. This is the one RPC that needs no
-- session, so it runs as-is here.
select public.lookup_referral_code(
  (select referral_code from public.coaches
    where id = '454a3e1c-9666-4a12-a383-434708c78088')
) as lookup_result;

-- And a code that doesn't exist — should come back {"valid": false}.
select public.lookup_referral_code('NOPE123') as bad_code_result;


-- ── Part 3. The page's own RPCs, as this coach ──────────────────────────────
-- get_referral_summary() and get_referral_activity() read auth.uid(), which is
-- NULL in the SQL editor — they'd just answer "no_coach". Impersonating the
-- coach's auth user makes them answer for real. Wrapped in a transaction
-- because get_referral_summary() self-heals a missing referral_code by writing
-- one, and this is a test.
begin;

select set_config(
  'request.jwt.claims',
  json_build_object('sub', (
    select p.user_id
      from public.coaches c
      join public.profiles p on p.id = c.profile_id
     where c.id = '454a3e1c-9666-4a12-a383-434708c78088'
  ))::text,
  true
);
set local role authenticated;

select public.billio_current_coach_id() as resolved_coach_id;  -- must match the id above
select public.get_referral_summary()    as summary;
select public.get_referral_activity()   as activity;

rollback;


-- ── Part 4. Full simulation: three invites → one free month ─────────────────
-- READ THIS FIRST.
--
-- This borrows three real coaches who have no subscription and no referral of
-- their own, uses them as stand-in invitees, and walks the whole flow. It ends
-- with `raise exception`, which aborts the block and rolls back every write —
-- so the test report arrives as an ERROR in the results panel. That is the
-- expected, successful outcome: an error containing the report means it
-- worked and nothing was saved.
--
-- The entire thing is ONE statement (a DO block), so there is no way to run
-- half of it and leave the borrowed coaches modified.

do $$
declare
  v_referrer   uuid := '454a3e1c-9666-4a12-a383-434708c78088';
  v_code       text;
  v_targets    uuid[];
  v_target     uuid;
  v_i          int := 0;
  v_qualified  int;
  v_rewards    int;
  v_notifs     int;
  v_again      int;
  v_report     text := '';
begin
  select referral_code into v_code
    from public.coaches where id = v_referrer;

  if not found then
    raise exception 'No coach with id %', v_referrer;
  end if;

  v_report := v_report
    || format(E'referrer      : %s\n', v_referrer)
    || format(E'referral_code : %s\n', coalesce(v_code, '(none — trigger did not fire)'));

  -- Stand-in invitees: no subscription (so the trigger has a real NULL ->
  -- value transition to see) and not already referred (unique constraint).
  select array_agg(id) into v_targets
    from (
      select c.id
        from public.coaches c
       where c.id <> v_referrer
         and c.stripe_subscription_id is null
         and not exists (
           select 1 from public.referrals r where r.referred_coach_id = c.id
         )
       limit 3
    ) t;

  if v_targets is null or array_length(v_targets, 1) < 3 then
    raise exception
      'Need 3 other coaches with no subscription and no existing referral — found %.',
      coalesce(array_length(v_targets, 1), 0);
  end if;

  v_report := v_report || format(E'stand-ins     : %s\n\n', v_targets::text);

  foreach v_target in array v_targets loop
    v_i := v_i + 1;

    -- What claim_referral() writes when the invitee lands on the dashboard.
    insert into public.referrals (referrer_coach_id, referred_coach_id, referral_code, status)
    values (v_referrer, v_target, v_code, 'pending');

    -- What the Stripe webhook writes when they start their trial. This is the
    -- write trg_coaches_referral_qualify watches for.
    update public.coaches
       set stripe_subscription_id = 'sub_referral_test_' || v_i
     where id = v_target;

    select count(*) into v_qualified
      from public.referrals
     where referrer_coach_id = v_referrer and status = 'qualified';

    select count(*) into v_rewards
      from public.referral_rewards
     where coach_id = v_referrer;

    v_report := v_report || format(
      E'invite %s subscribed  ->  qualified: %s   reward rows: %s%s\n',
      v_i, v_qualified, v_rewards,
      case when v_i = 3 and v_rewards = 0 then '   <-- EXPECTED 1, GOT 0'
           when v_i < 3 and v_rewards > 0 then '   <-- EXPECTED 0, MINTED EARLY'
           else '' end
    );
  end loop;

  -- The milestone function must be safe to re-run (the webhook and the page
  -- can both reach it) — a second call must not mint a second month.
  perform public.billio_grant_referral_rewards(v_referrer);
  select count(*) into v_again
    from public.referral_rewards where coach_id = v_referrer;

  select count(*) into v_notifs
    from public.notifications n
    join public.coaches c on c.profile_id = n.profile_id
   where c.id = v_referrer and n.type = 'referral_reward';

  v_report := v_report
    || format(E'\nre-ran grant  : %s reward rows (must still be %s)\n', v_again, v_rewards)
    || format(E'notification  : %s row(s) of type referral_reward\n', v_notifs)
    || format(E'pending reward: %s\n',
         coalesce((select string_agg(id::text || ' (' || status || ', ' || months || 'mo)', ', ')
                     from public.referral_rewards
                    where coach_id = v_referrer and status = 'pending'), '(none)'))
    || E'\nVERDICT: '
    || case when v_rewards = 1 and v_again = 1 and v_qualified = 3
            then 'PASS — 3 invites produced exactly 1 free month.'
            else 'FAIL — see the lines above.' end;

  raise exception E'\n\n===== REFERRAL TEST — ROLLED BACK, NOTHING SAVED =====\n%\n', v_report;
end $$;


-- ── Part 5. What Part 4 can't cover ─────────────────────────────────────────
-- • claim_referral() reads auth.uid(), so the real path is only exercised by
--   signing up through the app with a ?ref= link or a typed code.
-- • apply-referral-rewards is an edge function — nothing here touches Stripe.
--   After a real reward exists, check it landed with:
--       stripe customers retrieve <customer_id>
--   and look at `balance` (negative = credit owed to them), or open the
--   customer in the Stripe dashboard.
