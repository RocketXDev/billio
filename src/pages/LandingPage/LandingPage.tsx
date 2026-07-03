import { useEffect, useRef, useState } from "react";
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
  FaChalkboardTeacher,
  FaBookOpen,
  FaUserGraduate,
  FaChild,
  FaSchool,
  FaUserMd,
  FaHeart,
  FaTimes,
  FaCheck,
  FaQuoteLeft,
} from "react-icons/fa";
import RotatingWord from "../../components/RotatingWord/RotatingWord";
import "./LandingPage.css";

const PERSONAS = [
  { label: "Coaches", icon: <FaChalkboardTeacher /> },
  { label: "Tutors", icon: <FaBookOpen /> },
  { label: "Instructors", icon: <FaUserGraduate /> },
  { label: "Teachers", icon: <FaSchool /> },
  { label: "Nannies", icon: <FaChild /> },
  { label: "Therapists", icon: <FaUserMd /> },
];

// TODO: Replace with real testimonials from actual users before using in paid marketing.
const TESTIMONIALS = [
  {
    quote:
      "Billio makes it easier to keep lessons and invoices organized without using notes or spreadsheets.",
    name: "Early coach feedback",
    role: "Private coach",
  },
  {
    quote:
      "The app is simple and mobile-friendly, which makes it easier to use between lessons.",
    name: "Early tester feedback",
    role: "Instructor",
  },
  {
    quote: "Invoice creation and tracking are the biggest time savers.",
    name: "Early user feedback",
    role: "Lesson-based business",
  },
];

// TODO: Replace these stats with real values when they are available.
const STATS = [
  { value: "Early access", label: "Coaches testing Billio" },
  { value: "Built for", label: "Private coaches & tutors" },
  { value: "Free plan", label: "Up to 5 active students" },
  { value: "Mobile-first", label: "Designed for busy coaches" },
];

const FAQS = [
  {
    q: "Is Billio free?",
    a: "Yes. Billio has a free plan with up to 5 active students. No credit card is required for the Free plan.",
  },
  {
    q: "Who is Billio for?",
    a: "Billio is built for private coaches, tutors, instructors, and other lesson-based professionals who need to track lessons, students, invoices, and payments.",
  },
  {
    q: "Do I need to download an app?",
    a: "No. Billio is web-based and mobile-friendly, so you can use it from your phone, tablet, or computer.",
  },
  {
    q: "Can I send invoices by text?",
    a: "Text invoice sending is available for Pro users. Free users can send invoices by email.",
  },
  {
    q: "What happens when I upgrade?",
    a: "Pro unlocks unlimited active students, automated invoice creation, text invoice sending, recurring lessons, earnings dashboard, and more.",
  },
];

// Mobile screenshots — shown only on small screens (< 1024px)
const MOBILE_SCREENSHOTS = [
  {
    src: "/screenshots/mobile/dashboard.jpeg",
    label: "Dashboard",
    caption: "See today's lessons, weekly earnings, and unpaid invoices at a glance.",
  },
  {
    src: "/screenshots/mobile/lessons.jpeg",
    label: "Lessons",
    caption: "Add lessons quickly and keep track of what has already been billed.",
  },
  {
    src: "/screenshots/mobile/students.jpeg",
    label: "Students",
    caption: "Keep student and parent contact information organized in one place.",
  },
  {
    src: "/screenshots/mobile/invoices.jpeg",
    label: "Invoices",
    caption: "Create invoices from selected lessons and send them by email or text.",
  },
];

// Desktop screenshots — shown only on large screens (1024px+)
const DESKTOP_SCREENSHOTS = [
  {
    src: "/screenshots/desktop/dashboard.png",
    label: "Dashboard",
    caption: "See today's lessons, weekly earnings, and unpaid invoices at a glance.",
  },
  {
    src: "/screenshots/desktop/lessons.png",
    label: "Lessons",
    caption: "Add lessons quickly and keep track of what has already been billed.",
  },
  {
    src: "/screenshots/desktop/invoices.png",
    label: "Invoices",
    caption: "Create invoices from selected lessons and send them by email or text.",
  },
  {
    src: "/screenshots/desktop/students.png",
    label: "Students",
    caption: "Keep student and parent contact information organized in one place.",
  },
];

function ScreenshotCard({
  src,
  caption,
  label,
  type,
}: {
  src: string;
  caption: string;
  label: string;
  type: "mobile" | "desktop";
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`screenshot-card screenshot-card--${type}`}>
      <div className="screenshot-frame">
        {!failed ? (
          <img
            src={src}
            alt={label}
            className="screenshot-img"
            onError={() => setFailed(true)}
            loading="lazy"
          />
        ) : (
          <div className="screenshot-placeholder">
            <span>{type === "mobile" ? "📱" : "🖥️"}</span>
            <p>Screenshot coming soon</p>
          </div>
        )}
      </div>
      <strong className="screenshot-label">{label}</strong>
      <p className="screenshot-caption">{caption}</p>
    </div>
  );
}

export default function LandingPage() {
  const accentRef = useRef<HTMLSpanElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const el = accentRef.current;
    if (!el) return;
    const onScroll = () => {
      if (window.scrollY > 60) {
        el.classList.add("sparked");
      } else {
        el.classList.remove("sparked");
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(".reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.setAttribute("data-revealed", String(entry.isIntersecting));
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToWorkflow = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="landing-page">
      <div className="landing-dark-band">
        {/* ── Nav ── */}
        <nav className="landing-nav-bar">
          <div className="landing-nav-inner">
            <div className="landing-logo">
              <img src="./logo-white.png" alt="Billio" />
            </div>
            <div className="landing-nav-buttons">
              <Link to="/login" className="landing-login-btn">
                Login
              </Link>
              <Link to="/signup" className="landing-register-btn">
                Get Started
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="landing-hero">
          <div className="landing-hero-left">
            <p className="landing-badge">
              Built for private coaches, tutors & instructors
            </p>

            <h1>
              Stop losing lessons.<br />Automate invoices.<br /><span ref={accentRef} className="landing-hero-accent">Get Paid Faster.</span>
            </h1>

            <p className="landing-subtitle">
              Billio helps private coaches, tutors, and instructors track
              lessons, manage students, and send invoices from one simple
              mobile-friendly app.
            </p>

            <p className="landing-trust-line">
              Start free with up to 5 active students. No credit card required.
            </p>

            <div className="hero-cta-row">
              <Link
                to="/signup"
                className="landing-main-btn"
                data-track="landing_hero_start_free_click"
              >
                Start Free — No Card Needed{" "}
                <FaArrowRight className="landing-arrow" />
              </Link>
              <button
                type="button"
                className="landing-ghost-btn"
                onClick={scrollToWorkflow}
                data-track="landing_hero_see_workflow_click"
              >
                See How It Works
              </button>
            </div>

            <div className="landing-benefit-chips">
              <span>
                <FaCheckCircle /> Track lessons in seconds
              </span>
              <span>
                <FaCheckCircle /> Create invoices faster
              </span>
              <span>
                <FaCheckCircle /> Stay organized from your phone
              </span>
            </div>
          </div>

          <div className="landing-hero-right">
            <div className="landing-preview-card">
              <div className="preview-top">
                <div>
                  <p>Today's Schedule</p>
                  <strong className="preview-top-count">3 Lessons</strong>
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
      </div>

      {/* ── Problem / Pain section ── */}
      <section className="landing-pain-section">
        <div className="pain-header reveal">
          <p className="section-label">For coaches, tutors & instructors</p>
          <h2>Built for coaches who are tired of messy admin</h2>
          <p className="pain-subtext">
            Most coaches do not need complicated business software. They need a
            simple way to remember who they taught, what still needs to be
            billed, and which invoices are paid.
          </p>
        </div>
        <div className="pain-cards">
          <div className="pain-card reveal">
            <span className="pain-card-icon">
              <FaCalendarAlt />
            </span>
            <h3>Lessons get lost</h3>
            <p>
              Stop relying on memory, Notes, paper, or scattered messages to
              remember every lesson.
            </p>
          </div>
          <div className="pain-card reveal">
            <span className="pain-card-icon">
              <FaFileInvoiceDollar />
            </span>
            <h3>Invoices take too long</h3>
            <p>
              Turn completed lessons into clean invoices without rebuilding
              everything manually.
            </p>
          </div>
          <div className="pain-card reveal">
            <span className="pain-card-icon">
              <FaUsers />
            </span>
            <h3>Payments are hard to track</h3>
            <p>
              See which invoices are unpaid, pending, or paid so nothing slips
              through.
            </p>
          </div>
        </div>
      </section>

      {/* ── Screenshots section ── */}
      <section className="screenshots-section">
        <div className="screenshots-header reveal">
          <p className="section-label">See exactly how Billio works</p>
          <h2>A simple workflow from lesson tracking to invoicing.</h2>
        </div>

        {/* Mobile phone screenshots — visible only below 1024px */}
        <div className="screenshots-mobile-row">
          {MOBILE_SCREENSHOTS.map((s) => (
            <ScreenshotCard key={s.label} {...s} type="mobile" />
          ))}
        </div>

        {/* Desktop app screenshots — visible only at 1024px+ */}
        <div className="screenshots-desktop-grid">
          {DESKTOP_SCREENSHOTS.map((s) => (
            <ScreenshotCard key={s.label} {...s} type="desktop" />
          ))}
        </div>
      </section>

      {/* ── How Billio Works ── */}
      <section className="landing-steps-section" id="how-it-works">
        <p className="section-label reveal">Simple workflow</p>
        <h2 className="reveal">From lesson to invoice in minutes.</h2>

        <div className="landing-steps">
          <div className="reveal">
            <span>1</span>
            <strong>Add your students</strong>
            <p>
              Save student and parent contact details once so billing is easier
              later.
            </p>
          </div>
          <div className="reveal">
            <span>2</span>
            <strong>Track your lessons</strong>
            <p>Add lessons manually or schedule them ahead of time.</p>
          </div>
          <div className="reveal">
            <span>3</span>
            <strong>Create an invoice</strong>
            <p>
              Select a student and date range. Billio pulls in the matching
              lessons automatically.
            </p>
          </div>
          <div className="reveal">
            <span>4</span>
            <strong>Send it</strong>
            <p>
              Send invoices by email or text depending on the contact
              information available.
            </p>
          </div>
          <div className="reveal">
            <span>5</span>
            <strong>Track payment status</strong>
            <p>Mark invoices as paid and see what is still outstanding.</p>
          </div>
        </div>

        <div className="steps-cta reveal">
          <Link
            to="/signup"
            className="landing-main-btn"
            data-track="landing_workflow_start_click"
          >
            Start Tracking Lessons Free <FaArrowRight className="landing-arrow" />
          </Link>
        </div>
      </section>

      {/* ── Before / After comparison ── */}
      <section className="comparison-section">
        <div className="comparison-inner reveal">
          <p className="section-label">See the difference</p>
          <h2>Replace notes, spreadsheets, and forgotten invoices</h2>

          <div className="comparison-grid">
            <div className="comparison-column comparison-column--before">
              <h3>
                <FaTimes className="comparison-icon comparison-icon--x" />
                Before Billio
              </h3>
              <ul>
                <li>Lessons tracked in phone notes</li>
                <li>Student info spread across messages</li>
                <li>Invoices made manually</li>
                <li>Easy to forget who paid</li>
                <li>Hard to see weekly earnings</li>
              </ul>
            </div>
            <div className="comparison-column comparison-column--after">
              <h3>
                <FaCheck className="comparison-icon comparison-icon--check" />
                With Billio
              </h3>
              <ul>
                <li>Lessons organized in one app</li>
                <li>Student and parent details saved</li>
                <li>Invoices created from lesson history</li>
                <li>Paid and unpaid invoices tracked</li>
                <li>Earnings visible from the dashboard</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features section ── */}
      <section className="landing-section">
        <p className="section-label reveal">Why Billio?</p>
        <h2>
          Made for the work <RotatingWord /> do every day.
        </h2>

        <div className="landing-features">
          <div className="landing-feature-card reveal">
            <span className="feature-icon-chip">
              <FaCalendarAlt />
            </span>
            <h3>Plan your day</h3>
            <p>
              See today's lessons, upcoming sessions, and completed work at a
              glance.
            </p>
          </div>

          <div className="landing-feature-card reveal">
            <span className="feature-icon-chip">
              <FaUsers />
            </span>
            <h3>Keep student details handy</h3>
            <p>
              Save contact info, parent details, lesson notes, and preferences
              in one place.
            </p>
          </div>

          <div className="landing-feature-card reveal">
            <span className="feature-icon-chip">
              <FaFileInvoiceDollar />
            </span>
            <h3>Never forget to bill</h3>
            <p>
              Track unbilled, billed, paid, and overdue lessons without a
              spreadsheet.
            </p>
          </div>

          <div className="landing-feature-card reveal">
            <span className="feature-icon-chip">
              <FaMobileAlt />
            </span>
            <h3>Built for between lessons</h3>
            <p>
              Add a lesson, update a student, or check billing status quickly
              from your phone.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="pricing-section" id="pricing">
        <p className="section-label reveal">Simple pricing</p>
        <h2 className="reveal">
          Start free. Upgrade when you need more automation.
        </h2>
        <p className="pricing-subtitle reveal">
          Use Billio for free, or start a 30-day Pro trial to unlock
          automation, SMS, and unlimited students.
        </p>

        <div className="pricing-grid">
          <div className="pricing-card reveal">
            <h3>Free</h3>
            <p className="price">$0</p>
            <p className="price-note">For coaches getting started</p>
            <ul>
              <li>Up to 5 active students</li>
              <li>Manual lesson tracking</li>
              <li>Basic student profiles</li>
              <li>Email invoices</li>
              <li>Weekly calendar view</li>
            </ul>
            <Link
              to="/signup"
              className="pricing-btn secondary-pricing"
              data-track="landing_pricing_free_click"
            >
              Start Free
            </Link>
          </div>

          <div className="pricing-card pro-card reveal">
            <div className="popular-badge">
              <FaCrown style={{ fontSize: 10, marginRight: 5 }} /> 30-Day Trial
            </div>
            <h3>Pro</h3>
            <p className="price">
              $9.99<span>/month</span>
            </p>
            <p className="price-note">For coaches who want to automate more</p>
            <ul>
              <li>Unlimited active students</li>
              <li>Full lesson scheduling</li>
              <li>Automated invoice creation</li>
              <li>Email and text invoice sending</li>
              <li>Text reminders</li>
              <li>Recurring lessons</li>
              <li>Earnings dashboard</li>
              <li>Custom PDF invoices</li>
            </ul>
            <Link
              to="/signup"
              className="pricing-btn primary-pricing"
              data-track="landing_pricing_pro_click"
            >
              Start Free Trial
            </Link>
          </div>
        </div>

        <p className="pricing-no-card-note">
          No credit card required for the Free plan. Upgrade only when you are
          ready.
        </p>
      </section>

      {/* ── Social proof / Stats ── */}
      <section className="stats-section reveal">
        <div className="stats-inner">
          <p className="section-label stats-label">
            Built for growing lesson-based businesses
          </p>
          <div className="stats-grid">
            {/* TODO: Replace these with real stats when they are available. */}
            {STATS.map((stat) => (
              <div className="stat-tile" key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="testimonials-section">
        <div className="testimonials-inner">
          <p className="section-label reveal">What coaches are saying</p>
          <h2 className="reveal">Early feedback</h2>
          {/* TODO: Replace with real testimonials before using in paid marketing. */}
          <div className="testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div className="testimonial-card reveal" key={i}>
                <FaQuoteLeft className="testimonial-quote-icon" />
                <p className="testimonial-text">"{t.quote}"</p>
                <div className="testimonial-author">
                  <strong>{t.name}</strong>
                  <span>{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Persona strip ── */}
      <section className="landing-personas reveal">
        <p className="personas-caption">Built for every kind of instructor</p>
        <div className="landing-personas-inner">
          {PERSONAS.map((persona) => (
            <span className="persona-chip" key={persona.label}>
              {persona.icon} {persona.label}
            </span>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="landing-faq-section">
        <p className="section-label reveal">FAQ</p>
        <h2 className="reveal">Questions, answered.</h2>

        <div className="landing-faq-list">
          {FAQS.map((item, i) => (
            <div
              className={`faq-item reveal${openFaq === i ? " faq-open" : ""}`}
              key={item.q}
            >
              <button
                type="button"
                className="faq-question"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
              >
                {item.q}
                <span className="faq-icon">{openFaq === i ? "−" : "+"}</span>
              </button>
              <div className="faq-answer">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Story teaser ── */}
      <section className="landing-story-teaser reveal">
        <span className="landing-story-icon">
          <FaHeart />
        </span>
        <div className="landing-story-text">
          <h3>There's a story behind Billio.</h3>
          <p>
            Built because billing software for solo coaches, tutors, and
            instructors just wasn't good enough — and built to keep your data
            yours.
          </p>
        </div>
        <Link to="/about" className="landing-story-link">
          Meet Billio <FaArrowRight />
        </Link>
      </section>

      <div className="landing-divider" />

      {/* ── Final CTA ── */}
      <section className="landing-final-cta">
        <h2 className="reveal">
          Ready to stop losing track of lessons and invoices?
        </h2>
        <p className="reveal">
          Create your free Billio account and organize your first students,
          lessons, and invoices today.
        </p>
        <Link
          to="/signup"
          className="landing-main-btn reveal"
          data-track="landing_final_start_free_click"
        >
          Start Free — No Card Needed <FaArrowRight className="landing-arrow" />
        </Link>
        <p className="final-cta-note reveal">
          Free plan includes up to 5 active students.
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <img src="./logo.png" alt="Billio" className="landing-footer-logo" />
        <div className="landing-footer-links">
          <Link to="/about">About</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/sms-opt-in">SMS Info</Link>
        </div>
        <p>© {new Date().getFullYear()} Billio LLC. All rights reserved.</p>
      </footer>
    </main>
  );
}
