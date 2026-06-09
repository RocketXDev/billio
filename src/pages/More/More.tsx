import {
  FaClock,
  FaChartLine,
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
  FaRedoAlt,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import "./More.css";
import { useNavigate } from "react-router-dom";
import { usePlan } from "../../hooks/usePlan";

export default function More() {
  const navigate = useNavigate();
  const { isPro, isFree, planLoading, fullName } = usePlan();

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

  const proTools = [
    {
      slug: "earnings-dashboard",
      icon: <FaChartLine />,
      title: "Earnings Dashboard",
      desc: "Weekly summary, income totals, and lesson stats at a glance.",
    },
    {
      slug: "recurring-lessons",
      icon: <FaRedoAlt />,
      title: "Recurring Lessons",
      desc: "Schedule repeating lessons for students automatically.",
    },
  ];

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

          {/* Lesson Timer — free */}
          <Link to="/timer" className="more-card">
            <div className="more-icon"><FaClock /></div>
            <div>
              <h3>Lesson Timer</h3>
              <p>Start and stop a live timer while teaching a lesson.</p>
            </div>
            <FaChevronRight className="more-arrow" />
          </Link>

          {/* Pro tools */}
          {proTools.map(({ slug, icon, title, desc }) =>
            isPro ? (
              <Link key={slug} to={`/${slug}`} className="more-card">
                <div className="more-icon">{icon}</div>
                <div><h3>{title}</h3><p>{desc}</p></div>
                <FaChevronRight className="more-arrow" />
              </Link>
            ) : (
              <div key={slug} className="more-card more-card-locked">
                <div className="more-icon more-icon-locked">{icon}</div>
                <div><h3>{title}</h3><p>{desc}</p></div>
                <span className="pro-only-bubble" style={{ position: "static", transform: "none" }}>
                  <FaLock style={{ fontSize: 8 }} /> Pro only
                </span>
              </div>
            )
          )}
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
        <div className="nav-item" onClick={() => navigate("/lessons")}><FaCalendarAlt /><span>Lessons</span></div>
        <div className="nav-item" onClick={() => navigate("/students")}><FaUsers /><span>Students</span></div>
        <div className="nav-item" onClick={() => navigate("/invoices")}><FaFileInvoiceDollar /><span>Invoices</span></div>
        <div className="nav-item active" onClick={() => navigate("/more")}><FaEllipsisH /><span>More</span></div>
      </nav>
    </div>
  );
}