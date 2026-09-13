import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// "trialing" gets full pro access, same as "active"
function isProStatus(status: string) {
  return status === "active" || status === "trialing";
}

// Stripe API versions >= 2025-03-31 moved current_period_end off the
// top-level Subscription object onto each subscription item. Our client is
// pinned to the old "2023-10-16" shape (see `apiVersion` above), but that pin
// only governs requests WE make — it does nothing for the shape of incoming
// webhook payloads, which is set by the webhook endpoint's own API version in
// the Stripe Dashboard. So `event.data.object.current_period_end` can be
// `undefined` even though our pinned retrieve() calls always return it. Read
// it defensively and fall back to the subscription item.
function currentPeriodEnd(subscription: Stripe.Subscription): number | null {
  const topLevel = (subscription as unknown as { current_period_end?: number })
    .current_period_end;
  if (typeof topLevel === "number") return topLevel;

  const itemLevel = subscription.items?.data?.[0]?.current_period_end as
    | number
    | undefined;
  return typeof itemLevel === "number" ? itemLevel : null;
}

serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log("Stripe webhook received:", event.type);

  try {
    switch (event.type) {

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.CheckoutSession;

        if (session.mode !== "subscription") break;

        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Fresh retrieve (not the raw event payload) so we always get the
        // shape matching our pinned apiVersion.
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        const coachId = await upsertCoachPlan({
          customerId,
          subscriptionId,
          status: subscription.status,
          periodEnd: currentPeriodEnd(subscription),
          trialEnd: subscription.trial_end,
          plan: isProStatus(subscription.status) ? "pro" : "free",
        });

        // Referral credit — never fatal. The update above is what attaches
        // stripe_subscription_id, which is what qualifies a referral, so this
        // is the first moment a reward can be cashed in.
        await handleReferralRewards(coachId);

        // Welcome email — never fatal. Plan activation already succeeded.
        try {
          await sendWelcomeEmail({
            customerId,
            isTrial: subscription.status === "trialing",
            trialEnd: subscription.trial_end,
          });
        } catch (emailErr) {
          console.error("Welcome email failed (non-fatal):", emailErr);
        }

        break;
      }

      case "customer.subscription.updated": {
        // Re-retrieve instead of trusting event.data.object directly — see
        // currentPeriodEnd() above for why the raw payload isn't safe here.
        const eventSubscription = event.data.object as Stripe.Subscription;
        const subscription = await stripe.subscriptions.retrieve(eventSubscription.id);

        await upsertCoachPlan({
          customerId: subscription.customer as string,
          subscriptionId: subscription.id,
          status: subscription.status,
          periodEnd: currentPeriodEnd(subscription),
          trialEnd: subscription.trial_end,
          plan: isProStatus(subscription.status) ? "pro" : "free",
        });

        break;
      }

      case "customer.subscription.deleted": {
        const eventSubscription = event.data.object as Stripe.Subscription;

        // A canceled subscription is still retrievable, so prefer a fresh
        // fetch — but don't let that call block the downgrade if it fails,
        // since the coach must lose Pro access either way.
        let subscription: Stripe.Subscription = eventSubscription;
        try {
          subscription = await stripe.subscriptions.retrieve(eventSubscription.id);
        } catch (err) {
          console.error("Re-retrieve on subscription.deleted failed, using event payload:", err);
        }

        await upsertCoachPlan({
          customerId: subscription.customer as string,
          subscriptionId: subscription.id,
          status: "canceled",
          periodEnd: currentPeriodEnd(subscription),
          trialEnd: subscription.trial_end,
          plan: "free",
        });

        break;
      }

      case "customer.subscription.trial_will_end": {
        // Fires ~3 days before the trial ends and the card is charged.
        // Good place to send a heads-up email later.
        const subscription = event.data.object as Stripe.Subscription;
        console.log(
          `Trial ending soon for customer ${subscription.customer}, trial_end: ${subscription.trial_end}`
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;

        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription as string
        );

        await upsertCoachPlan({
          customerId: subscription.customer as string,
          subscriptionId: subscription.id,
          status: subscription.status,
          periodEnd: currentPeriodEnd(subscription),
          trialEnd: subscription.trial_end,
          plan: subscription.status === "canceled" ? "free" : "pro",
        });

        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response("Internal handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

async function upsertCoachPlan({
  customerId,
  subscriptionId,
  status,
  periodEnd,
  trialEnd,
  plan,
}: {
  customerId: string;
  subscriptionId: string;
  status: string;
  periodEnd: number | null;
  trialEnd: number | null;
  plan: "free" | "pro";
}): Promise<string> {
  const update: Record<string, unknown> = {
    plan,
    stripe_subscription_id: subscriptionId,
    subscription_status: status,
    // Guard against a missing/invalid periodEnd instead of letting
    // `new Date(NaN).toISOString()` throw — a crash here used to abort this
    // whole function before the update ran, so even `subscription_status`
    // silently never changed. Better to write what we have and log it.
    subscription_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    trial_end: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
  };

  if (periodEnd == null) {
    console.error(
      `No current_period_end available for customer ${customerId} (subscription ${subscriptionId}), status ${status} — writing null.`
    );
  }

  // Once a coach has ever been on a trial, lock it in so they can't trial again
  if (status === "trialing") {
    update.trial_used = true;
  }

  const { data, error } = await supabaseAdmin
    .from("coaches")
    .update(update)
    .eq("stripe_customer_id", customerId)
    .select("id");

  if (error) {
    console.error("Failed to update coach plan:", error);
    throw error;
  }

  // A 0-row match fails silently otherwise (Supabase update() doesn't error
  // on no matching rows) — surface it loudly instead of pretending it worked.
  if (!data || data.length === 0) {
    const msg = `No coach row found with stripe_customer_id=${customerId} — update matched 0 rows.`;
    console.error(msg);
    throw new Error(msg);
  }

  console.log(
    `Coach with customer ${customerId} → plan: ${plan}, status: ${status}`
  );

  // The caller needs this for the referral hook, which acts on coach ids
  // rather than Stripe customer ids.
  return data[0].id as string;
}

// ── Referral rewards ─────────────────────────────────────────────

// Hands one coach's earned-but-unapplied referral rewards to the
// apply-referral-rewards function, which turns each into Stripe customer
// credit against their next invoice.
async function applyReferralRewards(coachId: string) {
  const res = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/apply-referral-rewards`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ coachId }),
    }
  );

  const result = await res.json().catch(() => null);
  console.log(`Referral rewards for coach ${coachId}:`, result);
}

// Called once a new subscription exists. Two different coaches can have money
// owed to them at this moment:
//
//   1. The new subscriber. If they'd already earned free months while on the
//      free plan, this is the first time there's a Stripe customer for the
//      credit to land on.
//   2. Their referrer. The upsertCoachPlan() write is what sets
//      stripe_subscription_id, and the database trigger watching that column
//      is what marks this referral qualified — so if it was the referrer's
//      third, their reward row already exists by the time we get here.
//
// Deliberately swallows everything. A missed call costs nothing (the
// Referrals and Upgrade pages call the same function on load), whereas
// throwing would fail the webhook and make Stripe redeliver the event —
// re-running the welcome email with it.
async function handleReferralRewards(coachId: string) {
  try {
    await applyReferralRewards(coachId);

    const { data: referral, error } = await supabaseAdmin
      .from("referrals")
      .select("referrer_coach_id")
      .eq("referred_coach_id", coachId)
      .maybeSingle();

    if (error) {
      console.error("Referral lookup failed (non-fatal):", error);
      return;
    }

    if (referral?.referrer_coach_id) {
      await applyReferralRewards(referral.referrer_coach_id);
    }
  } catch (err) {
    console.error("Referral rewards failed (non-fatal):", err);
  }
}

// ── Welcome to Pro email ─────────────────────────────────────────

const PRO_FEATURES = [
  "Unlimited active students",
  "Unlimited calendar navigation",
  "SMS &amp; text invoice delivery",
  "Automated invoice generation",
  "Priority support",
];

function formatDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function sendWelcomeEmail({
  customerId,
  isTrial,
  trialEnd,
}: {
  customerId: string;
  isTrial: boolean;
  trialEnd: number | null;
}) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY not set — skipping welcome email");
    return;
  }

  // Look up the coach's profile for name + email
  const { data: coach } = await supabaseAdmin
    .from("coaches")
    .select("profile_id, visible_name")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!coach?.profile_id) {
    console.error("Welcome email: coach/profile not found for", customerId);
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email, full_name")
    .eq("id", coach.profile_id)
    .single();

  if (!profile?.email) {
    console.error("Welcome email: no email on profile for", customerId);
    return;
  }

  const firstName =
    (profile.full_name || coach.visible_name || "").split(" ")[0] || "Coach";

  const trialEndDate = isTrial && trialEnd ? formatDate(trialEnd) : null;

  const heroSubtitle = isTrial
    ? "Your 30-day free trial has started"
    : "Your Pro subscription is active";

  const introHtml = isTrial
    ? `You now have full access to everything Billio Pro offers — free until <strong style="color:#0F172A !important;">${trialEndDate}</strong>. Your first charge of $9.99 happens on that date, and you can cancel anytime before then from the Upgrade page without being charged.`
    : `You now have full access to everything Billio Pro offers. Your subscription renews monthly, and you can manage it anytime from the Upgrade page.`;

  const featuresHtml = PRO_FEATURES.map(
    (f) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td width="26" valign="top">
            <div style="width:18px;height:18px;border-radius:50%;background:#eef2ff !important;color:#5b3df5 !important;font-size:11px;font-weight:800;text-align:center;line-height:18px;">&#10003;</div>
          </td>
          <td style="font-size:14px;color:#0F172A !important;line-height:1.5;">${f}</td>
        </tr>
      </table>`
  ).join("");

  const html = `
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light only">

    <div style="margin:0;padding:40px 16px;background:#f5f7fb !important;font-family:Inter,Arial,sans-serif;color:#0F172A !important;color-scheme:light;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff !important;color:#0F172A !important;border-radius:30px;overflow:hidden;border:1px solid #ececf3;">

        <div style="background:linear-gradient(135deg,#5b3df5,#7c6cff);padding:34px 28px;text-align:center;">
          <h1 style="margin:0;color:#F8FAFC !important;font-size:30px;font-weight:800;">
            Welcome to Pro, ${firstName}! &#128081;
          </h1>
          <p style="margin:10px 0 0;color:#E0E7FF !important;font-size:15px;">
            ${heroSubtitle}
          </p>
        </div>

        <div style="padding:28px;background:#ffffff !important;color:#0F172A !important;">

          <p style="margin:0 0 24px;color:#0F172A !important;font-size:15px;line-height:1.7;">
            ${introHtml}
          </p>

          <div style="background:#eef2ff !important;border:1px solid #c7d2fe;border-radius:20px;padding:20px;margin-bottom:24px;color:#0F172A !important;">
            <div style="color:#64748B !important;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:14px;">
              What's included
            </div>
            ${featuresHtml}
          </div>

          ${
            trialEndDate
              ? `
          <div style="background:#f8fafc !important;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin-bottom:24px;text-align:center;">
            <span style="font-size:13px;color:#64748B !important;">
              Trial ends &amp; first charge: <strong style="color:#0F172A !important;">${trialEndDate}</strong> &middot; $9.99/mo after
            </span>
          </div>`
              : ""
          }

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">
            <tr>
              <td align="center">
                <a href="https://mybillioapp.com/dashboard"
                   style="display:inline-block;background:#5b3df5 !important;color:#ffffff !important;text-decoration:none;font-size:16px;font-weight:800;padding:14px 36px;border-radius:14px;">
                  Go to Dashboard
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:18px 0 0;color:#64748B !important;font-size:13px;line-height:1.6;text-align:center;">
            Questions? Just reply to this email — we're happy to help.
          </p>
        </div>
      </div>
    </div>
  `;

  const resend = new Resend(resendKey);

  const subject = isTrial
    ? "Your Billio Pro trial has started 🎉"
    : "Welcome to Billio Pro 🎉";

  const result = await resend.emails.send({
    from: "Billio <notifications@mail.mybillioapp.com>",
    to: profile.email,
    subject,
    html,
  });

  if (result.error) {
    console.error("Resend welcome email error:", result.error);
  } else {
    console.log(`Welcome email sent to ${profile.email} (trial: ${isTrial})`);
  }
}
