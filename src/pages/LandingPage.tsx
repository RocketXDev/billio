import { Link } from "react-router-dom";
import {
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaMobileAlt,
  FaCheckCircle,
  FaArrowRight,
  FaPlus,
} from "react-icons/fa";
import "../index.css";
import "../LandingPage.css";

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <nav className="landing-nav">
          <div className="landing-logo">
            <img src="./logo.png" alt="Logo" />
          </div>
          <div className="landing-nav-buttons">
              <Link to="/login" className="landing-login-btn">
                Login
              </Link>

              <Link to="/signup" className="landing-register-btn">
                Get Started
              </Link>
          </div>
        </nav>

        <div className="landing-hero-card">
          <p className="landing-badge">Built for private coaches, tutors, and instructors</p>

          <h1>Track lessons. Bill faster. Stay organized.</h1>

          <p className="landing-subtitle">
            Billio keeps your students, lessons, rates, notes, and invoices in one simple
            mobile app — so you can spend less time sorting payments and more time coaching.
          </p>

          <Link to="/login" className="landing-main-btn">
            Get Started <FaArrowRight className="landing-arrow" />
          </Link>

          <div className="landing-mini-checks">
            <span><FaCheckCircle /> Know what needs to be billed</span>
            <span><FaCheckCircle /> Track every student and lesson</span>
          </div>
        </div>

        <div className="landing-preview-card">
          <div className="preview-top">
            <div>
              <p>Today's Schedule</p>
              <h3>2 Lessons</h3>
            </div>
            <button>
              <FaPlus />
            </button>
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
        </div>
      </section>

      <section className="landing-section">
        <p className="section-label">Why Billio?</p>
        <h2>Made for the work coaches do every day.</h2>

        <div className="landing-features">
          <div className="landing-feature-card">
            <FaCalendarAlt />
            <h3>Plan your day</h3>
            <p>See today’s lessons, upcoming sessions, and completed work at a glance.</p>
          </div>

          <div className="landing-feature-card">
            <FaUsers />
            <h3>Keep student details handy</h3>
            <p>Save contact info, parent details, lesson notes, and preferences in one place.</p>
          </div>

          <div className="landing-feature-card">
            <FaFileInvoiceDollar />
            <h3>Never forget to bill</h3>
            <p>Track unbilled, billed, paid, and overdue lessons without checking a spreadsheet.</p>
          </div>

          <div className="landing-feature-card">
            <FaMobileAlt />
            <h3>Built for between lessons</h3>
            <p>Add a lesson, update a student, or check billing status quickly from your phone.</p>
          </div>
        </div>
      </section>

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

      <section className="pricing-section" id="pricing">
        <p className="section-badge">Simple pricing</p>
        <h2>Start free. Upgrade when you need more.</h2>
        <p className="pricing-subtitle">
          Billio is built so new coaches can start organizing right away, while growing coaches can unlock automation.
        </p>

        <div className="pricing-grid">
          <div className="pricing-card">
            <h3>Free</h3>
            <p className="price">$0</p>
            <p className="price-note">For getting started</p>

            <ul>
              <li>Up to 5 active students</li>
              <li>Manual lesson tracking</li>
              <li>Basic student profiles</li>
              <li>Email invoice sedning only</li>
              <li>Manual invoice tracking</li>
              <li>Weekly calendar only</li>
            </ul>

            <Link to="/login" className="pricing-btn secondary-pricing">
              Start Free
            </Link>
          </div>

          <div className="pricing-card pro-card">
            <div className="popular-badge">Best value</div>

            <h3>Pro</h3>
            <p className="price">$6.99<span>/month</span></p>
            <p className="price-note">For active coaches</p>

            <ul>
              <li>Unlimited active students</li>
              <li>Full lesson scheduling</li>
              <li>Advanced student details</li>
              <li>Automated Invoice creation</li>
              <li>Automated Billing</li>
              <li>Email and text invoice sending</li>
              <li>Text message reminders</li>
              <li>Weekly billing workflow</li>
              <li>Unlimited calendar</li>
            </ul>

            <Link to="/login" className="pricing-btn primary-pricing">
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </section>

      <div className="landing-divider"></div>

      <section className="landing-final-cta">
        <h2>Ready to stop chasing lesson records?</h2>
        <p>Start using Billio to keep your coaching business organized from day one.</p>

        <Link to="/signup" className="landing-main-btn">
            Create Your Account <FaArrowRight className="landing-arrow" />
        </Link>
      </section>

      <div className="landing-divider"></div>

      <footer className="landing-footer">
        <div className="landing-footer-logo">
            Billio
        </div>

        <div className="landing-footer-links">
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/support">Support</Link>
            <Link to="/contact">Contact</Link>
        </div>

        <p>
            © {new Date().getFullYear()} Billio LLC. All rights reserved.
        </p>
      </footer>
    </main>
  );
}