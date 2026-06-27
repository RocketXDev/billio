import { useEffect, useState } from "react";
import {
  FaCog,
  FaCrown,
  FaUser,
  FaHeadset,
  FaInfoCircle,
  FaShieldAlt,
  FaChevronRight,
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaArrowLeft,
  FaLock,
  FaThumbtack,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import "./More.css";
import { useNavigate } from "react-router-dom";
import { usePlan } from "../../hooks/usePlan";
import { useDashboardWidgets } from "../../hooks/useDashboardWidgets";
import { getDashboardTools } from "../../lib/dashboardTools";
import { useLessonTerm } from "../../hooks/useLessonTerm";

export default function More() {
  const navigate = useNavigate();
  const { isPro, isFree, planLoading } = usePlan();
  const { pinned, togglePinned, widgetsLoading } = useDashboardWidgets();
  const term = useLessonTerm();
  const DASHBOARD_TOOLS = getDashboardTools(term);

  const [showMoreTutorial, setShowMoreTutorial] = useState(false);
  const [moreTutorialStep, setMoreTutorialStep] = useState(0);
  const moreTutorialSteps = [
    {
      icon: "✨",
      title: "More Tools & Settings",
      text: `This page gives you quick access to extra Billio tools, account options, and support links — things that don't fit directly into ${term.plural}, Students, or Invoices. Some tools are free; others need Pro.`,
      target: "none",
    },
    {
      icon: "🛠️",
      title: "Coaching Tools",
      text: `Extra features to manage your work faster: Recurring and Group ${term.lowerPlural} for repeating or multi-student scheduling, an Earnings Dashboard and live ${term.lower} Timer, branded PDF Invoices, and an AI Assistant that can create ${term.lowerPlural} and invoices just by chatting.`,
      target: "coaching",
    },
    {
      icon: "👤",
      title: "Account Options",
      text: "Manage your Billio account here — upgrade to Pro or review your subscription, and adjust your profile or app settings.",
      target: "account",
    },
    {
      icon: "💬",
      title: "Help & Information",
      text: "Find support and important info here — contact Support if you need help, or visit About Billio, Privacy Policy, and other pages.",
      target: "help",
    },
  ];

  const currentMoreTutorialStep = moreTutorialSteps[moreTutorialStep];

  useEffect(() => {
    if (!planLoading) {
      const seen = localStorage.getItem("billio_more_tutorial_seen");
      if (!seen) {
        const timer = window.setTimeout(() => setShowMoreTutorial(true), 500);
        return () => window.clearTimeout(timer);
      }
    }
  }, [planLoading]);

  function dismissMoreTutorial() {
    localStorage.setItem("billio_more_tutorial_seen", "1");
    setShowMoreTutorial(false);
    setMoreTutorialStep(0);
  }

  function advanceMoreTutorial() {
    if (moreTutorialStep < moreTutorialSteps.length - 1) {
      setMoreTutorialStep((prev) => prev + 1);
    } else {
      dismissMoreTutorial();
    }
  }

  function backMoreTutorial() {
    if (moreTutorialStep > 0) {
      setMoreTutorialStep((prev) => prev - 1);
    }
  }

  if (planLoading || widgetsLoading) {
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
    <div className="more-page">

      <div className="more-header">
        <div className="more-header logo-wrapper">
          <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <img src="/logo.png" alt="Billio" />
        </div>
        <h1>More</h1>
        <p>Extra tools, account settings, and support.</p>
      </div>

      {/* ── Coaching Tools ── */}
      <section className="more-section">
        <h2>Coaching Tools</h2>
        <div className="more-grid">
          {DASHBOARD_TOOLS.map(({ slug, icon, title, desc, free, comingSoon, comingSoonReason }) => {
            const locked = !free && !isPro;
            const isPinned = pinned.includes(slug);

            if (comingSoon) {
              return (
                <div
                  key={slug}
                  className="more-card more-card-locked more-card-coming-soon"
                  title={comingSoonReason || "Currently unavailable."}
                >
                  <div className="more-icon more-icon-locked">{icon}</div>
                  <div><h3>{title}</h3><p>{desc}</p></div>
                  <span className="pro-only-bubble" style={{ position: "static", transform: "none" }}>
                    Currently unavailable
                  </span>
                </div>
              );
            }

            const pinBtn = isPro && (
              <button
                type="button"
                className={`more-pin-btn${isPinned ? " active" : ""}`}
                title={isPinned ? "Remove from Dashboard" : "Add to Dashboard"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePinned(slug);
                }}
              >
                <FaThumbtack />
              </button>
            );

            if (locked) {
              return (
                <div key={slug} className="more-card more-card-locked">
                  <div className="more-icon more-icon-locked">{icon}</div>
                  <div><h3>{title}</h3><p>{desc}</p></div>
                  <span className="pro-only-bubble" style={{ position: "static", transform: "none" }}>
                    <FaLock style={{ fontSize: 8 }} /> Pro only
                  </span>
                </div>
              );
            }

            return (
              <Link key={slug} to={`/${slug}`} className={`more-card${isPro ? " pinnable" : ""}`}>
                <div className="more-icon">{icon}</div>
                <div><h3>{title}</h3><p>{desc}</p></div>
                {pinBtn}
                <FaChevronRight className="more-arrow" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Account ── */}
      <section className="more-section">
        <h2>Account</h2>
        <div className="more-list">
          {isFree && (
            <Link to="/upgrade" className="more-list-item more-upgrade-item">
              <FaCrown /><span>Upgrade to Pro</span><FaChevronRight />
            </Link>
          )}
          <Link to="/settings" className="more-list-item">
            <FaCog /><span>Settings</span><FaChevronRight />
          </Link>
          <Link to="/upgrade" className="more-list-item">
            <FaCrown /><span>Subscription</span><FaChevronRight />
          </Link>
          <Link to="/profile" className="more-list-item">
            <FaUser /><span>Profile</span><FaChevronRight />
          </Link>
        </div>
      </section>

      {/* ── Help ── */}
      <section className="more-section">
        <h2>Help</h2>
        <div className="more-list">
          <Link to="/support" className="more-list-item">
            <FaHeadset /><span>Support</span><FaChevronRight />
          </Link>
          <Link to="/about" className="more-list-item">
            <FaInfoCircle /><span>About Billio</span><FaChevronRight />
          </Link>
          <Link to="/privacy" className="more-list-item">
            <FaShieldAlt /><span>Privacy Policy</span><FaChevronRight />
          </Link>
        </div>
      </section>

      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate("/dashboard")}><FaHome /><span>Dashboard</span></div>
        <div className="nav-item" onClick={() => navigate("/lessons")}><FaCalendarAlt /><span>{term.plural}</span></div>
        <div className="nav-item" onClick={() => navigate("/students")}><FaUsers /><span>Students</span></div>
        <div className="nav-item" onClick={() => navigate("/invoices")}><FaFileInvoiceDollar /><span>Invoices</span></div>
        <div className="nav-item active" onClick={() => navigate("/more")}><FaEllipsisH /><span>More</span></div>
      </nav>

      {showMoreTutorial && (
        <>
          <div className="more-tutorial-overlay" />

          <div className="more-tutorial-card">
            <div className="more-tutorial-icon-wrap">{currentMoreTutorialStep.icon}</div>
            <h2 className="more-tutorial-title">{currentMoreTutorialStep.title}</h2>
            <p className="more-tutorial-text">{currentMoreTutorialStep.text}</p>

            <div className="more-tutorial-dots">
              {moreTutorialSteps.map((_, index) => (
                <span
                  key={index}
                  className={`more-tutorial-dot${index === moreTutorialStep ? " active" : ""}`}
                />
              ))}
            </div>

            <div className="more-tutorial-actions">
              {moreTutorialStep > 0 && (
                <button
                  type="button"
                  className="more-tutorial-btn-secondary"
                  onClick={backMoreTutorial}
                >
                  Back
                </button>
              )}

              <button
                type="button"
                className="more-tutorial-btn-primary"
                onClick={advanceMoreTutorial}
              >
                {moreTutorialStep === moreTutorialSteps.length - 1 ? "Finish" : "Next →"}
              </button>
            </div>

            <button
              type="button"
              className="more-tutorial-btn-skip"
              onClick={dismissMoreTutorial}
            >
              Skip tutorial
            </button>
          </div>
        </>
      )}
    </div>
  );
}
