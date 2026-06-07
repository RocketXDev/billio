import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import "./CoachingTimer.css";
import {
  FaArrowLeft
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const MAX_TIMER_HOURS = 4;
const MAX_TIMER_MS = MAX_TIMER_HOURS * 60 * 60 * 1000;

export default function CoachingTimer() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [defaultRate, setDefaultRate] = useState<number | null>(null);

  // Same pattern as Lessons.tsx
  const [coachStudents, setCoachStudents] = useState<any[]>([]);
  const [studentName, setStudentName] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [timerRunning, setTimerRunning] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [message, setMessage] = useState("");
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();

  const today = new Date().toLocaleDateString("en-CA");

  useEffect(() => {
    loadCoach();
  }, []);

  useEffect(() => {
    if (coachId) {
      loadCoachStudents();
      restoreTimer();
    }
  }, [coachId]);

  useEffect(() => {
    let interval: any;
    if (timerRunning && startTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        setElapsedMs(elapsed);
        if (elapsed >= MAX_TIMER_MS) {
          setTimerRunning(false);
          setElapsedMs(MAX_TIMER_MS);
          setMessage("Timer auto-stopped. Save or discard the lesson.");
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning, startTime]);

  async function loadCoach() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!profileData) return;

    const { data: coachData } = await supabase
      .from("coaches")
      .select("id, default_hourly_rate")
      .eq("profile_id", profileData.id)
      .single();
    if (!coachData) return;

    setCoachId(coachData.id);
    setDefaultRate(coachData.default_hourly_rate ?? null);
  }

  async function loadCoachStudents() {
    if (!coachId) return;

    const { data, error } = await supabase
      .from("coach_students")
      .select(`
        student_id,
        students (
          id,
          student_name
        )
      `)
      .eq("coach_id", coachId);

    if (error) { console.log("Load students error:", error); return; }
    setCoachStudents(data || []);
  }

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
      if (elapsed < MAX_TIMER_MS) {
        setTimerRunning(true);
      } else {
        setMessage("Timer auto-stopped. Save or discard the lesson.");
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

        await loadCoachStudents();
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
    const rate = defaultRate
        ? parseFloat(((defaultRate * durationMinutes) / 60).toFixed(2))
        : null;

    const { error } = await supabase.from("lessons").insert({
        coach_id: coachId,
        student_id: studentId,
        lesson_date: today,
        start_time: timeString,
        duration_minutes: durationMinutes,
        billing_status: "unbilled",
        hourly_rate: defaultRate,
        rate,
        notes: "Created from lesson timer",
    });

    setSaving(false);

    if (error) {
        setMessage(`Could not save lesson: ${error.message}`);
        return;
    }

    setMessage("Lesson saved successfully.");
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

  return (
    <div className="timer-page">
        <div className="timer-header">
            <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
                <FaArrowLeft />
            </button>
            <h1>Lesson Timer</h1>
            <p>Track a lesson live and save it when finished.</p>
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

        <div className="timer-display">{formatTime(elapsedMs)}</div>

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
            disabled={!coachId}
          >
            {coachId ? "Start Lesson" : "Loading..."}
          </button>
        ) : (
          <button type="button" className="timer-stop-btn" onClick={stopTimer}>
            Stop Lesson
          </button>
        )}

        {showSavePrompt && (
          <div className="timer-modal-overlay">
            <div className="timer-modal">
              <h2>Save lesson?</h2>
              <p>
                {formatTime(elapsedMs)} with{" "}
                <strong>{studentName || "this student"}</strong>
              </p>
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
                  {saving ? "Saving..." : "Save Lesson"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}