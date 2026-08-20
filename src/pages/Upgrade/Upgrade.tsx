// src/pages/Upgrade.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { usePlan } from "../../hooks/usePlan";
import {
  FaCrown,
  FaCheck,
  FaArrowLeft,
  FaInfinity,
  FaMobileAlt,
  FaCalendarCheck,
  FaBolt,
  FaPaperPlane,
  FaSms,
  FaCalendarWeek,
  FaCalendarAlt,
  FaClock,
  FaChartLine,
  FaFilePdf,
  FaRobot,
  FaPlus,
  FaHome,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
} from "react-icons/fa";
import "./Upgrade.css"

const STRIPE_PRICE_ID = "price_1TfMTxAuitLEKeV99TEkxqSp";
const PRO_PRICE = "$9.99";
const TRIAL_DAYS = 30;

const PRO_FEATURES = [
  { icon: <FaInfinity />, text: "Unlimited active students" },
  { icon: <FaCalendarCheck />, text: "Full lesson scheduling" },
  { icon: <FaBolt />, text: "Automated invoice generation" },
  { icon: <FaPaperPlane />, text: "Automated invoice sending and review" },
  { icon: <FaMobileAlt />, text: "Email & SMS invoice sending" },
  { icon: <FaSms />, text: "Text message reminders" },
  { icon: <FaCalendarWeek />, text: "Weekly billing workflow" },
  { icon: <FaCalendarAlt />, text: "Unlimited calendar navigation" },
  { icon: <FaClock />, text: "Live Timer" },
  { icon: <FaChartLine />, text: "Earnings dashboard" },
  { icon: <FaFilePdf />, text: "Custom PDF invoice generator" },
  { icon: <FaRobot />, text: "AI Assistant for lessons & invoices" },
];

const FREE_FEATURES = [
  "Up to 5 active students",
  "Manual lesson tracking",
  "Manual invoice generation",
  "Email invoice sending",
  "Current month day-to-day calendar",
];

function Upgrade() {
  const navigate = useNavigate();
  const { isPro, planLoading } = usePlan();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [coachName, setCoachName] = useState("");
  const [trialEligible, setTrialEligible] = useState(false);
  const [trialLoading, setTrialLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [subscriptionPeriodEnd, setSubscriptionPeriodEnd] = useState<string | null>(null);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState<string | null>(null);

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

  useEffect(() => {
    async function loadCoach() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) return;

        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("user_id", user.id)
          .single();

        if (profileData?.full_name) {
          setCoachName(profileData.full_name.split(" ")[0]);
        }

        if (profileData?.id) {
          const { data: coachData } = await supabase
            .from("coaches")
            .select("trial_used, trial_end, subscription_status, subscription_period_end, stripe_subscription_id")
            .eq("profile_id", profileData.id)
            .single();

          setTrialEligible(coachData ? !coachData.trial_used : false);
          setTrialEnd(coachData?.trial_end ?? null);
          setSubscriptionStatus(coachData?.subscription_status ?? null);
          setSubscriptionPeriodEnd(coachData?.subscription_period_end ?? null);
          setStripeSubscriptionId(coachData?.stripe_subscription_id ?? null);
        }
      } finally {
        setTrialLoading(false);
      }
    }
    loadCoach();
  }, []);

  async function handleUpgrade() {
    setLoading(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { navigate("/login"); return; }
      const { data, error: fnError } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: {
            priceId: STRIPE_PRICE_ID,
            successUrl: `${window.location.origin}/dashboard?upgraded=1`,
            cancelUrl: `${window.location.origin}/upgrade`,
          },
        }
      );
      if (fnError || data?.error) {
        setError(data?.error ?? fnError?.message ?? "Something went wrong. Please try again.");
        return;
      }
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelSubscription() {
    setCancelLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription");
      console.log("Cancel response:", data, error);
      if (error) {
        alert(`Function error: ${error.message}`);
        return;
      }
      if (data?.error) {
        alert(`Stripe error: ${data.error}`);
        return;
      }
      setCancelConfirm(false);
      setCancelSuccess(true);
    } catch (err: any) {
      alert(`Caught error: ${err.message}`);
    } finally {
      setCancelLoading(false);
    }
  }

  // Trial takes priority over a billing-period countdown whenever it's still
  // running — a trialing coach may not have subscription_status/period_end
  // populated yet (no first invoice has happened).
  const trialEndDate = trialEnd ? new Date(trialEnd) : null;
  const isTrialing = !!trialEndDate && trialEndDate.getTime() > Date.now();
  const periodEndDate = subscriptionPeriodEnd ? new Date(subscriptionPeriodEnd) : null;

  // A comped account (Pro, but no real Stripe subscription behind it) has no
  // subscription_status of its own — it's granted manually — so it needs its
  // own branch here rather than relying on the "active" check below, which
  // only ever gets set by the Stripe webhook.
  const isComped = !stripeSubscriptionId && !!periodEndDate;

  const countdown = isTrialing && trialEndDate
    ? { label: "Trial ends", date: trialEndDate }
    : subscriptionStatus === "active" && periodEndDate
    ? { label: cancelSuccess ? "Pro access ends" : "Renews", date: periodEndDate }
    : isComped
    ? { label: "Pro access ends", date: periodEndDate! }
    : null;

  const daysUntil = (date: Date) =>
    Math.max(0, Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  const formatCountdownDate = (date: Date) =>
    date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  if (planLoading || trialLoading) {
    return (
      <div className="loading-screen">
        <div className="billio-loader">
          <div className="billio-loader-glow" />
          <img className="billio-loader-logo" src="/logo.png" alt="Billio" />
        </div>
      </div>
    );
  }

  return (
    <div className="up-page">
      {/* Header */}
      <div className="up-header">
        <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <img src="/logo.png" alt="Billio" className="up-logo" />
      </div>

      <div className="up-body">
        {/* Hero */}
        <div className="up-hero">
          <h1 className="up-title">
            {isPro
              ? "You're on Pro!"
              : trialEligible
              ? coachName
                ? `Try Pro free for ${TRIAL_DAYS} days, ${coachName}`
                : `Try Pro free for ${TRIAL_DAYS} days`
              : coachName
              ? `Upgrade your coaching, ${coachName}`
              : "Upgrade to Pro"}
          </h1>
          <p className="up-subtitle">
            {isPro
              ? "You have full access to every Billio feature."
              : "Everything you need to run a professional coaching practice."}
          </p>
        </div>

        {/* Already Pro */}
        {isPro && (
          <div className="up-already-pro">
            <FaCheck />
            {isTrialing ? "Free trial active" : "Active Pro subscription"}
          </div>
        )}

        {/* Renewal / trial countdown */}
        {isPro && countdown && (
          <div className="up-countdown">
            <FaClock className="up-countdown-icon" />
            <div className="up-countdown-text">
              <strong>
                {(() => {
                  const days = daysUntil(countdown.date);
                  if (days === 0) return "Today";
                  if (days === 1) return "1 day left";
                  return `${days} days left`;
                })()}
              </strong>
              <span>{countdown.label} on {formatCountdownDate(countdown.date)}</span>
            </div>
          </div>
        )}

        {/* Plan Cards */}
        {!isPro && (
          <div className="up-cards">
            {/* Free */}
            <div className="up-card up-free-card">
              <div className="up-card-label">Free</div>
              <div className="up-card-price">
                <strong>$0</strong>
                <span>/ mo</span>
              </div>
              <ul className="up-feature-list">
                {FREE_FEATURES.map((f) => (
                  <li key={f}>
                    <span className="up-feat-icon up-feat-no"><FaPlus /></span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="up-card up-pro-card">
              <div className="up-pro-badge">
                <FaCrown style={{ fontSize: 10, marginRight: 4 }} /> Pro
              </div>
              <div className="up-card-label up-pro-label">Pro</div>
              <div className="up-card-price">
                <strong className="up-pro-price-num">{PRO_PRICE}</strong>
                <span className="up-pro-price-period">/ mo</span>
              </div>
              {trialEligible && (
                <div className="up-trial-note">
                  First {TRIAL_DAYS} days free
                </div>
              )}
              <ul className="up-feature-list up-pro-list">
                {PRO_FEATURES.map((f) => (
                  <li key={f.text}>
                    <span className="up-feat-icon up-feat-yes">{f.icon}</span>
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* CTA */}
        {!isPro && (
          <div className="up-cta">
            {error && <div className="up-error">{error}</div>}

            <button
              type="button"
              className="up-main-btn"
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? (
                <span className="up-btn-loading">
                  <span className="up-spinner" /> Connecting to Stripe...
                </span>
              ) : trialEligible ? (
                <>
                  <FaCrown style={{ fontSize: 13, marginRight: 8 }} />
                  Start {TRIAL_DAYS}-day free trial
                </>
              ) : (
                <>
                  <FaCrown style={{ fontSize: 13, marginRight: 8 }} />
                  Upgrade to Pro — {PRO_PRICE}/mo
                </>
              )}
            </button>

            <div className="up-trust">
              <span>🔒 Secured by Stripe</span>
              <span>·</span>
              {trialEligible ? (
                <>
                  <span>{TRIAL_DAYS} days free</span>
                  <span>·</span>
                </>
              ) : null}
              <span>Cancel anytime</span>
              <span>·</span>
              <span>No hidden fees</span>
            </div>

            <p className="up-disclaimer">
              {trialEligible ? (
                <>
                  Free for {TRIAL_DAYS} days, then {PRO_PRICE}/mo. Cancel anytime
                  before the trial ends and you won't be charged.{" "}
                </>
              ) : (
                <>Subscription renews monthly. </>
              )}
              By upgrading you agree to our{" "}
              <a href="/terms" target="_blank" rel="noreferrer">Terms</a>.
            </p>
          </div>
        )}

        {/* Manage */}
        {isPro && (
          <div className="up-manage">
            <FaCrown className="up-manage-icon" />
            <h3>You're on Pro</h3>
            <p>
              {isTrialing && trialEndDate ? (
                <>Your free trial ends on {formatCountdownDate(trialEndDate)}. You'll then be billed {PRO_PRICE}/mo unless you cancel first.</>
              ) : cancelSuccess && periodEndDate ? (
                <>Your Pro access ends on {formatCountdownDate(periodEndDate)}.</>
              ) : isComped ? (
                <>Your Pro access ends on {formatCountdownDate(periodEndDate!)}.</>
              ) : (
                <>Your subscription renews monthly. Cancel anytime — you keep Pro access until the end of your billing period.</>
              )}
            </p>

            {cancelSuccess ? (
              <div className="cancel-success-banner">
                Cancelled. You keep Pro access until your billing period ends.
              </div>
            ) : cancelConfirm ? (
              <div className="cancel-confirm-card">
                <p>Are you sure? You'll lose Pro features at the end of your billing period.</p>
                <div className="billio-confirm-actions">
                  <button type="button" className="billio-cancel-btn pro"
                    onClick={() => setCancelConfirm(false)}>
                    Keep Pro
                  </button>
                  <button type="button" className="billio-danger-btn pro"
                    disabled={cancelLoading} onClick={handleCancelSubscription}>
                    {cancelLoading ? "Cancelling..." : "Yes, cancel"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button type="button" className="up-portal-btn"
                  onClick={() => navigate("/dashboard")}>
                  Back to Dashboard
                </button>
                {/* No real Stripe subscription behind a comped account, so
                    there's nothing for cancel-subscription to act on. */}
                {!isComped && (
                  <button type="button" className="up-cancel-btn"
                    onClick={() => setCancelConfirm(true)}>
                    Cancel subscription
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate("/dashboard")}><FaHome /><span>Dashboard</span></div>
        <div className="nav-item" onClick={() => navigate("/lessons")}><FaCalendarAlt /><span>Lessons</span></div>
        <div className="nav-item" onClick={() => navigate("/students")}><FaUsers /><span>Students</span></div>
        <div className="nav-item" onClick={() => navigate("/invoices")}><FaFileInvoiceDollar /><span>Invoices</span></div>
        <div className="nav-item" onClick={() => navigate("/more")}><FaEllipsisH /><span>More</span></div>
      </nav>
    </div>
  );
}

export default Upgrade;