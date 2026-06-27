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
} from "react-icons/fa";
import "./LandingPage.css";

const ROTATING_WORDS = ["coaches", "instructors", "teachers", "tutors", "nannies", "therapists"];

const PERSONAS = [
  { label: "Coaches", icon: <FaChalkboardTeacher /> },
  { label: "Tutors", icon: <FaBookOpen /> },
  { label: "Instructors", icon: <FaUserGraduate /> },
  { label: "Teachers", icon: <FaSchool /> },
  { label: "Nannies", icon: <FaChild /> },
  { label: "Therapists", icon: <FaUserMd /> },
];

const FAQS = [
  {
    q: "Is Billio really free to use?",
    a: "Yes. The Free plan lets you manage up to 5 active students, track lessons, and send invoices by email — no credit card required, ever.",
  },
  {
    q: "What happens after my 30-day Pro trial ends?",
    a: "You can keep using Billio on the Free plan, or subscribe to Pro to keep automated invoicing, SMS reminders, and unlimited students.",
  },
  {
    q: "Can I cancel my Pro subscription anytime?",
    a: "Yes — cancel anytime from your account settings. No long-term contracts and no cancellation fees.",
  },
  {
    q: "Is my student data secure?",
    a: "Your data is protected with row-level security in our database, so only you can ever access your students, lessons, and invoices.",
  },
  {
    q: "Does Billio work on my phone?",
    a: "Billio is mobile-first — install it straight to your home screen on iOS or Android, and use the full feature set on desktop too.",
  },
];

function RotatingWord() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % ROTATING_WORDS.length);
    }, 2200);
    return () => clearInterval(id);
  }, []);

  const word = ROTATING_WORDS[index];

  return (
    <span className="rotating-word-wrap">
      <span className="rotating-word" aria-hidden="true">
        {word.split("").map((char, i) => (
          <span
            key={`${index}-${i}`}
            className="rotating-letter"
            style={{ animationDelay: `${i * 35}ms` }}
          >
            {char}
          </span>
        ))}
      </span>
      <span className="visually-hidden">{ROTATING_WORDS.join(", ")}</span>
    </span>
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
          // Use a data-attribute rather than a class: React owns `className`
          // and rewrites it on every re-render (e.g. the FAQ toggle), which
          // would wipe out a class added imperatively here.
          entry.target.setAttribute("data-revealed", String(entry.isIntersecting));
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="landing-page">
      <div className="landing-dark-band">
        <nav className="landing-nav-bar">
          <div className="landing-nav-inner">
            <div className="landing-logo">
              <img src="./logo-white.png" alt="Billio" />
            </div>
            <div className="landing-nav-links">
              <Link to="/about" className="landing-nav-link">About</Link>
            </div>
            <div className="landing-nav-buttons">
              <Link to="/login" className="landing-login-btn">Login</Link>
              <Link to="/signup" className="landing-register-btn">Get Started</Link>
            </div>
          </div>
        </nav>

        <section className="landing-hero">
          <div className="landing-hero-left">
            <p className="landing-badge">Built for private coaches, tutors & instructors</p>

            <h1>Track lessons.<br />Automate Invoices.<br /><span ref={accentRef} className="landing-hero-accent">Get Paid Faster.</span></h1>

            <p className="landing-subtitle">
              Billio keeps your students, lessons, rates, and invoices in one simple
              app — so you spend less time sorting payments and more time coaching.
            </p>

            <Link to="/signup" className="landing-main-btn">
              Get Started Free <FaArrowRight className="landing-arrow" />
            </Link>

            <div className="landing-mini-checks">
              <span><FaCheckCircle /> Free plan available</span>
              <span><FaCheckCircle /> 30-day Pro trial</span>
              <span><FaCheckCircle /> Send invoices in seconds</span>
              <span><FaCheckCircle /> Trusted by coaches and instructors</span>
            </div>
          </div>

          <div className="landing-hero-right">
            <div className="landing-preview-card">
              <div className="preview-top">
                <div>
                  <p>Today's Schedule</p>
                  <h3>3 Lessons</h3>
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
      </div>

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

      <section className="landing-section">
        <p className="section-label reveal">Why Billio?</p>
        <h2>Made for the work <RotatingWord /> do every day.</h2>

        <div className="landing-features">
          <div className="landing-feature-card reveal">
            <span className="feature-icon-chip"><FaCalendarAlt /></span>
            <h3>Plan your day</h3>
            <p>See today's lessons, upcoming sessions, and completed work at a glance.</p>
          </div>

          <div className="landing-feature-card reveal">
            <span className="feature-icon-chip"><FaUsers /></span>
            <h3>Keep student details handy</h3>
            <p>Save contact info, parent details, lesson notes, and preferences in one place.</p>
          </div>

          <div className="landing-feature-card reveal">
            <span className="feature-icon-chip"><FaFileInvoiceDollar /></span>
            <h3>Never forget to bill</h3>
            <p>Track unbilled, billed, paid, and overdue lessons without a spreadsheet.</p>
          </div>

          <div className="landing-feature-card reveal">
            <span className="feature-icon-chip"><FaMobileAlt /></span>
            <h3>Built for between lessons</h3>
            <p>Add a lesson, update a student, or check billing status quickly from your phone.</p>
          </div>
        </div>
      </section>

      <section className="landing-steps-section">
        <p className="section-label reveal">Simple workflow</p>
        <h2 className="reveal">From lesson to invoice.</h2>

        <div className="landing-steps">
          <div className="reveal">
            <span>1</span>
            <strong>Add your students</strong>
            <p>Set up names, contact info, rates, and notes.</p>
          </div>
          <div className="reveal">
            <span>2</span>
            <strong>Log each lesson</strong>
            <p>Track time, duration, price, and billing status.</p>
          </div>
          <div className="reveal">
            <span>3</span>
            <strong>Stay invoice ready</strong>
            <p>See exactly what needs to be sent, paid, or followed up.</p>
          </div>
        </div>
      </section>

      <section className="pricing-section" id="pricing">
        <p className="section-label reveal">Simple pricing</p>
        <h2 className="reveal">Start free. Try Pro when you're ready.</h2>
        <p className="pricing-subtitle reveal">
          Use Billio for free, or start a 30-day Pro trial to unlock automation, SMS, and more pro features.
        </p>

        <div className="pricing-grid">
          <div className="pricing-card reveal">
            <h3>Free</h3>
            <p className="price">$0</p>
            <p className="price-note">Forever, no credit card needed</p>
            <ul>
              <li>Up to 5 active students</li>
              <li>Manual lesson tracking</li>
              <li>Manual invoice generation</li>
              <li>Email invoice sending</li>
              <li>Current month day-to-day calendar</li>
              <li>Recurring lesson scheduling</li>
            </ul>
            <Link to="/signup" className="pricing-btn secondary-pricing">Start Free</Link>
          </div>

          <div className="pricing-card pro-card reveal">
            <div className="popular-badge">
              <FaCrown style={{ fontSize: 10, marginRight: 5 }} /> 30-Day Trial
            </div>
            <h3>Pro</h3>
            <p className="price">$9.99<span>/month</span></p>
            <p className="price-note">30-day free trial</p>
            <ul>
              <li>Unlimited active students</li>
              <li>Full lesson scheduling</li>
              <li>Automated invoice generation</li>
              <li>Automated invoice sending and review</li>
              <li>Email & SMS invoice sending</li>
              <li>Text message reminders</li>
              <li>Weekly billing workflow</li>
              <li>Unlimited calendar navigation</li>
              <li>Live lesson timer</li>
              <li>Earnings dashboard</li>
              <li>Custom PDF invoice generator</li>
              <li>AI Assistant for lessons & invoices</li>
            </ul>
            <Link to="/signup" className="pricing-btn primary-pricing">Start Pro Trial</Link>
          </div>
        </div>
      </section>

      <section className="landing-faq-section">
        <p className="section-label reveal">FAQ</p>
        <h2 className="reveal">Questions, answered.</h2>

        <div className="landing-faq-list">
          {FAQS.map((item, i) => (
            <div className={`faq-item reveal${openFaq === i ? " faq-open" : ""}`} key={item.q}>
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

      <div className="landing-divider" />

      <section className="landing-final-cta">
        <h2 className="reveal">Ready to stop chasing lesson records?</h2>
        <p className="reveal">Start with the free plan or try Pro free for 30 days</p>
        <Link to="/signup" className="landing-main-btn reveal">
          Create Your Account <FaArrowRight className="landing-arrow" />
        </Link>
      </section>

      <footer className="landing-footer">
        <img src="./logo.png" alt="Billio" className="landing-footer-logo" />
        <div className="landing-footer-links">
          <Link to="/about">About</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/sms-opt-in">SMS Info</Link>
        </div>
        <p>© {new Date().getFullYear()} Billio LLC. All rights reserved.</p>
      </footer>
    </main>
  );
}