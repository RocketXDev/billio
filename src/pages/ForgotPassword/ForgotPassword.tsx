import '../Login/Login.css';
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleForgotPassword(e: any) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password reset link sent. Please check your email.");
    setLoading(false);
  }

  return (
    <>
      <div className="mb">
        <div className="mb-wrapper">
          <img className="mb-logo" src="/logo.png" alt="Billio logo" />

          <div className="mb-form">
            <img
              className="mb-form-logo"
              src="/forgot_logo.png"
              alt="Forgot password"
            />

            <div className="mb-form-title">Reset Password</div>

            <p className="verify-message">
              Enter your email and we’ll send you a link to reset your password.
            </p>

            <form onSubmit={handleForgotPassword}>
              <div className="input-block">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {message && (
                <div className="billio-confirm-overlay" onClick={() => setMessage("")}>
                  <div className="billio-confirm-card" onClick={(e) => e.stopPropagation()}>
                    <div className="billio-confirm-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
                      ✓
                    </div>
                    <h2>Check your email</h2>
                    <p>A password reset link has been sent to <strong>{email}</strong>.</p>
                    <div className="billio-confirm-actions" style={{ gridTemplateColumns: "1fr" }}>
                      <button
                        type="button"
                        className="billio-danger-btn"
                        style={{ background: "var(--primary-purple)" }}
                        onClick={() => setMessage("")}
                      >
                        Got it
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading}>
                Send Reset Link
              </button>
            </form>
          </div>

          <div className="mb-signup">
            Remember your password? <Link to="/login">Login</Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default ForgotPassword;