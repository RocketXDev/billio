-- ============================================================================
-- Billio referral program
-- ============================================================================
-- Run this whole file once in the Supabase SQL editor. It is idempotent —
-- re-running it is safe.
--
-- Model
--   • Every coach gets a short `referral_code` (on coaches).
--   • A new coach claims a code once, creating a row in `referrals` (pending).
--   • That referral turns `qualified` when the referred coach actually starts
--     a Pro trial/subscription (stripe_subscription_id gets set) — a card is
--     required at Stripe checkout, so fake signups can't mint free months.
--   • Every REFERRALS_PER_REWARD (3) qualified referrals mints one row in
--     `referral_rewards` worth one free month.
--   • The `apply-referral-rewards` edge function turns each pending reward
--     into a Stripe customer balance credit. For a trialing coach the next
--     invoice is the first one after the trial ends, so the waived month
--     lands exactly there. Credits stack, unlike coupons.
-- ============================================================================


-- ── 1. Columns on coaches ───────────────────────────────────────────────────
alter table public.coaches
  add column if not exists referral_code text;

alter table public.coaches
  add column if not exists stripe_customer_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'coaches_referral_code_key'
      and conrelid = 'public.coaches'::regclass
  ) then
    alter table public.coaches
      add constraint coaches_referral_code_key unique (referral_code);
  end if;
end $$;


-- ── 2. Code generation ──────────────────────────────────────────────────────
-- Ambiguity-free alphabet (no O/0, I/1, L) — these codes get read aloud and
-- typed by hand.
create or replace function public.billio_generate_referral_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..7 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.coaches where referral_code = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.billio_set_referral_code()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referral_code is null then
    new.referral_code := public.billio_generate_referral_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_coaches_referral_code on public.coaches;
create trigger trg_coaches_referral_code
  before insert on public.coaches
  for each row execute function public.billio_set_referral_code();

-- Backfill existing coaches, one statement per row.
do $$
declare
  r record;
begin
  for r in select id from public.coaches where referral_code is null loop
    loop
      begin
        update public.coaches
           set referral_code = public.billio_generate_referral_code()
         where id = r.id;
        exit;
      exception when unique_violation then
        -- Vanishingly rare with a 31^7 keyspace; retry rather than abort.
        null;
      end;
    end loop;
  end loop;
end $$;


-- ── 3. Helper: the calling user's coach id ──────────────────────────────────
create or replace function public.billio_current_coach_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
    from public.coaches c
    join public.profiles p on p.id = c.profile_id
   where p.user_id = auth.uid()
   limit 1;
$$;


-- Names shown across the referral UI are trimmed to "First L." — enough for
-- someone to recognise the person, without exposing full profiles across the
-- RLS boundary. Returns NULL when there's no usable name, so each caller
-- picks its own wording for that case.
create or replace function public.billio_mask_name(p_full_name text)
returns text
language sql
immutable
as $$
  select nullif(
    split_part(btrim(coalesce(p_full_name, '')), ' ', 1) ||
    case
      when position(' ' in btrim(coalesce(p_full_name, ''))) > 0
      then ' ' || left(split_part(btrim(p_full_name), ' ', 2), 1) || '.'
      else ''
    end,
  '');
$$;


-- ── 4. Tables ───────────────────────────────────────────────────────────────
create table if not exists public.referrals (
  id                 uuid primary key default gen_random_uuid(),
  referrer_coach_id  uuid not null references public.coaches(id) on delete cascade,
  referred_coach_id  uuid not null references public.coaches(id) on delete cascade,
  referral_code      text not null,
  status             text not null default 'pending',
  created_at         timestamptz not null default now(),
  qualified_at       timestamptz,
  constraint referrals_referred_once unique (referred_coach_id),
  constraint referrals_no_self check (referrer_coach_id <> referred_coach_id),
  constraint referrals_status_valid check (status in ('pending', 'qualified', 'void'))
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_coach_id);

create table if not exists public.referral_rewards (
  id                    uuid primary key default gen_random_uuid(),
  coach_id              uuid not null references public.coaches(id) on delete cascade,
  months                int  not null default 1,
  status                text not null default 'pending',
  source                text not null default 'referral_milestone',
  amount_cents          int,
  currency              text,
  stripe_credit_txn_id  text,
  earned_at             timestamptz not null default now(),
  applied_at            timestamptz,
  notes                 text,
  constraint referral_rewards_status_valid check (status in ('pending', 'applied', 'failed', 'void'))
);

create index if not exists referral_rewards_coach_idx on public.referral_rewards (coach_id);


-- ── 5. Granting rewards at each milestone ───────────────────────────────────
-- Idempotent by construction: it compares the number of reward rows that
-- *should* exist against the number that already do, so it can be called any
-- number of times (and handles several referrals qualifying at once).
create or replace function public.billio_grant_referral_rewards(p_coach_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Change this to move the goalpost (e.g. 5 referrals per free month).
  v_per_reward constant int := 3;
  v_qualified int;
  v_deserved  int;
  v_existing  int;
  v_new       int;
  i int;
begin
  if p_coach_id is null then
    return 0;
  end if;

  select count(*) into v_qualified
    from public.referrals
   where referrer_coach_id = p_coach_id
     and status = 'qualified';

  v_deserved := v_qualified / v_per_reward;  -- integer division

  select count(*) into v_existing
    from public.referral_rewards
   where coach_id = p_coach_id
     and source = 'referral_milestone';

  v_new := greatest(0, v_deserved - v_existing);

  for i in 1..v_new loop
    insert into public.referral_rewards (coach_id, months, status, source)
    values (p_coach_id, 1, 'pending', 'referral_milestone');
  end loop;

  if v_new > 0 then
    begin
      insert into public.notifications (profile_id, title, message, type, is_read)
      select c.profile_id,
             'You earned a free month of Pro',
             'Three of your invites started Billio Pro. Your next Pro bill is on us — the credit is applied automatically.',
             'referral_reward',
             false
        from public.coaches c
       where c.id = p_coach_id;
    exception when others then
      -- The reward row is what matters; a failed nudge must never roll back
      -- the subscription write this trigger is running inside.
      null;
    end;
  end if;

  return v_new;
end;
$$;


-- ── 6. Qualification trigger ────────────────────────────────────────────────
-- Fires no matter who writes the row (Stripe webhook, service role, app), so
-- there is nothing to remember to call from the checkout flow.
create or replace function public.billio_referral_qualify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  if new.stripe_subscription_id is not null
     and (old.stripe_subscription_id is null
          or old.stripe_subscription_id is distinct from new.stripe_subscription_id)
  then
    update public.referrals
       set status = 'qualified',
           qualified_at = now()
     where referred_coach_id = new.id
       and status = 'pending'
    returning referrer_coach_id into v_referrer;

    if v_referrer is not null then
      perform public.billio_grant_referral_rewards(v_referrer);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_coaches_referral_qualify on public.coaches;
create trigger trg_coaches_referral_qualify
  after update on public.coaches
  for each row execute function public.billio_referral_qualify();


-- ── 7. RPCs called from the app ─────────────────────────────────────────────

-- Claim a code. Called once by the *referred* coach, right after their coach
-- row exists. Safe to call repeatedly — it no-ops once a referral exists.
create or replace function public.claim_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id  uuid;
  v_code      text;
  v_referrer  uuid;
  v_existing  text;
begin
  v_code := upper(nullif(btrim(coalesce(p_code, '')), ''));
  if v_code is null then
    return jsonb_build_object('ok', false, 'reason', 'no_code');
  end if;

  v_coach_id := public.billio_current_coach_id();
  if v_coach_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_coach');
  end if;

  select referral_code into v_existing
    from public.referrals
   where referred_coach_id = v_coach_id;

  if found then
    -- Already attributed. Report ok when it's the same code so the client can
    -- stop retrying and clear its stored code either way.
    return jsonb_build_object('ok', v_existing = v_code, 'reason', 'already_referred');
  end if;

  select id into v_referrer
    from public.coaches
   where referral_code = v_code;

  if v_referrer is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;

  if v_referrer = v_coach_id then
    return jsonb_build_object('ok', false, 'reason', 'self_referral');
  end if;

  -- Attribution window: only a coach who has never started Pro can be
  -- attributed to a referrer. Stops a long-time subscriber from being
  -- retroactively "referred" by a second account they control.
  if exists (
    select 1 from public.coaches
     where id = v_coach_id
       and (trial_used is true or stripe_subscription_id is not null)
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_eligible');
  end if;

  begin
    insert into public.referrals (referrer_coach_id, referred_coach_id, referral_code, status)
    values (v_referrer, v_coach_id, v_code, 'pending');
  exception when unique_violation then
    -- Claimed by a concurrent call between the check above and this insert.
    return jsonb_build_object('ok', true, 'reason', 'already_referred');
  end;

  return jsonb_build_object('ok', true, 'reason', 'claimed');
end;
$$;


-- Everything the referrals page needs, in one round trip.
create or replace function public.get_referral_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_per_reward constant int := 3;
  v_coach_id        uuid;
  v_code            text;
  v_pending         int;
  v_qualified       int;
  v_rewards_total   int;
  v_rewards_applied int;
  v_rewards_pending int;
begin
  v_coach_id := public.billio_current_coach_id();
  if v_coach_id is null then
    return jsonb_build_object('ok', false, 'reason', 'no_coach');
  end if;

  select referral_code into v_code from public.coaches where id = v_coach_id;

  -- Self-heal: a coach created before this migration (or by a path that
  -- skipped the trigger) still gets a code the first time they open the page.
  if v_code is null then
    v_code := public.billio_generate_referral_code();
    update public.coaches set referral_code = v_code where id = v_coach_id;
  end if;

  select count(*) filter (where status = 'pending'),
         count(*) filter (where status = 'qualified')
    into v_pending, v_qualified
    from public.referrals
   where referrer_coach_id = v_coach_id;

  select count(*),
         count(*) filter (where status = 'applied'),
         count(*) filter (where status = 'pending')
    into v_rewards_total, v_rewards_applied, v_rewards_pending
    from public.referral_rewards
   where coach_id = v_coach_id
     and status <> 'void';

  return jsonb_build_object(
    'ok', true,
    'code', v_code,
    'referrals_per_reward', v_per_reward,
    'invited', v_pending + v_qualified,
    'pending', v_pending,
    'qualified', v_qualified,
    'progress', v_qualified % v_per_reward,
    'remaining', v_per_reward - (v_qualified % v_per_reward),
    'rewards_total', v_rewards_total,
    'rewards_applied', v_rewards_applied,
    'rewards_pending', v_rewards_pending
  );
end;
$$;


-- Invite list for the activity feed. Names are trimmed to "First L." — the
-- referrer invited these people, but there's no reason to expose full
-- profiles across the RLS boundary.
create or replace function public.get_referral_activity()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach_id uuid;
  v_rows jsonb;
begin
  v_coach_id := public.billio_current_coach_id();
  if v_coach_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(payload order by created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select r.created_at,
             jsonb_build_object(
               'id', r.id,
               'status', r.status,
               'created_at', r.created_at,
               'qualified_at', r.qualified_at,
               'name', coalesce(public.billio_mask_name(p.full_name), 'A coach')
             ) as payload
        from public.referrals r
        join public.coaches  c on c.id = r.referred_coach_id
        join public.profiles p on p.id = c.profile_id
       where r.referrer_coach_id = v_coach_id
    ) t;

  return v_rows;
end;
$$;


-- Checks a hand-typed code while someone is still filling in the signup form —
-- they heard it out loud rather than clicking a link, so a typo would
-- otherwise fail silently weeks later, when claim_referral finally runs.
--
-- Callable by `anon` (nobody is signed in yet). That makes it an enumeration
-- oracle in principle; in practice the keyspace is 31^7 (~27 billion) and the
-- only thing a hit reveals is a first name and last initial.
create or replace function public.lookup_referral_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_name text;
begin
  v_code := upper(nullif(btrim(coalesce(p_code, '')), ''));
  if v_code is null then
    return jsonb_build_object('valid', false);
  end if;

  select public.billio_mask_name(p.full_name)
    into v_name
    from public.coaches c
    join public.profiles p on p.id = c.profile_id
   where c.referral_code = v_code;

  if not found then
    return jsonb_build_object('valid', false);
  end if;

  return jsonb_build_object('valid', true, 'name', coalesce(v_name, 'another coach'));
end;
$$;


-- ── 8. RLS ──────────────────────────────────────────────────────────────────
-- Reads only. Every write goes through the security-definer functions above
-- or the service role, so a client can't fabricate referrals or rewards.
alter table public.referrals        enable row level security;
alter table public.referral_rewards enable row level security;

drop policy if exists "referrals_select_own" on public.referrals;
create policy "referrals_select_own" on public.referrals
  for select to authenticated
  using (
    referrer_coach_id = public.billio_current_coach_id()
    or referred_coach_id = public.billio_current_coach_id()
  );

drop policy if exists "referral_rewards_select_own" on public.referral_rewards;
create policy "referral_rewards_select_own" on public.referral_rewards
  for select to authenticated
  using (coach_id = public.billio_current_coach_id());


-- ── 9. Grants ───────────────────────────────────────────────────────────────
grant execute on function public.claim_referral(text)      to authenticated;
grant execute on function public.get_referral_summary()     to authenticated;
grant execute on function public.get_referral_activity()    to authenticated;
grant execute on function public.billio_current_coach_id()  to authenticated;

-- Runs on the signup form, before there's a session.
grant execute on function public.lookup_referral_code(text)  to anon, authenticated;

-- Internal helpers — no client should call these directly.
revoke execute on function public.billio_grant_referral_rewards(uuid) from public, anon, authenticated;
revoke execute on function public.billio_generate_referral_code()     from public, anon, authenticated;
