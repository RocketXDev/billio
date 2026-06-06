import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { usePlan } from "../hooks/usePlan";
import {
  FaCrown,
  FaCheck,
  FaLock,
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaArrowLeft,
  FaBolt,
  FaInfinity,
  FaMobileAlt,
  FaUserFriends,
} from "react-icons/fa";
import "../upgrade.css"

const STRIPE_PRICE_ID = "price_1TfMTxAuitLEKeV99TEkxqSp";
const PRO_PRICE = "$9.99";

const PRO_FEATURES = [
  { icon: <FaInfinity />, text: "Unlimited active students" },
  { icon: <FaCalendarAlt />, text: "Unlimited calendar navigation" },
  { icon: <FaMobileAlt />, text: "SMS & text invoice delivery" },
  { icon: <FaUserFriends />, text: "Full parent contact profiles" },
  { icon: <FaBolt />, text: "Automated invoice generation" },
  { icon: <FaCheck />, text: "Priority support" },
];

const FREE_FEATURES = [
  "Up to 5 active students",
  "Current month calendar only",
  "Email invoices only",
  "Basic student profiles",
  "Manual invoice creation",
];

function Upgrade() {
  const navigate = useNavigate();
  const { isPro, planLoading } = usePlan();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [coachName, setCoachName] = useState("");

  useEffect(() => {
    async function loadName() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .single();

      if (profileData?.full_name) {
        setCoachName(profileData.full_name.split(" ")[0]);
      }
    }
    loadName();
  }, []);

  async function handleUpgrade() {
    setLoading(true);
    setError("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate("/login");
        return;
      }

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
        setError(
          data?.error ?? fnError?.message ?? "Something went wrong. Please try again."
        );
        return;
      }

      // Redirect to Stripe Checkout hosted page
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (planLoading) {
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
    <div className="upgrade-page">
      <div className="upgrade-wrapper">

        {/* ── Header ── */}
        <div className="upgrade-header">
          <button
            type="button"
            className="upgrade-back-btn"
            onClick={() => navigate(-1)}
          >
            <FaArrowLeft />
          </button>
          <img src="/logo.png" alt="Billio" className="upgrade-logo" />
          <div style={{ width: 36 }} />
        </div>

        {/* ── Hero ── */}
        <div className="upgrade-hero">
          <div className="upgrade-crown-wrap">
            <FaCrown className="upgrade-crown" />
          </div>

          <h1 className="upgrade-title">
            {isPro
              ? "You're on Pro 🎉"
              : coachName
              ? `Upgrade your coaching, ${coachName}`
              : "Upgrade to Pro"}
          </h1>

          <p className="upgrade-subtitle">
            {isPro
              ? "You have full access to every Billio feature."
              : "Everything you need to run a professional coaching practice."}
          </p>

          {isPro && (
            <div className="upgrade-already-pro">
              <FaCheck /> Active subscription
            </div>
          )}
        </div>

        {/* ── Comparison cards ── */}
        {!isPro && (
          <div className="upgrade-cards">

            {/* Free card */}
            <div className="upgrade-plan-card upgrade-free-card">
              <div className="upgrade-plan-header">
                <span className="upgrade-plan-label">Free</span>
                <strong className="upgrade-plan-price">$0</strong>
                <span className="upgrade-plan-period">forever</span>
              </div>
              <ul className="upgrade-feature-list upgrade-free-list">
                {FREE_FEATURES.map((f) => (
                  <li key={f}>
                    <span className="upgrade-feature-icon free-icon">✕</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro card */}
            <div className="upgrade-plan-card upgrade-pro-card">
              <div className="upgrade-popular-badge">
                <FaCrown style={{ fontSize: 10, marginRight: 4 }} />
                Pro
              </div>

              <div className="upgrade-plan-header">
                <span className="upgrade-plan-label upgrade-pro-label">Pro</span>
                <strong className="upgrade-plan-price upgrade-pro-price">{PRO_PRICE}</strong>
                <span className="upgrade-plan-period">/ month</span>
              </div>

              <ul className="upgrade-feature-list upgrade-pro-list">
                {PRO_FEATURES.map((f) => (
                  <li key={f.text}>
                    <span className="upgrade-feature-icon pro-icon">{f.icon}</span>
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        )}

        {/* ── CTA ── */}
        {!isPro && (
          <div className="upgrade-cta-section">
            {error && (
              <div className="upgrade-error">
                {error}
              </div>
            )}

            <button
              type="button"
              className="upgrade-main-btn"
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? (
                <span className="upgrade-btn-loading">
                  <span className="upgrade-spinner" />
                  Connecting to Stripe...
                </span>
              ) : (
                <>
                  <FaCrown style={{ fontSize: 14, marginRight: 8 }} />
                  Upgrade to Pro — {PRO_PRICE}/mo
                </>
              )}
            </button>

            <div className="upgrade-trust-row">
              <span><FaLock style={{ fontSize: 10 }} /> Secured by Stripe</span>
              <span>Cancel anytime</span>
              <span>No hidden fees</span>
            </div>

            <p className="upgrade-disclaimer">
              By upgrading you agree to our{" "}
              <a href="/terms" target="_blank" rel="noreferrer">Terms</a>.
              Subscription renews monthly. Cancel anytime from your profile.
            </p>
          </div>
        )}

        {/* ── Already pro: manage subscription ── */}
        {isPro && (
          <div className="upgrade-manage-section">
            <div className="upgrade-manage-card">
              <FaCrown className="upgrade-manage-icon" />
              <h3>Manage your subscription</h3>
              <p>
                To cancel or change your plan, contact us or visit the Stripe
                customer portal.
              </p>
              <button
                type="button"
                className="upgrade-portal-btn"
                onClick={() => navigate("/dashboard")}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Bottom nav ── */}
      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate("/dashboard")}>
          <FaHome />
          <span>Dashboard</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/lessons")}>
          <FaCalendarAlt />
          <span>Lessons</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/students")}>
          <FaUsers />
          <span>Students</span>
        </div>
        <div className="nav-item" onClick={() => navigate("/invoices")}>
          <FaFileInvoiceDollar />
          <span>Invoices</span>
        </div>
        <div className="nav-item active" onClick={() => navigate("/more")}>
          <FaEllipsisH />
          <span>More</span>
        </div>
      </nav>
    </div>
  );
}

export default Upgrade;
