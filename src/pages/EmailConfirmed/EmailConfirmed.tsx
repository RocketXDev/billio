import '../Login/Login.css';
import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";

function EmailConfirmed() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login");
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="mb">
      <div className="mb-wrapper">
        <img className="mb-logo" src="/logo-white.png" alt="Billio logo" />
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