import './Terms.css';
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";


function Terms() {

  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <div className="legal-header">
        <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <img src="/logo.png" alt="Billio" className="about-logo" />
      </div>
      <div className="legal-card">
        <h1>Terms and Conditions</h1>

        <p className="legal-updated">
          Last updated: June 3, 2026
        </p>

        <p>
          Welcome to Billio. By accessing or using Billio, you agree to
          these Terms and Conditions.
        </p>

        <h2>Use of Billio</h2>

        <p>
          Billio provides lesson management, student management,
          invoicing, scheduling, communication, and related services
          for coaches and their students.
        </p>

        <p>
          You agree to use Billio only for lawful purposes and in
          accordance with these Terms.
        </p>

        <h2>Account Responsibility</h2>

        <p>
          You are responsible for maintaining the security of your
          account and for all activity occurring under your account.
        </p>

        <h2>Student Information</h2>

        <p>
          Coaches are responsible for obtaining appropriate consent
          before entering student or parent contact information into
          Billio.
        </p>

        <h2>SMS Messaging Terms</h2>

        <p>
          By providing a phone number and consenting to receive text
          messages, you agree to receive transactional text messages
          from Billio and participating coaches.
        </p>

        <p>
          These messages may include:
        </p>

        <ul>
          <li>Lesson reminders</li>
          <li>Invoice notifications</li>
          <li>Payment reminders</li>
          <li>Account-related communications</li>
        </ul>

        <p>
          Message frequency varies.
        </p>

        <p>
          Message and data rates may apply.
        </p>

        <p>
          Reply STOP at any time to opt out of SMS messages.
        </p>

        <p>
          Reply HELP for assistance.
        </p>

        <h2>Email Communications</h2>

        <p>
          Billio may send emails related to account activity,
          invoices, lessons, payments, support requests, and service
          updates.
        </p>

        <h2>Availability</h2>

        <p>
          We strive to provide reliable service but do not guarantee
          uninterrupted availability of Billio.
        </p>

        <h2>Limitation of Liability</h2>

        <p>
          To the maximum extent permitted by law, Billio shall not be
          liable for indirect, incidental, special, consequential, or
          punitive damages arising from use of the service.
        </p>

        <h2>Changes to These Terms</h2>

        <p>
          We may update these Terms from time to time. Continued use
          of Billio after changes become effective constitutes
          acceptance of the updated Terms.
        </p>

        <h2>Contact Us</h2>

        <p>
          Questions regarding these Terms may be directed to{" "}
          <a href="mailto:support@mybillioapp.com">
            support@mybillioapp.com
          </a>.
        </p>
      </div>
    </div>
  );
}

export default Terms;