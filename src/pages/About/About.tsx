import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaMobileAlt,
  FaBolt,
  FaShieldAlt,
  FaHeart,
  FaEnvelope,
} from "react-icons/fa";
import "./About.css";

const FEATURES = [
  { icon: <FaCalendarAlt />, text: "Lesson scheduling & calendar" },
  { icon: <FaUsers />, text: "Student & parent management" },
  { icon: <FaFileInvoiceDollar />, text: "Automated invoice generation" },
  { icon: <FaMobileAlt />, text: "SMS & email invoice delivery" },
  { icon: <FaBolt />, text: "Live lesson timer" },
  { icon: <FaShieldAlt />, text: "Secure & private by default" },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="about-page">

      <div className="about-header">
        <div className="about-header-top">
          <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <img src="/logo.png" alt="Billio" className="about-logo" />
        </div>
      </div>

      {/* Hero */}
      <div className="about-hero">
        <div className="about-hero-badge">Built for coaches</div>
        <h1 className="about-hero-title">
          Billing made simple for private instructors.
        </h1>
        <p className="about-hero-subtitle">
          Billio is a mobile-first coaching management app designed for private
          instructors, tutors, and coaches who want to spend less time on admin
          and more time teaching.
        </p>
      </div>

      {/* Mission */}
      <div className="about-mission-card">
        <h2>Our Mission</h2>
        <p>
          Private coaches deserve tools that work as hard as they do.
          Billio was built because most billing software is too complex,
          too expensive, or simply not designed for a solo instructor
          managing 5–30 students from their phone.
        </p>
        <p>
          We keep it simple: track your students, log your lessons, and
          send invoices — all from one app, in under a minute.
        </p>
      </div>

      {/* Features */}
      <div className="about-section">
        <h2>What Billio does</h2>
        <div className="about-features">
          {FEATURES.map((f) => (
            <div key={f.text} className="about-feature-item">
              <span className="about-feature-icon">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Version */}
      <div className="about-section">
        <h2>App Info</h2>
        <div className="about-info-card">
          <div className="about-info-row">
            <span>App</span>
            <strong>Billio</strong>
          </div>
          <div className="about-info-row">
            <span>Version</span>
            <strong>1.0.0</strong>
          </div>
          <div className="about-info-row">
            <span>Platform</span>
            <strong>Web / Mobile</strong>
          </div>
          <div className="about-info-row">
            <span>Company</span>
            <strong>Billio LLC</strong>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="about-section">
        <h2>Get in touch</h2>
        <a href="mailto:support@mybillioapp.com" className="about-contact-btn">
          <FaEnvelope style={{ marginRight: 8, fontSize: 14 }} />
          support@mybillioapp.com
        </a>
      </div>

      {/* Footer */}
      <div className="about-footer">
        <FaHeart style={{ color: "var(--primary-purple)", fontSize: 12, marginRight: 5 }} />
        Made for coaches, by people who care about your time.
        <br />
        © {new Date().getFullYear()} Billio LLC. All rights reserved.
      </div>

    </div>
  );
}