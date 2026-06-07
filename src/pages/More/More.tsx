import { Link } from "react-router-dom";
import {
  FaClock,
  FaStickyNote,
  FaChartLine,
  FaCalculator,
  FaCog,
  FaCrown,
  FaUser,
  FaHeadset,
  FaInfoCircle,
  FaShieldAlt,
  FaChevronRight,
} from "react-icons/fa";
import "./More.css";

export default function More() {
  return (
    <div className="more-page">
      <div className="more-header">
        <h1>More</h1>
        <p>Extra tools, account settings, and support for your coaching business.</p>
      </div>

      <section className="more-section">
        <h2>Coaching Tools</h2>

        <div className="more-grid">
          <Link to="/timer" className="more-card">
            <div className="more-icon">
              <FaClock />
            </div>
            <div>
              <h3>Lesson Timer</h3>
              <p>Start and stop a live timer while teaching a lesson.</p>
            </div>
            <FaChevronRight className="more-arrow" />
          </Link>

          <Link to="/quick-notes" className="more-card">
            <div className="more-icon">
              <FaStickyNote />
            </div>
            <div>
              <h3>Quick Notes</h3>
              <p>Write quick reminders after each lesson.</p>
            </div>
            <FaChevronRight className="more-arrow" />
          </Link>

          <Link to="/weekly-summary" className="more-card">
            <div className="more-icon">
              <FaChartLine />
            </div>
            <div>
              <h3>Weekly Summary</h3>
              <p>Review lessons, earnings, and unpaid sessions.</p>
            </div>
            <FaChevronRight className="more-arrow" />
          </Link>

          <Link to="/earnings-calculator" className="more-card">
            <div className="more-icon">
              <FaCalculator />
            </div>
            <div>
              <h3>Earnings Calculator</h3>
              <p>Estimate income from lessons and hourly rates.</p>
            </div>
            <FaChevronRight className="more-arrow" />
          </Link>
        </div>
      </section>

      <section className="more-section">
        <h2>Account</h2>

        <div className="more-list">
          <Link to="/settings" className="more-list-item">
            <FaCog />
            <span>Settings</span>
            <FaChevronRight />
          </Link>

          <Link to="/pricing" className="more-list-item">
            <FaCrown />
            <span>Subscription / Upgrade</span>
            <FaChevronRight />
          </Link>

          <Link to="/profile" className="more-list-item">
            <FaUser />
            <span>Profile</span>
            <FaChevronRight />
          </Link>
        </div>
      </section>

      <section className="more-section">
        <h2>Help</h2>

        <div className="more-list">
          <Link to="/support" className="more-list-item">
            <FaHeadset />
            <span>Support</span>
            <FaChevronRight />
          </Link>

          <Link to="/about" className="more-list-item">
            <FaInfoCircle />
            <span>About Billio</span>
            <FaChevronRight />
          </Link>

          <Link to="/privacy" className="more-list-item">
            <FaShieldAlt />
            <span>Privacy Policy</span>
            <FaChevronRight />
          </Link>
        </div>
      </section>
    </div>
  );
}