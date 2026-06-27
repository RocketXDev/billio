import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaArrowLeft, FaGoogle, FaSync, FaCheck, FaTimes,
  FaHome, FaCalendarAlt, FaUsers, FaFileInvoiceDollar, FaEllipsisH,
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import { useSettings } from "../../hooks/useSettings";
import { useLessonTerm } from "../../hooks/useLessonTerm";
import "../RecurringLessons/RecurringLessons.css";
import "../AiAssistant/AiAssistant.css";
import "../Lessons/Lessons.css";
import "./GoogleCalendar.css";

const PRESET_EVENT_COLORS = ["#3b33d9", "#f59e0b", "#3b82f6", "#22c55e", "#dc2626"];

type GoogleStatus = {
  connected: boolean;
  calendarName?: string;
  lastSyncedAt?: string | null;
  syncLessons?: boolean;
  syncEvents?: boolean;
};

export default function GoogleCalendar() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { coachId, identityLoading } = useCoachIdentity();
  const { settings } = useSettings();
  const term = useLessonTerm();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Calendar picker shown right after the OAuth redirect comes back
  const [calendarChoices, setCalendarChoices] = useState<{ id: string; summary: string }[] | null>(null);
  const [choosingCalendar, setChoosingCalendar] = useState(false);

  // Pending import approval state
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [studentChoice, setStudentChoice] = useState<Record<string, string>>({});
  const [studentNameInput, setStudentNameInput] = useState<Record<string, string>>({});
  const [colorChoice, setColorChoice] = useState<Record<string, string>>({});
  const [rateChoice, setRateChoice] = useState<Record<string, string>>({});

  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const { data: coachStudents = [] } = useQuery<any[]>({
    queryKey: ["coach-students", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_students")
        .select("student_id, students(id, student_name)")
        .eq("coach_id", coachId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!coachId,
  });

  const { data: pendingImports = [], isLoading: importsLoading } = useQuery({
    queryKey: ["google-pending-imports", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("google_calendar_pending_imports")
        .select("*")
        .eq("coach_id", coachId)
        .eq("status", "pending")
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!coachId && !!status?.connected,
  });

  async function callFunction(action: string, extra: any = {}) {
    const { data, error } = await supabase.functions.invoke("google-calendar", {
      body: { action, ...extra },
    });
    if (error || data?.error) throw new Error(data?.error || error?.message || "Something went wrong.");
    return data;
  }

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      const data = await callFunction("status");
      setStatus(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    if (!coachId && !identityLoading) navigate("/login");
  }, [coachId, identityLoading]);

  useEffect(() => {
    if (!coachId) return;

    const code = searchParams.get("code");
    if (code) {
      (async () => {
        setConnecting(true);
        setErrorMsg("");
        try {
          const redirectUri = `${window.location.origin}/google-calendar`;
          const data = await callFunction("exchange-code", { code, redirectUri });
          setCalendarChoices(data.calendars || []);
        } catch (err: any) {
          setErrorMsg(err.message);
        } finally {
          setConnecting(false);
          setLoadingStatus(false);
          setSearchParams({}, { replace: true });
        }
      })();
    } else {
      loadStatus();
    }
  }, [coachId]);

  function handleConnect() {
    const redirectUri = `${window.location.origin}/google-calendar`;
    const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || "").trim();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      prompt: "select_account consent",
      scope: "https://www.googleapis.com/auth/calendar",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async function handleChooseCalendar(choice: { calendarId?: string; calendarName?: string; createNew: boolean }) {
    setChoosingCalendar(true);
    setErrorMsg("");
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await callFunction("choose-calendar", { ...choice, timeZone });
      setCalendarChoices(null);
      await loadStatus();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setChoosingCalendar(false);
    }
  }

  async function handleOpenCalendarPicker() {
    setErrorMsg("");
    try {
      const data = await callFunction("list-calendars");
      setCalendarChoices(data.calendars || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  async function handleSyncNow(fullResync = false) {
    setSyncing(true);
    setErrorMsg("");
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await callFunction("pull", { timeZone, fullResync });
      await loadStatus();
      queryClient.invalidateQueries({ queryKey: ["google-pending-imports", coachId] });
      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
      queryClient.invalidateQueries({ queryKey: ["events", coachId] });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggleSetting(key: "syncLessons" | "syncEvents") {
    if (!status) return;
    const next = !status[key];
    setStatus({ ...status, [key]: next });
    try {
      await callFunction("update-settings", { [key]: next });
    } catch (err: any) {
      setErrorMsg(err.message);
      setStatus({ ...status, [key]: !next });
    }
  }

  async function handleDisconnect() {
    setShowDisconnectConfirm(false);
    setDisconnecting(true);
    try {
      await callFunction("disconnect");
      setCalendarChoices(null);
      await loadStatus();
      queryClient.invalidateQueries({ queryKey: ["google-pending-imports", coachId] });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleApprove(imp: any, studentIdOverride?: string) {
    setApprovingId(imp.id);
    setErrorMsg("");
    try {
      if (imp.kind === "lesson") {
        const studentId = studentIdOverride || studentChoice[imp.id];
        if (!studentId) {
          alert("Please choose or create a student first.");
          return;
        }
        await callFunction("approve-import", { importId: imp.id, studentId, hourlyRate: rateChoice[imp.id] || null });
      } else {
        await callFunction("approve-import", { importId: imp.id, color: colorChoice[imp.id] || PRESET_EVENT_COLORS[0] });
      }
      queryClient.invalidateQueries({ queryKey: ["google-pending-imports", coachId] });
      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
      queryClient.invalidateQueries({ queryKey: ["events", coachId] });
      queryClient.invalidateQueries({ queryKey: ["coach-students", coachId] });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleDismiss(imp: any) {
    setApprovingId(imp.id);
    try {
      await callFunction("dismiss-import", { importId: imp.id });
      queryClient.invalidateQueries({ queryKey: ["google-pending-imports", coachId] });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setApprovingId(null);
    }
  }

  async function resolveStudentForImport(importId: string): Promise<string | null> {
    const typed = (studentNameInput[importId] || "").trim();
    if (!typed) return null;

    const existing = coachStudents.find(
      (link: any) => link.students?.student_name?.trim().toLowerCase() === typed.toLowerCase()
    );
    if (existing) return existing.student_id;

    const { data: newStudent, error } = await supabase
      .from("students").insert({ student_name: typed, active: true }).select().single();
    if (error || !newStudent) return null;

    await supabase.from("coach_students").insert({ coach_id: coachId, student_id: newStudent.id });
    queryClient.invalidateQueries({ queryKey: ["coach-students", coachId] });
    return newStudent.id;
  }

  function formatTime(hoursStr: string, minutesStr: string) {
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return `${hoursStr}:${minutesStr}`;

    if (settings.timeFormat === "24h") {
      return `${hoursStr.padStart(2, "0")}:${minutesStr.padStart(2, "0")}`;
    }

    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutesStr.padStart(2, "0")} ${period}`;
  }

  function formatImportDateTime(imp: any) {
    if (imp.kind === "event") {
      return new Date(imp.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    }
    const [hoursStr, minutesStr] = (imp.start_time || "00:00").split(":");
    const dateLabel = new Date(imp.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
    return `${dateLabel} at ${formatTime(hoursStr, minutesStr)}`;
  }

  if (identityLoading || loadingStatus || connecting) {
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
    <div className="rl-page gc-page">
      <div className="rl-header">
        <div className="rl-header-top">
          <button type="button" className="up-back-btn" onClick={() => navigate("/more")}>
            <FaArrowLeft />
          </button>
          <img src="/logo.png" alt="Billio" className="about-logo" />
          <div style={{ width: 38 }} />
        </div>
        <h1 className="rl-title">Google Calendar Sync</h1>
        <p className="rl-subtitle">Two-way sync your {term.lowerPlural} and events with Google Calendar.</p>
      </div>

      <div className="rl-body">
        {errorMsg && <p className="ai-assistant-error">{errorMsg}</p>}

        {calendarChoices ? (
          <div className="gc-card">
            <h3>Choose a calendar</h3>
            <p>Sync your {term.lowerPlural} and events to a new calendar, or pick one you already have.</p>

            {calendarChoices.some((cal) => cal.summary === "My Billio Calendar") ? (
              <p className="gc-existing-calendar-note">
                You already have a "My Billio Calendar" — pick it below instead of creating another one.
              </p>
            ) : (
              <button
                type="button"
                className="gc-calendar-create-btn"
                disabled={choosingCalendar}
                onClick={() => handleChooseCalendar({ createNew: true })}
              >
                <FaGoogle /> Create "My Billio Calendar"
              </button>
            )}

            {calendarChoices.length > 0 && (
              <>
                <div className="gc-picker-divider">or pick an existing calendar</div>
                {calendarChoices.map((cal) => (
                  <button
                    key={cal.id}
                    type="button"
                    className="gc-calendar-option"
                    disabled={choosingCalendar}
                    onClick={() => handleChooseCalendar({ createNew: false, calendarId: cal.id, calendarName: cal.summary })}
                  >
                    {cal.summary}
                  </button>
                ))}
              </>
            )}

            <div className="gc-picker-footer">
              {status?.connected && (
                <button
                  type="button"
                  className="gc-cancel-picker-btn"
                  disabled={choosingCalendar}
                  onClick={() => setCalendarChoices(null)}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="gc-disconnect-btn"
                disabled={disconnecting}
                onClick={() => setShowDisconnectConfirm(true)}
              >
                {disconnecting ? "Disconnecting..." : "Disconnect Google Calendar"}
              </button>
            </div>
          </div>
        ) : !status?.connected ? (
          <div className="gc-card gc-connect-card">
            <FaGoogle className="gc-connect-icon" />
            <h3>Connect Google Calendar</h3>
            <p>Push your {term.lowerPlural} and events to Google, and pull in events from Google to review and add to Billio.</p>
            <button type="button" className="gc-connect-btn" onClick={handleConnect}>
              Connect Google Calendar
            </button>
          </div>
        ) : (
          <>
            <div className="gc-card">
              <div className="gc-connected-row">
                <div className="gc-connected-icon"><FaGoogle /></div>
                <div className="gc-connected-info">
                  <strong>{status.calendarName}</strong>
                  <span>
                    {status.lastSyncedAt
                      ? `Last synced ${new Date(status.lastSyncedAt).toLocaleString()}`
                      : "Not synced yet"}
                  </span>
                </div>
                <button type="button" className="gc-change-calendar-btn" onClick={handleOpenCalendarPicker}>
                  Change
                </button>
              </div>

              <div className="gc-toggle-row">
                <span>Sync {term.plural}</span>
                <button
                  type="button"
                  className={`lesson-recurring-toggle-btn ${status.syncLessons ? "active" : ""}`}
                  onClick={() => handleToggleSetting("syncLessons")}
                >
                  <span className="lesson-recurring-toggle-knob" />
                </button>
              </div>
              <div className="gc-toggle-row">
                <span>Sync Events</span>
                <button
                  type="button"
                  className={`lesson-recurring-toggle-btn ${status.syncEvents ? "active" : ""}`}
                  onClick={() => handleToggleSetting("syncEvents")}
                >
                  <span className="lesson-recurring-toggle-knob" />
                </button>
              </div>

              <div className="gc-action-row">
                <button type="button" className="gc-sync-btn" disabled={syncing} onClick={() => handleSyncNow()}>
                  <FaSync className={syncing ? "gc-spin" : ""} /> {syncing ? "Syncing..." : "Sync Now"}
                </button>
              </div>

              <button type="button" className="gc-force-resync-link" disabled={syncing} onClick={() => handleSyncNow(true)}>
                Times look wrong? Force a full resync
              </button>
            </div>

            <h2 className="gc-section-title">Pending Review ({pendingImports.length})</h2>

            {importsLoading ? (
              <p className="empty-lessons">Loading...</p>
            ) : pendingImports.length === 0 ? (
              <p className="empty-lessons">No new events to review. Click "Sync Now" to check for new ones.</p>
            ) : (
              pendingImports.map((imp: any) => {
                const matches =
                  imp.kind === "lesson" && (studentNameInput[imp.id] || "").trim().length > 0
                    ? coachStudents.filter((link: any) =>
                        link.students?.student_name?.toLowerCase().includes((studentNameInput[imp.id] || "").trim().toLowerCase())
                      )
                    : [];

                return (
                  <div key={imp.id} className="ai-assistant-draft-card">
                    <h3>{imp.title}</h3>
                    <p>{formatImportDateTime(imp)}</p>
                    {imp.description && <p className="ai-assistant-draft-notes">{imp.description}</p>}

                    {imp.kind === "lesson" ? (
                      <div className="gc-import-form-row" style={{ marginTop: 10 }}>
                        <div className="input-block student-search-block gc-import-student-block">
                          <label>Student</label>
                          <input
                            type="text"
                            value={studentChoice[imp.id] ? coachStudents.find((l: any) => l.student_id === studentChoice[imp.id])?.students?.student_name || "" : studentNameInput[imp.id] || ""}
                            onChange={(e) => {
                              setStudentNameInput((prev) => ({ ...prev, [imp.id]: e.target.value }));
                              setStudentChoice((prev) => ({ ...prev, [imp.id]: "" }));
                            }}
                            placeholder="Search or add a student"
                          />
                          {matches.length > 0 && !studentChoice[imp.id] && (
                            <div className="student-suggestions">
                              {matches.map((link: any) => (
                                <button
                                  key={link.student_id}
                                  type="button"
                                  className="student-suggestion"
                                  onClick={() => {
                                    setStudentChoice((prev) => ({ ...prev, [imp.id]: link.student_id }));
                                    setStudentNameInput((prev) => ({ ...prev, [imp.id]: link.students.student_name }));
                                  }}
                                >
                                  {link.students.student_name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="input-block gc-import-rate-block">
                          <label>Rate</label>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={rateChoice[imp.id] ? `$${rateChoice[imp.id]}` : ""}
                            onChange={(e) =>
                              setRateChoice((prev) => ({ ...prev, [imp.id]: e.target.value.replace(/[^0-9.]/g, "") }))
                            }
                            placeholder="$60"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="event-color-row" style={{ marginTop: 10 }}>
                        {PRESET_EVENT_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={`event-color-swatch ${(colorChoice[imp.id] || PRESET_EVENT_COLORS[0]) === color ? "active" : ""}`}
                            style={{ background: color }}
                            onClick={() => setColorChoice((prev) => ({ ...prev, [imp.id]: color }))}
                          />
                        ))}
                      </div>
                    )}

                    <div className="ai-assistant-draft-actions">
                      <button
                        type="button"
                        className="ai-assistant-draft-cancel"
                        disabled={approvingId === imp.id}
                        onClick={() => handleDismiss(imp)}
                      >
                        <FaTimes />
                      </button>
                      <button
                        type="button"
                        className="ai-assistant-draft-confirm"
                        disabled={approvingId === imp.id}
                        onClick={async () => {
                          if (imp.kind === "lesson" && !studentChoice[imp.id]) {
                            const resolvedId = await resolveStudentForImport(imp.id);
                            if (!resolvedId) {
                              alert("Please enter a student name.");
                              return;
                            }
                            await handleApprove(imp, resolvedId);
                            return;
                          }
                          handleApprove(imp);
                        }}
                      >
                        <FaCheck /> {approvingId === imp.id ? "Saving..." : "Approve"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {showDisconnectConfirm && (
        <div className="billio-confirm-overlay" onClick={() => setShowDisconnectConfirm(false)}>
          <div className="billio-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="billio-confirm-icon" style={{ background: "#eef2ff", color: "#3b33d9" }}>
              <FaGoogle />
            </div>
            <h2>Disconnect Google Calendar?</h2>
            <p>Your synced {term.lowerPlural} and events stay in Billio, but they'll stop syncing.</p>
            <div className="billio-confirm-actions">
              <button type="button" className="billio-cancel-btn" onClick={() => setShowDisconnectConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="billio-danger-btn" disabled={disconnecting} onClick={handleDisconnect}>
                {disconnecting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate("/dashboard")}><FaHome /><span>Dashboard</span></div>
        <div className="nav-item" onClick={() => navigate("/lessons")}><FaCalendarAlt /><span>{term.plural}</span></div>
        <div className="nav-item" onClick={() => navigate("/students")}><FaUsers /><span>Students</span></div>
        <div className="nav-item" onClick={() => navigate("/invoices")}><FaFileInvoiceDollar /><span>Invoices</span></div>
        <div className="nav-item" onClick={() => navigate("/more")}><FaEllipsisH /><span>More</span></div>
      </nav>
    </div>
  );
}
