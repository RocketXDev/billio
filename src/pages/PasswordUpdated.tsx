import { Link, useNavigate } from "react-router-dom";

function PasswordUpdated() {
    const navigate = useNavigate();
  return (
    <>
      <div className="mb">
        <div className="mb-wrapper">
          <img className="mb-logo" src="/logo.png" alt="Billio logo" />

          <div className="mb-form">
            <img
              className="mb-form-logo"
              src="/confirm_logo.png"
              alt="Password updated"
            />

            <div className="mb-form-title">
              Password Updated!
            </div>

            <p className="verify-message">
              Your password has been successfully updated.
              You can now log in to Billio.
            </p>

            <Link to="/login" className="mb-redirect-btn">
              <button type="button">
                Go to Login
              </button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default PasswordUpdated;