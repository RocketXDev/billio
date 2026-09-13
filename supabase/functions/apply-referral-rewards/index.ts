// Turns earned-but-unapplied referral rewards into real money off the coach's
// Stripe bill.
//
// A reward is one free month, delivered as a negative customer balance
// transaction rather than a coupon: Stripe applies customer credit to the
// next invoice automatically, and several credits stack — where a second
// 100%-off coupon on the same subscription would just replace the first.
// For a coach who is still trialing, the next invoice is the first one after
// the trial ends, which is exactly where the waived month belongs.
//
// Safe to call on every page load: rewards are marked `applied` in the same
// pass, and each Stripe write carries an idempotency key derived from the
// reward id, so a double-fire can't double-credit.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.mybillioapp.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Fallback only — the real figure is read off the coach's own subscription
// below, so a price change doesn't quietly under-credit anyone.
const FALLBACK_MONTH_CENTS = Number(Deno.env.get("REFERRAL_REWARD_AMOUNT_CENTS") ?? "999");
const FALLBACK_CURRENCY = (Deno.env.get("REFERRAL_REWARD_CURRENCY") ?? "usd").toLowerCase();

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // ── Identify the coach ───────────────────────────────────────────
    // Two callers: a signed-in coach from the app (resolve them from their
    // JWT), or a trusted server-side caller such as the Stripe webhook
    // (service-role key + an explicit coachId), which fires the moment a
    // subscription is created rather than waiting for the coach to open a
    // billing page.
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "Not authenticated." }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const isServiceCall = jwt === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const coachQuery = supabase
      .from("coaches")
      .select("id, profile_id, stripe_customer_id, stripe_subscription_id");

    let coach;

    if (isServiceCall) {
      const coachId = typeof body?.coachId === "string" ? body.coachId : "";
      if (!coachId) return json({ error: "coachId is required for service-role calls." }, 400);

      const { data } = await coachQuery.eq("id", coachId).single();
      coach = data;
    } else {
      const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
      const user = userData?.user;
      if (userError || !user) return json({ error: "Not authenticated." }, 401);

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return json({ error: "No profile." }, 404);

      const { data } = await coachQuery.eq("profile_id", profile.id).single();
      coach = data;
    }

    if (!coach) return json({ error: "No coach." }, 404);

    // ── Anything to apply? ───────────────────────────────────────────
    const { data: rewards } = await supabase
      .from("referral_rewards")
      .select("id, months")
      .eq("coach_id", coach.id)
      .eq("status", "pending")
      .order("earned_at", { ascending: true });

    if (!rewards || rewards.length === 0) {
      return json({ applied: 0, pending: 0 });
    }

    // ── Resolve the Stripe customer and what a month costs them ──────
    let customerId: string | null = coach.stripe_customer_id ?? null;
    let monthCents = FALLBACK_MONTH_CENTS;
    let currency = FALLBACK_CURRENCY;

    if (coach.stripe_subscription_id) {
      try {
        const sub = await stripe.subscriptions.retrieve(coach.stripe_subscription_id);

        // The subscription is also the authoritative source for the customer
        // id, which matters if coaches.stripe_customer_id was never populated
        // by the checkout webhook. Backfill it while we're here.
        const subCustomer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (subCustomer && subCustomer !== customerId) {
          customerId = subCustomer;
          await supabase
            .from("coaches")
            .update({ stripe_customer_id: subCustomer })
            .eq("id", coach.id);
        }

        const price = sub.items?.data?.[0]?.price;
        if (price?.unit_amount) {
          monthCents = price.unit_amount;
          currency = price.currency ?? currency;
        }
      } catch (_err) {
        // Subscription gone or unreadable — fall back to the configured price.
      }
    }

    // Credit needs somewhere to land. A coach who has earned a reward but
    // never opened checkout has no Stripe customer yet — leave the reward
    // pending and apply it the next time they come through here (the
    // referrals and upgrade pages both call this on load).
    if (!customerId) {
      return json({ applied: 0, pending: rewards.length, reason: "no_stripe_customer" });
    }

    // ── Apply ────────────────────────────────────────────────────────
    let applied = 0;
    let failed = 0;

    for (const reward of rewards) {
      const months = reward.months ?? 1;
      const amountCents = monthCents * months;

      try {
        const txn = await stripe.customers.createBalanceTransaction(
          customerId,
          {
            amount: -amountCents, // negative = credit the customer
            currency,
            description: `Billio referral reward — ${months} month${months === 1 ? "" : "s"} of Pro`,
            metadata: { reward_id: reward.id, coach_id: coach.id },
          },
          { idempotencyKey: `billio-referral-reward-${reward.id}` }
        );

        await supabase
          .from("referral_rewards")
          .update({
            status: "applied",
            applied_at: new Date().toISOString(),
            amount_cents: amountCents,
            currency,
            stripe_credit_txn_id: txn.id,
          })
          .eq("id", reward.id)
          .eq("status", "pending"); // don't stomp a concurrent apply

        applied += 1;
      } catch (err) {
        failed += 1;
        await supabase
          .from("referral_rewards")
          .update({ notes: `Apply failed: ${(err as Error).message}`.slice(0, 500) })
          .eq("id", reward.id);
      }
    }

    if (applied > 0) {
      await supabase.from("notifications").insert({
        profile_id: coach.profile_id,
        title: applied === 1 ? "Your free month is applied" : `${applied} free months applied`,
        message:
          "Your referral reward is now credited to your Billio account — it comes off your next Pro bill automatically.",
        type: "referral_reward_applied",
        is_read: false,
      });
    }

    return json({ applied, failed, pending: rewards.length - applied });
  } catch (err) {
    return json({ error: (err as Error).message ?? "Something went wrong." }, 500);
  }
});
