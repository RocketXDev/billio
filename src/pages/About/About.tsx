import { useNavigate, Link } from "react-router-dom";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaMobileAlt,
  FaBolt,
  FaShieldAlt,
  FaHeart,
  FaEnvelope,
  FaRobot,
  FaFilePdf,
  FaChartLine,
  FaUserShield,
  FaSlidersH,
  FaCheckCircle,
  FaLifeRing,
} from "react-icons/fa";
import RotatingWord from "../../components/RotatingWord/RotatingWord";
import "./About.css";

const FEATURES = [
  { icon: <FaCalendarAlt />, text: "Lesson scheduling & calendar" },
  { icon: <FaUsers />, text: "Student & client management" },
  { icon: <FaFileInvoiceDollar />, text: "Automated invoice generation" },
  { icon: <FaMobileAlt />, text: "Email & SMS invoice delivery" },
  { icon: <FaBolt />, text: "Live lesson timer" },
  { icon: <FaRobot />, text: "AI Assistant for lessons & invoices" },
  { icon: <FaFilePdf />, text: "Branded, custom PDF invoices" },
  { icon: <FaChartLine />, text: "Earnings dashboard" },
];

const TRUST_POINTS = [
  {
    icon: <FaShieldAlt />,
    title: "Locked down by design",
    text: "Every account is protected with row-level security in our database — only you can ever see your students, lessons, and invoices.",
  },
  {
    icon: <FaUserShield />,
    title: "We never sell your data",
    text: "Your information is used to run Billio for you, full stop. Read the specifics in our Privacy Policy.",
    link: { to: "/privacy", label: "Read our Privacy Policy" },
  },
  {
    icon: <FaSlidersH />,
    title: "You're always in control",
    text: "Delete your account and everything in it whenever you want, right from Settings. No calls, no retention games.",
  },
];

const QUICK_FACTS = [
  { value: "$0", label: "Free plan, forever — no credit card" },
  { value: "5–30", label: "Typical students managed per coach" },
  { value: "30 days", label: "Free Pro trial, cancel anytime" },
  { value: "0", label: "Times we've sold your data" },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="about-page">
      <header className="about-header">
        <div className="about-header-inner">
          <div className="about-header-left">
            <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
              <FaArrowLeft />
            </button>
            <img src="/logo-white.png" alt="Billio" className="about-logo" />
          </div>
          <div className="about-header-actions">
            <Link to="/login" className="about-nav-login">Login</Link>
            <Link to="/signup" className="about-nav-cta">Get Started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="about-hero-band">
        <div className="about-hero">
          <span className="about-label">Built for coaches, tutors & more</span>
          <h1 className="about-hero-title">
            Billing made simple for <RotatingWord variant="plain" />.
          </h1>
          <p className="about-hero-subtitle">
            Billio is a mobile-first scheduling and invoicing app for coaches, tutors,
            instructors, teachers, nannies, and therapists who want to spend less time
            on admin and more time with their students.
          </p>

          <div className="about-trust-row">
            <span><FaShieldAlt /> Row-level data security</span>
            <span><FaUserShield /> We never sell your data</span>
            <span><FaCheckCircle /> Free plan, no card required</span>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="about-mission-section">
        <div className="about-mission-text">
          <span className="about-label">Why we built this</span>
          <h2>Software that works as hard as you do.</h2>
          <p>
            Private coaches, tutors, and instructors deserve tools built for how
            they actually work — not bloated software made for big studios and
            franchises. Billio exists because most billing tools are too complex,
            too expensive, or simply not designed for someone running their practice
            from their phone.
          </p>
          <p>
            We keep it simple: track your students, log your lessons — or sessions,
            appointments, whatever you call them — and send invoices, all from one
            app, in under a minute.
          </p>
        </div>

        <div className="about-mission-stats">
          {QUICK_FACTS.map((fact) => (
            <div className="about-stat-card" key={fact.label}>
              <strong>{fact.value}</strong>
              <span>{fact.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="about-content-section">
        <span className="about-label">What Billio does</span>
        <h2>Everything you need to run lessons and billing.</h2>
        <div className="about-features-grid">
          {FEATURES.map((f) => (
            <div key={f.text} className="about-feature-item">
              <span className="about-feature-icon">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="about-content-section about-trust-section">
        <span className="about-label">Built on trust</span>
        <h2>Your data stays yours.</h2>
        <div className="about-trust-grid">
          {TRUST_POINTS.map((point) => (
            <div className="about-trust-card" key={point.title}>
              <span className="about-trust-icon">{point.icon}</span>
              <h3>{point.title}</h3>
              <p>{point.text}</p>
              {point.link && (
                <Link to={point.link.to} className="about-trust-link">
                  {point.link.label} <FaArrowRight />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* App Info + Contact */}
      <section className="about-content-section about-info-row">
        <div className="about-info-card">
          <h3>App Info</h3>
          <div className="about-info-table">
            <div className="about-info-line">
              <span>App</span>
              <strong>Billio</strong>
            </div>
            <div className="about-info-line">
              <span>Version</span>
              <strong>1.0.0</strong>
            </div>
            <div className="about-info-line">
              <span>Platform</span>
              <strong>Web / Mobile</strong>
            </div>
            <div className="about-info-line">
              <span>Company</span>
              <strong>Billio LLC</strong>
            </div>
          </div>
        </div>

        <div className="about-contact-card">
          <h3>Get in touch</h3>
          <p>Questions, feedback, or just want to say hi? We read every message.</p>
          <a href="mailto:support@mybillioapp.com" className="about-contact-btn">
            <FaEnvelope /> support@mybillioapp.com
          </a>
          <Link to="/support" className="about-contact-link">
            <FaLifeRing /> Visit the Support Center
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="about-final-cta">
        <h2>Ready to simplify your billing?</h2>
        <p>Start free, no credit card needed — upgrade to Pro whenever you're ready.</p>
        <Link to="/signup" className="about-final-btn">
          Get Started Free <FaArrowRight />
        </Link>
      </section>

      {/* Footer */}
      <footer className="about-page-footer">
        <div className="about-page-footer-links">
          <Link to="/blog">Blog</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/sms-opt-in">SMS Info</Link>
          <Link to="/support">Support</Link>
        </div>
        <p>
          <FaHeart style={{ color: "var(--primary-purple)", fontSize: 12, marginRight: 5 }} />
          Made for coaches, by people who care about your time.
        </p>
        <p>© {new Date().getFullYear()} Billio LLC. All rights reserved.</p>
      </footer>
    </div>
  );
}
