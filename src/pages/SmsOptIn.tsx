import "../legal.css";

export default function SmsOptIn() {
  return (
    <div className="legal-page">
      <div className="legal-card">
        <h1>Billio SMS Consent Example</h1>

        <p>
          This page demonstrates the SMS consent language used within the
          authenticated Billio application when coaches add or update student
          and parent contact information.
        </p>

        <div className="sms-example-form">
          <label>Phone Number</label>

          <input
            type="tel"
            placeholder="(719) 555-1234"
            disabled
          />

          <label className="sms-consent-box">
            <input type="checkbox" disabled />

            <span>
              I confirm that the student or parent has agreed to receive
              transactional SMS messages from Billio regarding lesson reminders,
              invoice notifications, payment reminders, and account-related
              updates. Message frequency varies. Message and data rates may
              apply. Reply STOP to opt out. Reply HELP for help. Consent is not
              required to use Billio.
            </span>
          </label>

          <p className="sms-links">
            By providing consent, users agree to the Billio{" "}
            <a href="/privacy">Privacy Policy</a> and{" "}
            <a href="/terms">Terms & Conditions</a>.
          </p>
        </div>

        <div className="sms-info-card">
          <h2>How Consent Is Collected</h2>

          <p>
            Billio does not collect SMS consent through this page.
          </p>

          <p>
            SMS consent is collected inside the authenticated Billio application
            when coaches add or update student and parent contact profiles.
          </p>

          <p>
            Billio records consent status and stores the associated contact
            information before SMS messaging is enabled.
          </p>
        </div>
      </div>
    </div>
  );
}