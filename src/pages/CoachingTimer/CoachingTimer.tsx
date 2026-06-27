import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import "./CoachingTimer.css";
import {
  FaArrowLeft
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import { useLessonTerm } from "../../hooks/useLessonTerm";

const MAX_TIMER_HOURS = 4;
const MAX_TIMER_MS = MAX_TIMER_HOURS * 60 * 60 * 1000;

export default function CoachingTimer() {
  const { coachId, identityLoading } = useCoachIdentity();
  const term = useLessonTerm();
  const queryClient = useQueryClient();

  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [showRateSheet, setShowRateSheet] = useState(false);

  const [studentName, setStudentName] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [timerRunning, setTimerRunning] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [message, setMessage] = useState("");
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timerRestored, setTimerRestored] = useState(false);

  const navigate = useNavigate();

  const today = new Date().toLocaleDateString("en-CA");

  const { data: coachRatesData } = useQuery({
    queryKey: ["coach-rates", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaches")
        .select("default_hourly_rate, custom_rates")
        .eq("id", coachId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!coachId,
  });

  const { data: coachStudents = [] } = useQuery({
    queryKey: ["coach-students", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_students")
        .select(`student_id, students(id, student_name)`)
        .eq("coach_id", coachId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!coachId,
  });

  const rateOptions: any[] = [];
  if (coachRatesData?.default_hourly_rate) {
    rateOptions.push({ name: "Default", amount: Number(coachRatesData.default_hourly_rate) });
  }
  if (Array.isArray(coachRatesData?.custom_rates)) {
    rateOptions.push(...coachRatesData.custom_rates);
  }

  const defaultRate = coachRatesData?.default_hourly_rate ?? null;

  useEffect(() => {
    if (coachRatesData && !hourlyRate && coachRatesData.default_hourly_rate) {
      setHourlyRate(String(coachRatesData.default_hourly_rate));
    }
  }, [coachRatesData]);

  useEffect(() => {
    if (coachId && !timerRestored) {
      restoreTimer();
      setTimerRestored(true);
    }
  }, [coachId]);

  useEffect(() => {
    if (!coachId && !identityLoading) navigate("/login");
  }, [coachId, identityLoading]);

  const timerRestoring = identityLoading || (!!coachId && !timerRestored);

  useEffect(() => {
    let interval: any;
    if (timerRunning && startTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setElapsedMs(elapsed);
        if (elapsed >= MAX_TIMER_MS) {
          setTimerRunning(false);
          setElapsedMs(MAX_TIMER_MS);
          setMessage(`Timer auto-stopped. Save or discard the ${term.lower}.`);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, startTime]);

  function restoreTimer() {
    const saved = localStorage.getItem("billio_active_timer");
    if (!saved) return;
    try {
      const timer = JSON.parse(saved);
      if (!timer.startTime) return;
      const elapsed = Date.now() - timer.startTime;
      setStudentName(timer.studentName || "");
      setSelectedStudentId(timer.studentId || null);
      setStartTime(timer.startTime);
      setElapsedMs(Math.min(elapsed, MAX_TIMER_MS));
      if (timer.hourlyRate) setHourlyRate(timer.hourlyRate);
      if (elapsed < MAX_TIMER_MS) {
        setTimerRunning(true);
      } else {
        setMessage(`Timer auto-stopped. Save or discard the ${term.lower}.`);
      }
    } catch { localStorage.removeItem("billio_active_timer"); }
  }

  function startTimer() {
    if (!studentName.trim()) {
      setMessage("Please select or enter a student name.");
      return;
    }
    const now = Date.now();
    setStartTime(now);
    setElapsedMs(0);
    setTimerRunning(true);
    setMessage("");
    localStorage.setItem("billio_active_timer", JSON.stringify({
      studentName: studentName.trim(),
      studentId: selectedStudentId,
      startTime: now,
      date: today,
      hourlyRate: hourlyRate,
    }));
  }

  function stopTimer() {
    setTimerRunning(false);
    setShowSavePrompt(true);
  }

  function clearTimer() {
    setTimerRunning(false);
    setStartTime(null);
    setElapsedMs(0);
    setMessage("");
    setShowSavePrompt(false);
    localStorage.removeItem("billio_active_timer");
  }

  async function getOrCreateStudent(): Promise<string | null> {
    if (!coachId) return null;
    const cleanName = studentName.trim();

    if (selectedStudentId) return selectedStudentId;

    const existingLink = coachStudents.find((link: any) =>
      link.students?.student_name?.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existingLink) return existingLink.student_id;

    const { data: newStudent, error: studentError } = await supabase
      .from("students")
      .insert({ student_name: cleanName, active: true })
      .select()
      .single();

    if (studentError || !newStudent) {
      setMessage(`Could not create student: ${studentError?.message}`);
      return null;
    }

    const { error: linkError } = await supabase
      .from("coach_students")
      .insert({ coach_id: coachId, student_id: newStudent.id });

    if (linkError) {
      setMessage(`Could not link student: ${linkError?.message}`);
      return null;
    }

    queryClient.invalidateQueries({ queryKey: ["coach-students", coachId] });
    return newStudent.id;
  }

  async function saveLesson() {
    if (!coachId || !startTime || saving) return;
    setSaving(true);

    const studentId = await getOrCreateStudent();
    if (!studentId) { setSaving(false); return; }

    const durationMinutes = Math.max(1, Math.round(elapsedMs / 60000));
    const startedAt = new Date(startTime);
    const timeString = startedAt.toTimeString().slice(0, 5);
    const parsedRate = hourlyRate ? Number(hourlyRate) : (defaultRate ?? 0);
    const rate = parseFloat(((parsedRate * durationMinutes) / 60).toFixed(2));

    const { error } = await supabase.from("lessons").insert({
      coach_id: coachId,
      student_id: studentId,
      lesson_date: today,
      start_time: timeString,
      duration_minutes: durationMinutes,
      billing_status: "unbilled",
      hourly_rate: parsedRate,
      rate,
      notes: "Created from lesson timer",
    });

    setSaving(false);

    if (error) {
      setMessage(`Could not save ${term.lower}: ${error.message}`);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
    setMessage(`${term.singular} saved successfully.`);
    clearTimer();
  }

  function formatTime(ms: number) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  const studentMatches =
    studentName.trim().length > 0
      ? coachStudents.filter((link: any) =>
          link.students?.student_name
            ?.toLowerCase()
            .includes(studentName.trim().toLowerCase())
        )
      : [];

  const progress = Math.min(elapsedMs / MAX_TIMER_MS, 1);

  // Gate on the rate/student data actually being present so the rate chips
  // and student picker don't render empty before they load in.
  const pageLoading = identityLoading || !coachId || coachRatesData === undefined;

  if (pageLoading) {
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
    <div className="timer-page">
      <div className="timer-header">
        <div className="timer-header logo-wrapper">
          <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <img src="/logo.png" alt="Billio" />
        </div>
        <h1>{term.singular} Timer</h1>
        <p>Track a {term.lower} live and save it when finished.</p>
      </div>

      <div className="timer-card">

        <div className="input-block student-search-block">
          <label htmlFor="timerStudentName">Student Name</label>
          <input
            id="timerStudentName"
            type="text"
            value={studentName}
            disabled={timerRunning}
            placeholder="Enter student name"
            autoComplete="new-password"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
            onChange={(e) => {
              setStudentName(e.target.value);
              setSelectedStudentId(null);
            }}
          />
          {studentMatches.length > 0 && !selectedStudentId && !timerRunning && (
            <div className="student-suggestions">
              {studentMatches.map((link: any) => (
                <button
                  key={link.student_id}
                  type="button"
                  className="student-suggestion"
                  onClick={() => {
                    setStudentName(link.students.student_name);
                    setSelectedStudentId(link.student_id);
                  }}
                >
                  {link.students.student_name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="input-block">
          <label>Date</label>
          <input value={today} disabled />
        </div>

        <div className="input-block">
          <label>Hourly Rate</label>
          {rateOptions.length > 0 && !timerRunning && (
            <div className="rate-options-row">
              {rateOptions.slice(0, 3).map((rate, index) => (
                <button
                  key={`${rate.name}-${index}`}
                  type="button"
                  className={`rate-option-chip ${Number(hourlyRate) === Number(rate.amount) ? "active" : ""}`}
                  onClick={() => setHourlyRate(String(rate.amount))}
                >
                  {rate.name} ${Number(rate.amount).toFixed(0)}
                </button>
              ))}
              {rateOptions.length > 3 && (
                <button
                  type="button"
                  className="rate-option-chip more-rate-chip"
                  onClick={() => setShowRateSheet(true)}
                >
                  More +{rateOptions.length - 3}
                </button>
              )}
            </div>
          )}
          <input
            type="text"
            inputMode="decimal"
            value={hourlyRate ? `$${hourlyRate}` : ""}
            disabled={timerRunning}
            placeholder="$60"
            onChange={(e) => setHourlyRate(e.target.value.replace(/[^0-9.]/g, ""))}
          />
        </div>

        <div className="timer-display">
          {timerRestoring ? (
            <div className="billio-mini-spinner" style={{ margin: "0 auto" }} />
          ) : (
            formatTime(elapsedMs)
          )}
        </div>

        <div className="timer-progress-track">
          <div
            className="timer-progress-fill"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {message && <p className="timer-message">{message}</p>}

        {!timerRunning ? (
          <button
            type="button"
            className="timer-start-btn"
            onClick={startTimer}
            disabled={identityLoading || !coachId}
          >
            {identityLoading || !coachId ? "Loading..." : `Start ${term.singular}`}
          </button>
        ) : (
          <button type="button" className="timer-stop-btn" onClick={stopTimer}>
            Stop {term.singular}
          </button>
        )}

        {showSavePrompt && (
          <div className="timer-modal-overlay">
            <div className="timer-modal">
              <h2>Save {term.lower}?</h2>
              <p>
                {formatTime(elapsedMs)} with{" "}
                <strong>{studentName || "this student"}</strong>
              </p>
              {hourlyRate && (
                <p style={{ fontSize: 14, color: "var(--secondary-text)", marginTop: 4 }}>
                  Rate: <strong>${hourlyRate}/hr</strong>
                </p>
              )}
              <div className="timer-modal-actions">
                <button
                  type="button"
                  className="timer-modal-cancel"
                  onClick={clearTimer}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className="timer-modal-save"
                  disabled={saving}
                  onClick={() => {
                    setShowSavePrompt(false);
                    saveLesson();
                  }}
                >
                  {saving ? "Saving..." : `Save ${term.singular}`}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {showRateSheet && (
        <div className="rate-sheet-overlay" onClick={() => setShowRateSheet(false)}>
          <div className="rate-sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Select Rate</h3>
            {rateOptions.map((rate, index) => (
              <button
                key={`${rate.name}-${index}`}
                type="button"
                className="rate-sheet-item"
                onClick={() => { setHourlyRate(String(rate.amount)); setShowRateSheet(false); }}
              >
                {rate.name} ${Number(rate.amount).toFixed(0)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}