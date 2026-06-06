// src/pages/Upgrade.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { usePlan } from "../hooks/usePlan";
import {
  FaCrown,
  FaCheck,
  FaArrowLeft,
  FaInfinity,
  FaMobileAlt,
  FaUserFriends,
  FaBolt,
  FaCalendarAlt,
  FaHome,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaTimes,
} from "react-icons/fa";
import "../upgrade.css"

const STRIPE_PRICE_ID = "price_1TcrFUAuitLEKeV91KBoNCJ6";
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

  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelSuccess, setCancelSuccess] = useState(false);

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
            Active Pro subscription
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
                    <span className="up-feat-icon up-feat-no">+</span>
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
              <span>Cancel anytime</span>
              <span>·</span>
              <span>No hidden fees</span>
            </div>

            <p className="up-disclaimer">
              By upgrading you agree to our{" "}
              <a href="/terms" target="_blank" rel="noreferrer">Terms</a>.
              Subscription renews monthly.
            </p>
          </div>
        )}

        {/* Manage */}
        {isPro && (
          <div className="up-manage">
            <FaCrown className="up-manage-icon" />
            <h3>You're on Pro</h3>
            <p>Your subscription renews monthly. Cancel anytime — you keep Pro access until the end of your billing period.</p>

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
                <button type="button" className="up-cancel-btn"
                  onClick={() => setCancelConfirm(true)}>
                  Cancel subscription
                </button>
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
        <div className="nav-item active" onClick={() => navigate("/more")}><FaEllipsisH /><span>More</span></div>
      </nav>
    </div>
  );
}

export default Upgrade;
