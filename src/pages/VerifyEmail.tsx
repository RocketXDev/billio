import { Link } from "react-router-dom";

function VerifyEmail() {
  return (
    <div className="mb">
      <div className="mb-wrapper">
        <img className="mb-logo" src="/logo.png" alt="Billio logo" />

        <div className="mb-form">
          <img
            className="mb-form-logo"
            src="/login_logo.png"
            alt="Email confirmed"
          />

          <div className="mb-form-title">Check Your Email</div>

          <p className="mb-form-descr">
            We sent you a verification link. Please confirm your email before
            logging in to Billio.
          </p>

          <Link className="mb-redirect-btn" to="/signup">
            <button className="mb-btn-confirm" type="button">Back to Signup</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;