import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function UpdatePassword() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleUpdatePassword(e: any) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setMessage("Password updated. You can now log in.");
    setLoading(false);
  }

  return (
    <div className="mb">
      <div className="mb-wrapper">
        <img className="mb-logo" src="/logo.png" alt="Billio logo" />

        <div className="mb-form">
          <img
            className="mb-form-logo"
            src="/login_logo.png"
            alt="Update password"
          />

          <div className="mb-form-title">Reset Password</div>

          <form onSubmit={handleUpdatePassword}>
            <div className="input-block">
              <label htmlFor="password">New Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {message && <p className="error-message">{message}</p>}

            <button type="submit" disabled={loading}>
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default UpdatePassword;