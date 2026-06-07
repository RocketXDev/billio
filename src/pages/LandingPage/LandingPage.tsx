import { Link } from "react-router-dom";
import {
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaMobileAlt,
  FaCheckCircle,
  FaArrowRight,
  FaPlus,
  FaCrown,
  FaInfinity,
  FaMobile,
} from "react-icons/fa";
import "./LandingPage.css";

export default function LandingPage() {
  return (
    <main className="landing-page">

      {/* ── Nav ── */}
      <nav className="landing-nav-bar">
        <div className="landing-nav-inner">
          <div className="landing-logo">
            <img src="./logo.png" alt="Billio" />
          </div>
          <div className="landing-nav-buttons">
            <Link to="/login" className="landing-login-btn">Login</Link>
            <Link to="/signup" className="landing-register-btn">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-left">
          <p className="landing-badge">Built for private coaches, tutors & instructors</p>

          <h1>Track lessons.<br />Bill faster.<br />Stay organized.</h1>

          <p className="landing-subtitle">
            Billio keeps your students, lessons, rates, and invoices in one simple
            app — so you spend less time sorting payments and more time coaching.
          </p>

          <Link to="/signup" className="landing-main-btn">
            Get Started Free <FaArrowRight className="landing-arrow" />
          </Link>

          <div className="landing-mini-checks">
            <span><FaCheckCircle /> Know what needs to be billed</span>
            <span><FaCheckCircle /> Track every student and lesson</span>
            <span><FaCheckCircle /> Send invoices in seconds</span>
          </div>
        </div>

        <div className="landing-hero-right">
          <div className="landing-preview-card">
            <div className="preview-top">
              <div>
                <p>Today's Schedule</p>
                <h3>2 Lessons</h3>
              </div>
              <button><FaPlus /></button>
            </div>

            <div className="preview-lesson">
              <div>
                <strong>4:30 PM</strong>
                <span>Sarah Johnson</span>
              </div>
              <p>Unbilled</p>
            </div>

            <div className="preview-lesson">
              <div>
                <strong>6:00 PM</strong>
                <span>Alex Miller</span>
              </div>
              <p className="paid">Paid</p>
            </div>

            <div className="preview-lesson">
              <div>
                <strong>7:30 PM</strong>
                <span>Emma Davis</span>
              </div>
              <p>Unbilled</p>
            </div>
          </div>

          <div className="landing-stat-row">
            <div className="landing-stat-card">
              <strong>$2,400</strong>
              <span>Billed this month</span>
            </div>
            <div className="landing-stat-card">
              <strong>12</strong>
              <span>Active students</span>
            </div>
            <div className="landing-stat-card">
              <strong>38</strong>
              <span>Lessons logged</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section">
        <p className="section-label">Why Billio?</p>
        <h2>Made for the work coaches do every day.</h2>

        <div className="landing-features">
          <div className="landing-feature-card">
            <FaCalendarAlt />
            <h3>Plan your day</h3>
            <p>See today's lessons, upcoming sessions, and completed work at a glance.</p>
          </div>

          <div className="landing-feature-card">
            <FaUsers />
            <h3>Keep student details handy</h3>
            <p>Save contact info, parent details, lesson notes, and preferences in one place.</p>
          </div>

          <div className="landing-feature-card">
            <FaFileInvoiceDollar />
            <h3>Never forget to bill</h3>
            <p>Track unbilled, billed, paid, and overdue lessons without a spreadsheet.</p>
          </div>

          <div className="landing-feature-card">
            <FaMobileAlt />
            <h3>Built for between lessons</h3>
            <p>Add a lesson, update a student, or check billing status quickly from your phone.</p>
          </div>
        </div>
      </section>

      {/* ── Steps ── */}
      <section className="landing-steps-section">
        <p className="section-label">Simple workflow</p>
        <h2>From lesson to invoice.</h2>

        <div className="landing-steps">
          <div>
            <span>1</span>
            <strong>Add your students</strong>
            <p>Set up names, contact info, rates, and notes.</p>
          </div>
          <div>
            <span>2</span>
            <strong>Log each lesson</strong>
            <p>Track time, duration, price, and billing status.</p>
          </div>
          <div>
            <span>3</span>
            <strong>Stay invoice ready</strong>
            <p>See exactly what needs to be sent, paid, or followed up.</p>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="pricing-section" id="pricing">
        <p className="section-badge">Simple pricing</p>
        <h2>Start free. Upgrade when you're ready.</h2>
        <p className="pricing-subtitle">
          New coaches can start organizing right away. Growing coaches can unlock automation and SMS.
        </p>

        <div className="pricing-grid">
          {/* Free */}
          <div className="pricing-card">
            <h3>Free</h3>
            <p className="price">$0</p>
            <p className="price-note">Forever, no credit card needed</p>
            <ul>
              <li>Up to 5 active students</li>
              <li>Manual lesson tracking</li>
              <li>Basic student profiles</li>
              <li>Email invoice sending</li>
              <li>Manual invoice creation</li>
              <li>Current month calendar</li>
            </ul>
            <Link to="/signup" className="pricing-btn secondary-pricing">Start Free</Link>
          </div>

          {/* Pro */}
          <div className="pricing-card pro-card">
            <div className="popular-badge">
              <FaCrown style={{ fontSize: 10, marginRight: 5 }} /> Best value
            </div>
            <h3>Pro</h3>
            <p className="price">$9.99<span>/month</span></p>
            <p className="price-note">For active coaches who want to scale</p>
            <ul>
              <li>Unlimited active students</li>
              <li>Full lesson scheduling</li>
              <li>Full parent contact profiles</li>
              <li>Automated invoice creation</li>
              <li>Email & SMS invoice sending</li>
              <li>Text message reminders</li>
              <li>Weekly billing workflow</li>
              <li>Unlimited calendar navigation</li>
            </ul>
            <Link to="/signup" className="pricing-btn primary-pricing">Upgrade to Pro</Link>
          </div>
        </div>
      </section>

      <div className="landing-divider" />

      {/* ── CTA ── */}
      <section className="landing-final-cta">
        <h2>Ready to stop chasing lesson records?</h2>
        <p>Start using Billio to keep your coaching business organized from day one.</p>
        <Link to="/signup" className="landing-main-btn">
          Create Your Account <FaArrowRight className="landing-arrow" />
        </Link>
      </section>

      <div className="landing-divider" />

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="landing-footer-logo">Billio</div>
        <div className="landing-footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/sms-opt-in">SMS Info</Link>
        </div>
        <p>© {new Date().getFullYear()} Billio LLC. All rights reserved.</p>
      </footer>

    </main>
  );
}