# Referral program — Supabase setup

Everything the backend needs, in the order to apply it.

## 1. Run the SQL

Paste `supabase/sql/referral_program.sql` into the Supabase SQL editor and run it.
It's idempotent — safe to re-run.

It adds:

| Object | What it is |
| --- | --- |
| `coaches.referral_code` | unique short code, auto-assigned on insert, backfilled for existing coaches |
| `coaches.stripe_customer_id` | added only if it doesn't already exist |
| `referrals` | one row per referred coach — `pending` → `qualified` |
| `referral_rewards` | one row per earned free month — `pending` → `applied` |
| `claim_referral(text)` | RPC the referred coach calls once |
| `get_referral_summary()` | RPC powering the referrals page |
| `get_referral_activity()` | RPC listing invites (names masked to "First L.") |
| `trg_coaches_referral_qualify` | trigger that qualifies a referral + mints rewards |

RLS on both new tables is **select-own only**. Every write goes through a
security-definer function or the service role, so the client can't fabricate a
referral or a reward.

## 2. Deploy the edge function

```bash
supabase functions deploy apply-referral-rewards
```

It reuses the secrets the Stripe functions already have
(`STRIPE_SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). Optional:

```bash
supabase secrets set REFERRAL_REWARD_AMOUNT_CENTS=999   # fallback only
supabase secrets set REFERRAL_REWARD_CURRENCY=usd
```

The fallback is only used when the coach has no readable subscription — normally
the credit amount is read off their actual subscription price, so a price change
doesn't under-credit anyone.

## 3. How a free month is actually delivered

One reward = one **negative Stripe customer balance transaction** for the price of
a month. Stripe applies customer credit to the next invoice automatically:

- **Coach is trialing** → the next invoice is the first one after the trial ends,
  so that first real bill is $0. This is the "free month after trialing is
  concluded" case.
- **Coach is already paying** → next renewal is $0.
- **Coach has no Stripe customer yet** → the reward stays `pending` and is applied
  the next time they load the referrals or upgrade page after subscribing.

Credit was chosen over a 100%-off coupon on purpose: credits **stack** (6 referrals
= 2 free months), while a second coupon on the same subscription replaces the first.

## 4. Optional — apply rewards from the Stripe webhook too

**You can skip this section.** The app calls `apply-referral-rewards` whenever a
coach opens the Referrals or Upgrade page, which covers normal usage. This only
makes an earned credit land sooner — the moment the coach subscribes, instead of
the next time they look at billing.

If you do want it: this goes in your **`stripe-webhook` edge function** (deployed
in Supabase, not in this repo), inside the `customer.subscription.created`
handler — *after* the line that writes `stripe_subscription_id` onto the coach
row, since that write is what qualifies the referral:

```ts
// stripe-webhook/index.ts — customer.subscription.created
await supabase
  .from("coaches")
  .update({ stripe_subscription_id: subscription.id, /* …your existing fields… */ })
  .eq("id", coachId);

// ↓ add this right here. coachId is the coach who just subscribed — whatever
//   variable your handler already uses on the line above.
async function cashIn(id: string) {
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/apply-referral-rewards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coachId: id }),
    });
  } catch (_err) {
    // Never fail the webhook over this — the page-load path picks it up.
  }
}

// 1. The subscriber themselves: if they'd already earned free months while on
//    the free plan, this is the first moment they have a Stripe customer for
//    the credit to land on.
await cashIn(coachId);

// 2. Their referrer: the update above just qualified this referral, and if it
//    was their 3rd the database has already minted the reward row.
const { data: referral } = await supabase
  .from("referrals")
  .select("referrer_coach_id")
  .eq("referred_coach_id", coachId)
  .maybeSingle();

if (referral?.referrer_coach_id) await cashIn(referral.referrer_coach_id);
```

Order matters: the `coaches` update has to come first, because the database
trigger that qualifies the referral and mints the reward fires on that write.

`apply-referral-rewards` accepts these service-role calls because it recognises
the service-role key and takes `coachId` from the body. A call carrying a normal
user JWT ignores `coachId` and resolves the coach from the token instead, so a
client can't cash in someone else's rewards.

## 5. Tuning the program

- **Referrals per free month** — `v_per_reward constant int := 3` appears in both
  `billio_grant_referral_rewards` and `get_referral_summary`. Change both.
- **What counts as qualified** — `billio_referral_qualify` fires when
  `coaches.stripe_subscription_id` first gets set, i.e. the referred coach reached
  Stripe checkout and put a card down (trial included). To make it stricter —
  only after their first *paid* invoice — move the `update public.referrals ...
  set status = 'qualified'` into your webhook's `invoice.paid` handler instead of
  the trigger.
- **Who can be attributed** — `claim_referral` refuses a coach who already has
  `trial_used` or a subscription, so an existing subscriber can't be retroactively
  "referred" by a second account.

## 6. Quick manual test

```sql
-- pick two coaches
select id, referral_code, trial_used, stripe_subscription_id from coaches limit 5;

-- simulate: referred coach B claims coach A's code (run as B via the app, or
-- insert directly as the service role)
insert into referrals (referrer_coach_id, referred_coach_id, referral_code, status)
values ('<A>', '<B>', '<A-code>', 'pending');

-- simulate B subscribing — this fires the trigger
update coaches set stripe_subscription_id = 'sub_test_1' where id = '<B>';

select status, qualified_at from referrals where referred_coach_id = '<B>';
select * from referral_rewards where coach_id = '<A>';  -- one row after the 3rd
```
