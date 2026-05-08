import { Link } from "react-router-dom";

function EmailConfirmed() {
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

          <div className="mb-form-title">Email Verified</div>

          <p style={{ textAlign: "center", color: "#64748B", fontSize: "16px" }}>
            Your email has been verified. You can now log in to Billio.
          </p>

          <Link to="/login" style={{ width: "100%" }}>
            <button type="button">Go to Login</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default EmailConfirmed;