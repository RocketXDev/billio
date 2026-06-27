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

const DURATION_OPTIONS = [30, 45, 60, 90, 120];
const DUE_DATE_OPTIONS = [
  { label: "Due on receipt", value: 0 },
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
];
const TERM_PRESETS = [
  { singular: "Lesson", plural: "Lessons" },
  { singular: "Session", plural: "Sessions" },
  { singular: "Event", plural: "Events" },
  { singular: "Appointment", plural: "Appointments" },
  { singular: "Meeting", plural: "Meetings" },
];

export default function Settings() {
  const navigate = useNavigate();
  const { coachId, identityLoading } = useCoachIdentity();
  const queryClient = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Settings state
  const [defaultDuration, setDefaultDuration] = useState(60);
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState("");
  const [defaultDueDate, setDefaultDueDate] = useState(7);
  const [invoicePrefix, setInvoicePrefix] = useState("INV");
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");
  const [lessonTermSingular, setLessonTermSingular] = useState("Lesson");
  const [lessonTermPlural, setLessonTermPlural] = useState("Lessons");
  const [useCustomTerm, setUseCustomTerm] = useState(false);

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
        .select(
          "id, default_lesson_duration, default_due_date_days, invoice_prefix, time_format, lesson_term_singular, lesson_term_plural"
        )
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
      const dur = settingsData.default_lesson_duration ?? 60;
      setDefaultDuration(dur);
      if (!DURATION_OPTIONS.includes(dur)) {
        setUseCustomDuration(true);
        setCustomDuration(String(dur));
      }
      setDefaultDueDate(settingsData.default_due_date_days ?? 7);
      setInvoicePrefix(settingsData.invoice_prefix ?? "INV");
      setTimeFormat(settingsData.time_format ?? "12h");

      const singular = settingsData.lesson_term_singular || "Lesson";
      const plural = settingsData.lesson_term_plural || "Lessons";
      setLessonTermSingular(singular);
      setLessonTermPlural(plural);
      if (!TERM_PRESETS.some((p) => p.singular === singular && p.plural === plural)) {
        setUseCustomTerm(true);
      }
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
        lesson_term_singular: lessonTermSingular.trim() || "Lesson",
        lesson_term_plural: lessonTermPlural.trim() || "Lessons",
      })
      .eq("id", coachId);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      queryClient.invalidateQueries({ queryKey: ["coach-settings", coachId] });
      queryClient.invalidateQueries({ queryKey: ["settings", coachId] });
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
            {lessonTermPlural}
          </div>

          <div className="settings-card">
            <div className="settings-row-label">What do you call a {lessonTermSingular.toLowerCase()}?</div>
            <div className="settings-chip-group">
              {TERM_PRESETS.map((preset) => (
                <button
                  key={preset.singular}
                  type="button"
                  className={`settings-chip${
                    !useCustomTerm && lessonTermSingular === preset.singular && lessonTermPlural === preset.plural
                      ? " active"
                      : ""
                  }`}
                  onClick={() => {
                    setUseCustomTerm(false);
                    setLessonTermSingular(preset.singular);
                    setLessonTermPlural(preset.plural);
                  }}
                >
                  {preset.plural}
                </button>
              ))}
              <button
                type="button"
                className={`settings-chip${useCustomTerm ? " active" : ""}`}
                onClick={() => setUseCustomTerm(true)}
              >
                Custom
              </button>
            </div>
            {useCustomTerm && (
              <div className="settings-custom-duration-row">
                <input
                  type="text"
                  className="settings-prefix-input"
                  style={{ width: 110 }}
                  value={lessonTermSingular}
                  maxLength={24}
                  placeholder="Session"
                  onChange={(e) => setLessonTermSingular(e.target.value)}
                />
                <input
                  type="text"
                  className="settings-prefix-input"
                  style={{ width: 110 }}
                  value={lessonTermPlural}
                  maxLength={24}
                  placeholder="Sessions"
                  onChange={(e) => setLessonTermPlural(e.target.value)}
                />
                <span className="settings-prefix-preview">singular / plural</span>
              </div>
            )}
          </div>

          <div className="settings-card" style={{ marginTop: 10 }}>
            <div className="settings-row-label">Default {lessonTermSingular.toLowerCase()} duration</div>
            <div className="settings-chip-group">
              {DURATION_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`settings-chip${!useCustomDuration && defaultDuration === d ? " active" : ""}`}
                  onClick={() => { setDefaultDuration(d); setUseCustomDuration(false); setCustomDuration(""); }}
                >
                  {d} min
                </button>
              ))}
              <button
                type="button"
                className={`settings-chip${useCustomDuration ? " active" : ""}`}
                onClick={() => {
                  if (!useCustomDuration) {
                    setUseCustomDuration(true);
                    const val = parseInt(customDuration, 10);
                    if (val > 0) setDefaultDuration(val);
                  }
                }}
              >
                Custom
              </button>
            </div>
            {useCustomDuration && (
              <div className="settings-custom-duration-row">
                <input
                  type="number"
                  min={1}
                  max={480}
                  className="settings-prefix-input"
                  style={{ width: 80 }}
                  value={customDuration}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    setCustomDuration(raw);
                    const val = parseInt(raw, 10);
                    if (val > 0) setDefaultDuration(val);
                  }}
                />
                <span className="settings-prefix-preview">minutes</span>
              </div>
            )}
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
              This permanently deletes your account, all students, {lessonTermPlural.toLowerCase()},
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