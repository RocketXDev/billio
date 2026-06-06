import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

function Support() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const [sending, setSending] = useState(false);
  const [supportSuccess, setSupportSuccess] = useState(false);
  const [supportError, setSupportError] = useState("");

  async function handleSendSupport(e: any) {
    e.preventDefault();

    if (sending) return;

    setSending(true);
    setSupportError("");
    setSupportSuccess(false);

    const { data, error } = await supabase.functions.invoke(
      "send-support-message",
      {
        body: {
          name,
          email,
          subject,
          message,
        },
      }
    );

    setSending(false);

    if (error || data?.error) {
      setSupportError(
        data?.error ||
          error?.message ||
          "Support message could not be sent."
      );
      return;
    }

    setSupportSuccess(true);
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
  }

  return (
    <div className="support-page">
      <div className="support-card">
        <h1>Contact Support</h1>

        <p>
          Have a question or issue with Billio? Send us a message and we’ll help.
        </p>

        <form onSubmit={handleSendSupport} className="support-form">
          <div className="input-block">
            <label>Name</label>
            <input
              type="text"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          <div className="input-block">
            <label>Email</label>
            <input
              type="email"
              value={email}
              maxLength={120}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="input-block">
            <label>Subject</label>
            <input
              type="text"
              value={subject}
              maxLength={120}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="How can we help?"
              required
            />
          </div>

          <div className="input-block">
            <label>Message</label>
            <textarea
              value={message}
              maxLength={3000}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what happened..."
              rows={6}
              required
            />
          </div>

          {supportError && (
            <p className="support-error">{supportError}</p>
          )}

          {supportSuccess && (
            <p className="support-success">
              Message sent successfully. We’ll get back to you soon.
            </p>
          )}

          <button type="submit" disabled={sending}>
            {sending ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Support;