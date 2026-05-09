import { Link } from "react-router-dom";

function EmailConfirmed() {
  return (
    <div className="mb">
      <div className="mb-wrapper">
        <img className="mb-logo" src="/logo.png" alt="Billio logo" />

        <div className="mb-form">
          <img
            className="mb-form-logo"
            src="/confirm_logo.png"
            alt="Email confirmed"
          />

          <div className="mb-form-title">Email Verified</div>

          <p className="mb-form-descr">
            Your email has been verified. You can now log in to Billio.
          </p>

          <Link className="mb-redirect-btn" to="/login">
            <button className="mb-btn-confirm" type="button">Go to Login</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default EmailConfirmed;