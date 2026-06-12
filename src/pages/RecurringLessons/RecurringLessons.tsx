import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaPlus, FaEdit, FaTrash, FaRedoAlt,
  FaHome, FaCalendarAlt, FaUsers, FaFileInvoiceDollar, FaEllipsisH,
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import "./RecurringLessons.css";

const DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MAX_MONTHS = 12;

function generateOccurrences(
  startDate: string,
  endDate: string,
  frequency: "weekly" | "biweekly",
  daysOfWeek: string[]
): string[] {
  const dates: string[] = [];
  const end = new Date(endDate + "T00:00:00");
  const maxEnd = new Date(startDate + "T00:00:00");
  maxEnd.setMonth(maxEnd.getMonth() + MAX_MONTHS);
  const cap = end < maxEnd ? end : maxEnd;
  const dayIndexes = daysOfWeek.map((d) => DAYS.indexOf(d)).filter((i) => i >= 0);
  const jsToMon = (jsDay: number) => (jsDay === 0 ? 6 : jsDay - 1);
  let cur = new Date(startDate + "T00:00:00");
  const startWeekMs = new Date(startDate + "T00:00:00").getTime();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  while (cur <= cap) {
    const monDay = jsToMon(cur.getDay());
    if (dayIndexes.includes(monDay)) {
      if (frequency === "weekly") {
        dates.push(cur.toLocaleDateString("en-CA"));
      } else {
        const weekDiff = Math.floor((cur.getTime() - startWeekMs) / msPerWeek);
        if (weekDiff % 2 === 0) dates.push(cur.toLocaleDateString("en-CA"));
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export default function RecurringLessons() {
  const navigate = useNavigate();
  const { coachId, identityLoading } = useCoachIdentity();
  const queryClient = useQueryClient();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingSeries, setEditingSeries] = useState<any>(null);

  // Student search — same as Lessons.tsx / Dashboard.tsx
  const [studentName, setStudentName] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formDuration, setFormDuration] = useState("60");
  const [formHourlyRate, setFormHourlyRate] = useState("");
  const [formFrequency, setFormFrequency] = useState<"weekly"|"biweekly">("weekly");
  const [formDays, setFormDays] = useState<string[]>([]);
  const [formNotes, setFormNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Calendar — same as Invoices.tsx
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [isClosingCalendar, setIsClosingCalendar] = useState(false);

  // Delete confirm
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const previewCount =
    rangeStart && rangeEnd && formDays.length > 0
      ? generateOccurrences(rangeStart, rangeEnd, formFrequency, formDays).length
      : 0;

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

  const { data: coachStudents = [], isLoading: studentsLoading } = useQuery({
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

  const { data: series = [], isLoading: seriesLoading } = useQuery({
    queryKey: ["recurring-lessons", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_lessons")
        .select("*, students(student_name)")
        .eq("coach_id", coachId)
        .eq("active", true)
        .order("start_date", { ascending: false });
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

  useEffect(() => {
    if (!coachId && !identityLoading) navigate("/login");
  }, [coachId, identityLoading]);

  useEffect(() => {
    if (coachRatesData?.default_hourly_rate && !formHourlyRate) {
      setFormHourlyRate(String(coachRatesData.default_hourly_rate));
    }
  }, [coachRatesData]);

  const loading = identityLoading || studentsLoading || seriesLoading;

  // Student autocomplete — same as Dashboard.tsx
  const studentMatches =
    studentName.trim().length > 0
      ? coachStudents.filter((link: any) =>
          link.students?.student_name
            ?.toLowerCase()
            .includes(studentName.trim().toLowerCase())
        )
      : [];

  function openNewForm() {
    setEditingSeries(null);
    setStudentName("");
    setSelectedStudentId(null);
    setFormTitle("");
    setFormStartTime("09:00");
    setFormDuration("60");
    setFormHourlyRate(rateOptions[0] ? String(rateOptions[0].amount) : "");
    setFormFrequency("weekly");
    setFormDays([]);
    setFormNotes("");
    // Default range: today → 1 months
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString("en-CA");
    const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString("en-CA");
    setRangeStart(firstOfMonth);
    setRangeEnd(lastOfMonth);
    setCalendarMonth(new Date());
    setShowDateRangePicker(false);
    setShowForm(true);
  }

  function openEditForm(s: any) {
    setEditingSeries(s);
    setStudentName(s.students?.student_name || "");
    setSelectedStudentId(s.student_id);
    setFormTitle(s.title || "");
    setFormStartTime(s.start_time?.slice(0, 5) || "09:00");
    setFormDuration(String(s.duration_minutes));
    setFormHourlyRate(String(s.hourly_rate || ""));
    setFormFrequency(s.frequency);
    setFormDays(s.days_of_week || []);
    setRangeStart(s.start_date);
    setRangeEnd(s.end_date || "");
    setFormNotes(s.notes || "");
    setCalendarMonth(new Date(s.start_date + "T00:00:00"));
    setShowDateRangePicker(false);
    setShowForm(true);
  }

  function toggleDay(day: string) {
    setFormDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  // Calendar logic — exact same as Invoices.tsx
  function getCalendarDays() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (string | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(year, month, day).toLocaleDateString("en-CA"));
    }
    return days;
  }

  function formatDateRangeLabel() {
    if (!rangeStart && !rangeEnd) return "Select date range";
    if (rangeStart && !rangeEnd) return `${rangeStart} → End date`;
    return `${rangeStart} → ${rangeEnd}`;
  }

  async function handleDateRangeSelect(dateValue: string) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dateValue);
      setRangeEnd("");
      return;
    }
    if (dateValue < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(dateValue);
    } else {
      setRangeEnd(dateValue);
    }
    setIsClosingCalendar(true);
    setTimeout(() => {
      setShowDateRangePicker(false);
      setIsClosingCalendar(false);
    }, 220);
  }

  async function getOrCreateStudent(): Promise<string | null> {
    if (!coachId) return null;
    if (selectedStudentId) return selectedStudentId;
    const cleanName = studentName.trim();
    if (!cleanName) return null;

    // Check existing
    const existing = coachStudents.find((link: any) =>
      link.students?.student_name?.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) return existing.student_id;

    // Create new
    const { data: newStudent, error } = await supabase
      .from("students").insert({ student_name: cleanName, active: true }).select().single();
    if (error || !newStudent) return null;

    await supabase.from("coach_students").insert({ coach_id: coachId, student_id: newStudent.id });
    queryClient.invalidateQueries({ queryKey: ["coach-students", coachId] });
    return newStudent.id;
  }

  async function handleSave() {
    if (isSaving) return;
    if (!studentName.trim() && !selectedStudentId) { alert("Please enter or select a student."); return; }
    if (formDays.length === 0) { alert("Please select at least one day."); return; }
    if (!rangeStart || !rangeEnd) { alert("Please select a date range."); return; }
    if (rangeEnd <= rangeStart) { alert("End date must be after start date."); return; }

    setIsSaving(true);
    try {
      const studentId = await getOrCreateStudent();
      if (!studentId) { alert("Could not resolve student."); return; }

      const seriesPayload = {
        coach_id: coachId,
        student_id: studentId,
        title: formTitle || null,
        start_time: formStartTime,
        duration_minutes: Number(formDuration),
        hourly_rate: formHourlyRate ? Number(formHourlyRate) : null,
        frequency: formFrequency,
        days_of_week: formDays,
        start_date: rangeStart,
        end_date: rangeEnd,
        notes: formNotes || null,
        active: true,
        updated_at: new Date().toISOString(),
      };

      let seriesId = editingSeries?.id;

      if (editingSeries) {
        await supabase.from("recurring_lessons").update(seriesPayload).eq("id", seriesId);
        await supabase.from("lessons")
          .delete()
          .eq("recurring_series_id", seriesId)
          .eq("billing_status", "unbilled")
          .gte("lesson_date", new Date().toLocaleDateString("en-CA"));
      } else {
        const { data: newSeries, error } = await supabase
          .from("recurring_lessons").insert(seriesPayload).select().single();
        if (error || !newSeries) { alert("Could not create series: " + error?.message); return; }
        seriesId = newSeries.id;
      }

      const genStart = editingSeries ? new Date().toLocaleDateString("en-CA") : rangeStart;
      const occurrences = generateOccurrences(genStart, rangeEnd, formFrequency, formDays);

      if (occurrences.length > 0) {
        const parsedRate = formHourlyRate ? Number(formHourlyRate) : null;
        const rate = parsedRate
          ? parseFloat((parsedRate * Number(formDuration) / 60).toFixed(2))
          : null;

        const lessonRows = occurrences.map((date) => ({
          coach_id: coachId,
          student_id: studentId,
          lesson_date: date,
          start_time: formStartTime,
          duration_minutes: Number(formDuration),
          hourly_rate: parsedRate,
          rate,
          billing_status: "unbilled",
          is_recurring: true,
          recurring_series_id: seriesId,
          recurring_occurrence_date: date,
          notes: formNotes || null,
        }));

        const { error: lessonError } = await supabase.from("lessons").insert(lessonRows);
        if (lessonError) console.log("Lesson insert error:", lessonError);
      }

      queryClient.invalidateQueries({ queryKey: ["recurring-lessons", coachId] });
      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
      setShowForm(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingId || isDeleting) return;
    setIsDeleting(true);
    try {
      await supabase.from("recurring_lessons").update({ active: false }).eq("id", deletingId);
      await supabase.from("lessons")
        .delete()
        .eq("recurring_series_id", deletingId)
        .eq("billing_status", "unbilled")
        .gte("lesson_date", new Date().toLocaleDateString("en-CA"));
      queryClient.invalidateQueries({ queryKey: ["recurring-lessons", coachId] });
      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
      setShowDeleteModal(false);
      setDeletingId(null);
    } finally {
      setIsDeleting(false);
    }
  }

  function formatDays(days: string[]) {
    return days.map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3)).join(", ");
  }

  function formatDate(date: string) {
    if (!date) return "";
    return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
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
    <div className="rl-page">
      {/* Header */}
      <div className="rl-header">
        <div className="rl-header-top">
          <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <img src="/logo.png" alt="Billio" className="about-logo" />
          <button type="button" className="rl-add-btn" onClick={openNewForm}>
            <FaPlus />
          </button>
        </div>
        <h1 className="rl-title">Recurring Lessons</h1>
        <p className="rl-subtitle">Schedule repeating lessons for your students.</p>
      </div>

      {/* Series list */}
      <div className="rl-body">
        {series.length === 0 ? (
          <div className="rl-empty">
            <FaRedoAlt className="rl-empty-icon" />
            <p>No recurring lessons yet.</p>
            <button type="button" className="rl-empty-btn" onClick={openNewForm}>
              Create your first recurring lesson
            </button>
          </div>
        ) : (
          <div className="rl-list">
            {series.map((s) => (
              <div key={s.id} className="rl-card">
                <div className="rl-card-top">
                  <div className="rl-card-avatar">
                    {s.students?.student_name?.charAt(0).toUpperCase() || "S"}
                  </div>
                  <div className="rl-card-info">
                    <strong>{s.students?.student_name || "Student"}</strong>
                    {s.title && <span className="rl-card-title">{s.title}</span>}
                    <span>{s.frequency === "biweekly" ? "Every 2 weeks" : "Weekly"} • {formatDays(s.days_of_week || [])}</span>
                    <span>{s.start_time?.slice(0,5)} • {s.duration_minutes} min</span>
                  </div>
                  <div className="rl-card-actions">
                    <button type="button" className="rl-edit-btn" onClick={() => openEditForm(s)}><FaEdit /></button>
                    <button type="button" className="rl-delete-btn" onClick={() => { setDeletingId(s.id); setShowDeleteModal(true); }}><FaTrash /></button>
                  </div>
                </div>
                <div className="rl-card-dates">
                  <span>{formatDate(s.start_date)} → {formatDate(s.end_date)}</span>
                  {s.hourly_rate && <span>${Number(s.hourly_rate).toFixed(0)}/hr</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate("/dashboard")}><FaHome /><span>Dashboard</span></div>
        <div className="nav-item" onClick={() => navigate("/lessons")}><FaCalendarAlt /><span>Lessons</span></div>
        <div className="nav-item" onClick={() => navigate("/students")}><FaUsers /><span>Students</span></div>
        <div className="nav-item" onClick={() => navigate("/invoices")}><FaFileInvoiceDollar /><span>Invoices</span></div>
        <div className="nav-item" onClick={() => navigate("/more")}><FaEllipsisH /><span>More</span></div>
      </nav>

      {/* ── Form Sheet ── */}
      {showForm && (
        <div className="invoices-add-overlay" onClick={() => setShowForm(false)}>
          <div className="invoices-add-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="invoices-add-header">
              <h2>{editingSeries ? "Edit Series" : "New Recurring Lesson"}</h2>
              <button type="button" onClick={() => setShowForm(false)}>×</button>
            </div>

            <form className="invoices-add-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

              {/* Student — same as Dashboard add lesson */}
              <div className="input-block student-search-block">
                <label>Student Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => { setStudentName(e.target.value); setSelectedStudentId(null); }}
                  placeholder="Enter or search student"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                />
                {studentMatches.length > 0 && !selectedStudentId && (
                  <div className="student-suggestions invoice-student-dropdown">
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

              {/* Title */}
              <div className="input-block">
                <label>Title (optional)</label>
                <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Piano lesson" />
              </div>

              {/* Start time + Duration */}
              <div className="rl-form-row">
                <div className="input-block">
                  <label>Start Time</label>
                  <input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
                </div>
                <div className="input-block">
                  <label>Duration (min)</label>
                  <input type="text" inputMode="numeric" value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value.replace(/\D/g, ""))} placeholder="60" />
                </div>
              </div>

              {/* Rate */}
              <div className="input-block">
                <label>Hourly Rate</label>
                {rateOptions.length > 0 && (
                  <div className="rate-options-row">
                    {rateOptions.slice(0, 3).map((r, i) => (
                      <button key={i} type="button"
                        className={`rate-option-chip ${Number(formHourlyRate) === Number(r.amount) ? "active" : ""}`}
                        onClick={() => setFormHourlyRate(String(r.amount))}>
                        {r.name} ${Number(r.amount).toFixed(0)}
                      </button>
                    ))}
                  </div>
                )}
                <input type="text" inputMode="decimal"
                  value={formHourlyRate ? `$${formHourlyRate}` : ""}
                  onChange={(e) => setFormHourlyRate(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="$60" />
              </div>

              {/* Frequency */}
              <div className="input-block">
                <label>Frequency</label>
                <div className="rl-chip-group">
                  {(["weekly","biweekly"] as const).map((f) => (
                    <button key={f} type="button"
                      className={`rl-chip${formFrequency === f ? " active" : ""}`}
                      onClick={() => setFormFrequency(f)}>
                      {f === "weekly" ? "Weekly" : "Every 2 weeks"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Days */}
              <div className="input-block">
                <label>Repeat on</label>
                <div className="rl-days-row">
                  {DAYS.map((day, i) => (
                    <button key={day} type="button"
                      className={`rl-day-btn${formDays.includes(day) ? " active" : ""}`}
                      onClick={() => toggleDay(day)}>
                      {DAY_LABELS[i]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range — exact same calendar as Invoices.tsx */}
              <div className="input-block invoice-date-range-wrapper">
                <label>Date Range</label>
                <button
                  type="button"
                  className="invoice-date-range-btn"
                  onClick={() => setShowDateRangePicker(true)}
                >
                  {formatDateRangeLabel()}
                </button>

                {showDateRangePicker && (
                  <div className={`invoice-calendar-floating ${isClosingCalendar ? "closing" : ""}`}>
                    <div className="invoice-calendar-header">
                      <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>‹</button>
                      <strong>{calendarMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
                      <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>›</button>
                    </div>
                    <div className="invoice-calendar-weekdays">
                      {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                        <span key={d}>{d.charAt(0)}</span>
                      ))}
                    </div>
                    <div className="invoice-calendar-grid">
                      {getCalendarDays().map((dateValue, index) => {
                        const isSelected = dateValue === rangeStart || dateValue === rangeEnd;
                        const isInRange = dateValue && rangeStart && rangeEnd && dateValue > rangeStart && dateValue < rangeEnd;
                        return (
                          <button
                            key={index}
                            type="button"
                            className={`invoice-calendar-day${isSelected ? " selected" : ""}${isInRange ? " in-range" : ""}`}
                            disabled={!dateValue}
                            onClick={() => dateValue && handleDateRangeSelect(dateValue)}
                          >
                            {dateValue ? Number(dateValue.split("-")[2]) : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Preview */}
              {previewCount > 0 && (
                <div className="rl-preview">
                  <FaRedoAlt style={{ fontSize: 12, marginRight: 8 }} />
                  <>
                    This will create{" "}
                    <strong>&nbsp;{previewCount} lessons&nbsp;</strong>
                    {editingSeries && " going forward"}.
                  </>
                </div>
              )}

              {/* Notes */}
              <div className="input-block">
                <label>Notes (optional)</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Notes for all lessons in this series..." />
              </div>

              <button type="submit" className="invoices-save-btn" disabled={isSaving}>
                {isSaving ? "Saving..." : editingSeries ? "Update Series" : "Create Recurring Lesson"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {showDeleteModal && (
        <div className="billio-confirm-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="billio-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="billio-confirm-icon" style={{ background: "#fee2e2", color: "#dc2626" }}>
              <FaTrash />
            </div>
            <h2>Stop Recurring Lesson?</h2>
            <p>
              This will deactivate the series and delete all <strong>upcoming unbilled</strong> occurrences.
              Past, billed, and paid lessons are not affected.
            </p>
            <div className="billio-confirm-actions">
              <button type="button" className="billio-cancel-btn" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button type="button" className="billio-danger-btn" disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? "Deleting..." : "Stop Series"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}