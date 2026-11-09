import './Privacy.css';
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";


function Privacy() {

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
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: November 8, 2026</p>

        <p>
          Billio helps coaches manage students, lessons, invoices, and related
          communications. This Privacy Policy explains how Billio collects, uses,
          and protects information.
        </p>

        <p>Billio is operated by Billio LLC.</p>

        <h2>Information We Collect</h2>
        <p>
          We may collect account information such as name, email address, phone
          number, coaching profile details, student information, lesson records,
          invoice details, and communication preferences.
        </p>

        <p>If a coach uses Accept Payments, we collect the coach's Stripe account ID and account status, and records of card payments, including amounts, fees, refunds, and disputes.</p>

        <p>Stripe collects identity and bank details, such as date of birth, government ID numbers, and bank account numbers, directly through its own forms. Billio does not store those details.</p>

        <p>When a student or family pays by card, Stripe collects the payment details on its own checkout page. Billio does not receive full card numbers.</p>

        <h2>How We Use Information</h2>
        <p>
          We use information to provide Billio services, including lesson
          tracking, student management, invoice creation, invoice delivery,
          notifications, reminders, account support, and service improvements.
        </p>

        <p>We use payment information to process and record invoice payments, show coaches what they received, send payment notifications, handle refunds and disputes, and prevent fraud.</p>

        <h2>Email and Text Communications</h2>
        <p>
          Billio may send emails or text messages related to invoices, lesson
          reminders, payment reminders, account setup, and service notifications.
          Message and data rates may apply. Users may opt out of text messages
          by replying STOP.
        </p>

        <h2>Information Sharing</h2>
        <p>
          We do not sell personal information. We may share information with
          service providers that help us operate Billio, such as payment,
          email, messaging, hosting, database, and authentication providers. SMS opt-in data and consent will not be shared with third parties or affiliates for marketing purposes.
        </p>

        <p>To provide Accept Payments, we share information with Stripe, Inc. and its affiliates. This includes a coach's name, email address, and phone number, and transaction information. For each card payment, it includes the invoice number, the amount, and an email address for the receipt.</p>

        <p>When you provide personal data in connection with Accept Payments, Stripe receives that personal data and processes it in accordance with <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe's Privacy Policy</a>.</p>

        <h2>Data Security</h2>
        <p>
          We use reasonable technical and organizational safeguards to protect
          information. However, no system is completely secure.
        </p>

        <h2>Data Retention</h2>
        <p>
          We retain information for as long as needed to provide Billio services,
          comply with legal obligations, resolve disputes, and maintain business
          records.
        </p>

        <p>We keep records of card payments after a coach account or invoice is deleted, as needed for accounting, refunds, disputes, fraud prevention, and legal obligations.</p>

        <h2>Your Choices</h2>
        <p>
          Users may update account information, communication preferences, and
          student contact information inside Billio. To request deletion or help
          with privacy questions, contact us.
        </p>

        <h2>Contact</h2>
        <p>
          If you have questions about this Privacy Policy, contact us at{" "}
          <a href="mailto:support@mybillioapp.com">
            support@mybillioapp.com
          </a>.
        </p>
      </div>
    </div>
  );
}

export default Privacy;