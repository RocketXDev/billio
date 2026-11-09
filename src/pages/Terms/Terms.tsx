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
          Last updated: November 8, 2026
        </p>

        <p>
          Welcome to Billio. By accessing or using Billio, you agree to
          these Terms and Conditions.
        </p>

        <p>Billio is operated by Billio LLC.</p>

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

        <h2>Accept Payments</h2>

        <p>Billio lets coaches accept card and digital wallet payments from students and families ("Accept Payments"). Accept Payments is optional and available on all Billio plans. To use it, you must be at least 18 and able to enter into a binding agreement.</p>

        <h2>Payment Processing by Stripe</h2>

        <p>Payment processing services for coaches on Billio are provided by Stripe and are subject to the <a href="https://stripe.com/connect-account/legal/full" target="_blank" rel="noopener noreferrer">Stripe Connected Account Agreement</a>, which includes the <a href="https://stripe.com/legal/ssa" target="_blank" rel="noopener noreferrer">Stripe Terms of Service</a> (collectively, the "Stripe Services Agreement"). By agreeing to these Terms or continuing to operate as a coach on Billio, you agree to be bound by the Stripe Services Agreement, as the same might be modified by Stripe from time to time. As a condition of Billio enabling payment processing services through Stripe, you agree to provide Billio accurate and complete information about you and your business, and you authorize Billio to share it and transaction information related to your use of the payment processing services provided by Stripe.</p>

        <p>Stripe may request information to verify your identity and business. Stripe decides whether to approve, limit, or close your payment account.</p>

        <h2>Card Payment Fees</h2>

        <p>Billing for Accept Payments is separate from your Billio plan. Billio charges a service fee of 1% of each card payment. Stripe also charges processing fees. Both are deducted from the amount you receive, and the student or family pays only the invoice amount. We will give you at least 30 days' notice before increasing Billio's service fee.</p>

        <h2>Withdrawals</h2>

        <p>Funds remain in your Stripe balance until you request a withdrawal. Billio does not charge a fee for withdrawals. Stripe determines which accounts may use expedited transfers and shows any fee before you confirm. Stripe controls transfer timing, and Billio does not guarantee when funds will arrive.</p>

        <h2>Your Responsibilities as the Seller</h2>

        <p>You are the seller of your coaching services. You are responsible for those services, your invoices, your refund policy, and any complaints from students or families.</p>

        <p>When you refund a payment, Billio returns its service fee in proportion to the amount refunded. Stripe does not return its processing fee.</p>

        <p>You are responsible for disputes and chargebacks on your payments, including related fees and amounts owed. Those amounts may be deducted from your Stripe balance.</p>

        <h2>Billio's Role</h2>

        <p>Billio provides software that connects coaches with Stripe's payment services. Billio is not a bank, a payment processor, or a party to the transaction between a coach and a student or family. Billio is not responsible for delays, holds, or decisions made by Stripe or your bank.</p>

        <p>We may suspend or disable Accept Payments if you breach these Terms or the Stripe Services Agreement, if Stripe requires it, or to prevent fraud or harm.</p>

        <h2>Paying an Invoice</h2>

        <p>If you pay a coach through Billio, your payment goes to that coach through Stripe. The coach, not Billio, provides the services and handles refund requests. Stripe's terms and privacy policy apply to your payment.</p>

        <h2>Venmo, PayPal, and Zelle</h2>

        <p>Coaches may choose to show their own Venmo, PayPal, or Zelle details on invoices. Those services are provided by third parties under their own terms. Billio does not process, hold, or verify those payments. Marking an invoice paid in Billio does not confirm that money was received.</p>

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