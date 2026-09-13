import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaCheck,
  FaCopy,
  FaShareAlt,
  FaGift,
  FaUserPlus,
  FaCreditCard,
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaHourglassHalf,
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { useReferrals, applyReferralRewards } from "../../hooks/useReferrals";
import { buildReferralLink } from "../../lib/referral";
import "./Referrals.css";

function Referrals() {
  const navigate = useNavigate();
  const { summary, activity, referralsLoading, refetchReferrals } = useReferrals();

  const [copied, setCopied] = useState(false);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState(false);

  const link = summary.code ? buildReferralLink(summary.code) : "";
  const perReward = summary.referralsPerReward;

  // Rewards are minted by the database the moment the third referral
  // qualifies, but the money only moves when something calls the Stripe side.
  // Doing it on page load means a coach who earned a month while away sees it
  // land the next time they look, without needing a webhook round trip.
  useEffect(() => {
    if (referralsLoading || summary.rewardsPending === 0) return;
    let cancelled = false;
    applyReferralRewards().then((result) => {
      if (!cancelled && result.applied > 0) refetchReferrals();
    });
    return () => {
      cancelled = true;
    };
  }, [referralsLoading, summary.rewardsPending, refetchReferrals]);

  useEffect(() => {
    async function loadBilling() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (!profileData?.id) return;

      const { data: coachData } = await supabase
        .from("coaches")
        .select("trial_end, stripe_subscription_id")
        .eq("profile_id", profileData.id)
        .single();

      setTrialEnd(coachData?.trial_end ?? null);
      setHasSubscription(!!coachData?.stripe_subscription_id);
    }
    loadBilling();
  }, []);

  const trialEndDate = trialEnd ? new Date(trialEnd) : null;
  const isTrialing = !!trialEndDate && trialEndDate.getTime() > Date.now();

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // clipboard API needs a secure context and a user gesture it trusts —
      // fall back to the old selection trick rather than failing silently.
      const field = document.createElement("textarea");
      field.value = link;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      document.body.removeChild(field);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Billio",
          text: "I use Billio to schedule lessons and send invoices — it's saved me hours of admin. Start with a free 30-day Pro trial:",
          url: link,
        });
        return;
      } catch {
        // Share sheet dismissed — nothing to report.
      }
    }
    handleCopy();
  }

  if (referralsLoading) {
    return (
      <div className="loading-screen">
        <div className="billio-loader">
          <div className="billio-loader-glow" />
          <img className="billio-loader-logo" src="/logo.png" alt="Billio" />
        </div>
      </div>
    );
  }

  // Which bill the earned month comes off, in the coach's own terms.
  const rewardCopy = isTrialing
    ? "It comes off your first bill once your free trial ends — so your first paid month is $0."
    : hasSubscription
    ? "It comes off your next monthly bill automatically."
    : "It's saved to your account and comes off your first bill when you start Pro.";

  return (
    <div className="ref-page">
      <div className="ref-header">
        <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <img src="/logo.png" alt="Billio" className="ref-logo" />
      </div>

      <div className="ref-body">
        {/* Hero */}
        <div className="ref-hero">
          <div className="ref-hero-icon"><FaGift /></div>
          <h1 className="ref-title">Invite {perReward}, get a month free</h1>
          <p className="ref-subtitle">
            When {perReward} coaches you invite start their Billio Pro trial, we waive a
            full month of Pro for you — {perReward} more and you get another.
          </p>
        </div>

        {/* Progress */}
        <div className="ref-card ref-progress-card">
          <div className="ref-progress-head">
            <span className="ref-progress-count">
              {summary.progress}<span>/{perReward}</span>
            </span>
            <p>
              {summary.qualified === 0
                ? `No invites have started Pro yet — ${perReward} of them earns you a free month.`
                : summary.progress === 0
                ? `${summary.qualified} joined so far. ${perReward} more earns another free month.`
                : summary.remaining === 1
                ? "One more and your next month of Pro is free."
                : `${summary.remaining} more to go until your next free month.`}
            </p>
          </div>

          <div className="ref-progress-track">
            {Array.from({ length: perReward }).map((_, i) => (
              <span
                key={i}
                className={`ref-progress-step${i < summary.progress ? " filled" : ""}`}
              />
            ))}
          </div>

          <div className="ref-stats">
            <div className="ref-stat">
              <strong>{summary.invited}</strong>
              <span>Invited</span>
            </div>
            <div className="ref-stat">
              <strong>{summary.qualified}</strong>
              <span>Started Pro</span>
            </div>
            <div className="ref-stat">
              <strong>{summary.rewardsTotal}</strong>
              <span>{summary.rewardsTotal === 1 ? "Free month" : "Free months"}</span>
            </div>
          </div>
        </div>

        {/* Share */}
        <div className="ref-card ref-share-card">
          <h2 className="ref-card-title">Your invite link</h2>
          <div className="ref-link-row">
            <span className="ref-link">{link}</span>
            <button
              type="button"
              className={`ref-copy-btn${copied ? " copied" : ""}`}
              onClick={handleCopy}
              aria-label="Copy invite link"
            >
              {copied ? <FaCheck /> : <FaCopy />}
            </button>
          </div>

          <button type="button" className="ref-share-btn" onClick={handleShare}>
            <FaShareAlt /> Share your link
          </button>

          <p className="ref-code-note">
            Or share your code: <strong>{summary.code}</strong>
          </p>
        </div>

        {/* Rewards earned */}
        {summary.rewardsTotal > 0 && (
          <div className="ref-card ref-reward-card">
            <div className="ref-reward-icon"><FaGift /></div>
            <div>
              <h2 className="ref-card-title">
                {summary.rewardsTotal === 1
                  ? "1 free month earned"
                  : `${summary.rewardsTotal} free months earned`}
              </h2>
              <p className="ref-reward-text">{rewardCopy}</p>
              {summary.rewardsPending > 0 && (
                <span className="ref-reward-chip">
                  <FaHourglassHalf /> {summary.rewardsPending} being applied
                </span>
              )}
              {summary.rewardsApplied > 0 && (
                <span className="ref-reward-chip applied">
                  <FaCheck /> {summary.rewardsApplied} credited
                </span>
              )}
            </div>
          </div>
        )}

        {/* Activity */}
        {activity.length > 0 && (
          <div className="ref-card">
            <h2 className="ref-card-title">Your invites</h2>
            <ul className="ref-activity">
              {activity.map((item) => (
                <li key={item.id}>
                  <span className={`ref-activity-dot ${item.status}`} />
                  <div className="ref-activity-info">
                    <strong>{item.name}</strong>
                    <span>
                      {item.status === "qualified"
                        ? "Started Pro — counted"
                        : "Signed up — counts once they start Pro"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* How it works */}
        <div className="ref-card">
          <h2 className="ref-card-title">How it works</h2>
          <ol className="ref-steps">
            <li>
              <span className="ref-step-icon"><FaShareAlt /></span>
              <div>
                <strong>Share your link</strong>
                <p>Send it to coaches, tutors, or instructors you know.</p>
              </div>
            </li>
            <li>
              <span className="ref-step-icon"><FaUserPlus /></span>
              <div>
                <strong>They start their Pro trial</strong>
                <p>They get the usual free 30-day trial. Their sign-up counts once the trial starts.</p>
              </div>
            </li>
            <li>
              <span className="ref-step-icon"><FaCreditCard /></span>
              <div>
                <strong>Your month is on us</strong>
                <p>Every {perReward}th one waives a full month of Pro — applied to your bill automatically.</p>
              </div>
            </li>
          </ol>
        </div>

        <p className="ref-fineprint">
          Invites count when the person you referred starts a Billio Pro trial with a
          valid payment method. Referring yourself or an existing subscriber doesn't
          count. Free months apply as account credit toward your Pro subscription.
        </p>
      </div>

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

export default Referrals;
