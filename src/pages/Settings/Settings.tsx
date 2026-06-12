import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft,
  FaClock,
  FaFileInvoiceDollar,
  FaHashtag,
  FaRegClock,
  FaKey,
  FaTrash,
  FaCheck,
  FaChevronRight,
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import "./Settings.css";

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const DUE_DATE_OPTIONS = [
  { label: "Due on receipt", value: 0 },
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];

export default function Settings() {
  const navigate = useNavigate();
  const { coachId, identityLoading } = useCoachIdentity();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings state
  const [defaultDuration, setDefaultDuration] = useState(60);
  const [defaultDueDate, setDefaultDueDate] = useState(7);
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");

  // Password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["coach-settings", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaches")
        .select("id, default_lesson_duration, default_due_date_days, invoice_prefix, time_format")
        .eq("id", coachId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!coachId,
  });

  const loading = identityLoading || settingsLoading;

  useEffect(() => {
    if (!coachId && !identityLoading) navigate("/login");
  }, [coachId, identityLoading]);

  useEffect(() => {
    if (settingsData) {
      setDefaultDuration(settingsData.default_lesson_duration ?? 60);
      setDefaultDueDate(settingsData.default_due_date_days ?? 7);
      setInvoicePrefix(settingsData.invoice_prefix ?? "INV");
      setTimeFormat(settingsData.time_format ?? "12h");
    }
  }, [settingsData]);

  async function handleSave() {
    if (!coachId || saving) return;
    setSaving(true);

    const { error } = await supabase
      .from("coaches")
      .update({
        default_lesson_duration: defaultDuration,
        default_due_date_days: defaultDueDate,
        invoice_prefix: invoicePrefix.trim() || "INV",
        time_format: timeFormat,
      })
      .eq("id", coachId);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      queryClient.invalidateQueries({ queryKey: ["coach-settings", coachId] });
    }
  }

  async function handleChangePassword() {
    if (!newPassword || newPassword !== confirmPassword) {
      setPasswordMsg("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg("Password must be at least 8 characters.");
      return;
    }
    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    if (error) {
      setPasswordMsg(error.message);
    } else {
      setPasswordMsg("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => { setShowPasswordForm(false); setPasswordMsg(""); }, 2000);
    }
  }

    async function handleDeleteAccount() {
        if (deleteConfirmText !== "DELETE") return;
        setDeleting(false);
        setDeleteError("");

        const { data, error } = await supabase.functions.invoke("delete-account");

        if (error || data?.error) {
            setDeleting(false);
            setDeleteError("Something went wrong. Please try again or contact support@mybillioapp.com.");
            return;
        }

        await supabase.auth.signOut();
        navigate("/");
    }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="billio-loader">
          <div className="billio-loader-glow" />
          <img className="billio-loader-logo" src="/logo.png" alt="Billio" />
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">

      {/* Header */}
      <div className="settings-header">
        <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
        <FaArrowLeft />
        </button>
        <img src="/logo.png" alt="Billio" className="about-logo" />
      </div>

      <div className="settings-body">
        <h1 className="settings-title">Settings</h1>

        {/* ── Lessons ── */}
        <section className="settings-section">
          <div className="settings-section-label">
            <FaClock className="settings-section-icon" />
            Lessons
          </div>

          <div className="settings-card">
            <div className="settings-row-label">Default lesson duration</div>
            <div className="settings-chip-group">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`settings-chip${defaultDuration === d ? " active" : ""}`}
                  onClick={() => setDefaultDuration(d)}
                >
                  {d} min
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── Invoices ── */}
        <section className="settings-section">
          <div className="settings-section-label">
            <FaFileInvoiceDollar className="settings-section-icon" />
            Invoices
          </div>

          <div className="settings-card">
            <div className="settings-row-label">Default due date</div>
            <div className="settings-chip-group">
              {DUE_DATE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`settings-chip${defaultDueDate === opt.value ? " active" : ""}`}
                  onClick={() => setDefaultDueDate(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-card" style={{ marginTop: 10 }}>
            <div className="settings-row-label">
              <FaHashtag style={{ marginRight: 6, fontSize: 11 }} />
              Invoice number prefix
            </div>
            <div className="settings-prefix-row">
              <input
                type="text"
                className="settings-prefix-input"
                value={invoicePrefix}
                maxLength={6}
                onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
                placeholder="INV"
              />
              <span className="settings-prefix-preview">
                {invoicePrefix || "INV"}-{new Date().getFullYear()}-A1B2
              </span>
            </div>
          </div>
        </section>

        {/* ── App Preferences ── */}
        <section className="settings-section">
          <div className="settings-section-label">
            <FaRegClock className="settings-section-icon" />
            App Preferences
          </div>

          <div className="settings-card">
            <div className="settings-row-label">Time format</div>
            <div className="settings-chip-group">
              <button
                type="button"
                className={`settings-chip${timeFormat === "12h" ? " active" : ""}`}
                onClick={() => setTimeFormat("12h")}
              >
                12h (2:30 PM)
              </button>
              <button
                type="button"
                className={`settings-chip${timeFormat === "24h" ? " active" : ""}`}
                onClick={() => setTimeFormat("24h")}
              >
                24h (14:30)
              </button>
            </div>
          </div>
        </section>

        {/* Save button */}
        <button
          type="button"
          className="settings-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? (
            <><FaCheck style={{ marginRight: 8 }} />Saved</>
          ) : saving ? "Saving..." : "Save Settings"}
        </button>

        {/* ── Account ── */}
        <section className="settings-section">
          <div className="settings-section-label">
            <FaKey className="settings-section-icon" />
            Account
          </div>

          <div className="settings-list">
            <button
              type="button"
              className="settings-list-item"
              onClick={() => setShowPasswordForm((v) => !v)}
            >
              <span>Change Password</span>
              <FaChevronRight className="settings-list-arrow" />
            </button>

            {showPasswordForm && (
              <div className="settings-password-form">
                <div className="input-block">
                  <label>New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="settings-input"
                  />
                </div>
                <div className="input-block">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="settings-input"
                  />
                </div>
                {passwordMsg && (
                  <p className={`settings-msg${passwordMsg.includes("success") ? " success" : " error"}`}>
                    {passwordMsg}
                  </p>
                )}
                <button
                  type="button"
                  className="settings-save-btn"
                  style={{ marginTop: 4 }}
                  onClick={handleChangePassword}
                  disabled={passwordSaving}
                >
                  {passwordSaving ? "Updating..." : "Update Password"}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Danger Zone ── */}
        <section className="settings-section">
          <div className="settings-section-label danger">
            <FaTrash className="settings-section-icon" />
            Danger Zone
          </div>

          <div className="settings-list">
            <button
              type="button"
              className="settings-list-item danger"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <span>Delete Account</span>
              <FaChevronRight className="settings-list-arrow" />
            </button>
          </div>
        </section>

      </div>

      {/* Delete confirm modal */}
      {showDeleteConfirm && (
        <div className="billio-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="billio-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="billio-confirm-icon">
              <FaTrash />
            </div>
            <h2>Delete Account?</h2>
            <p>
              This permanently deletes your account, all students, lessons,
              and invoices. <strong>This cannot be undone.</strong>
            </p>
            <p style={{ marginTop: 12 }}>
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="settings-input"
              style={{ marginBottom: 16, marginTop: 8 }}
            />
            <div className="billio-confirm-actions">
              <button
                type="button"
                className="billio-cancel-btn"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="billio-danger-btn"
                disabled={deleteConfirmText !== "DELETE" || deleting}
                onClick={handleDeleteAccount}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
            {deleteError && (
                <p className="settings-msg error" style={{ marginBottom: 5, marginTop: 12 }}>
                    {deleteError}
                </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}