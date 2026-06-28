import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaPlus, FaEdit, FaTrash, FaUserFriends,
  FaHome, FaCalendarAlt, FaUsers, FaFileInvoiceDollar, FaEllipsisH,
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import { useLessonTerm } from "../../hooks/useLessonTerm";
import "../RecurringLessons/RecurringLessons.css";
import "./GroupLessons.css";

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

type RosterEntry = { id: string | null; name: string };

export default function GroupLessons() {
  const navigate = useNavigate();
  const { coachId, identityLoading } = useCoachIdentity();
  const term = useLessonTerm();
  const queryClient = useQueryClient();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<any>(null);

  // Roster picker
  const [groupStudents, setGroupStudents] = useState<RosterEntry[]>([]);
  const [groupStudentInput, setGroupStudentInput] = useState("");

  const [formTitle, setFormTitle] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formDuration, setFormDuration] = useState("60");
  const [formHourlyRate, setFormHourlyRate] = useState("");
  const [billingMode, setBillingMode] = useState<"per_student" | "split_total">("per_student");
  const [formFrequency, setFormFrequency] = useState<"once" | "weekly" | "biweekly">("once");
  const [formDays, setFormDays] = useState<string[]>([]);
  const [formDate, setFormDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Calendar — same as RecurringLessons.tsx (only used for weekly/biweekly)
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
    formFrequency === "once"
      ? (formDate ? 1 : 0)
      : rangeStart && rangeEnd && formDays.length > 0
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

  const { data: coachStudentsData, isLoading: studentsLoading } = useQuery({
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
  const coachStudents = coachStudentsData ?? [];

  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["group-lessons", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("group_lessons")
        .select("*, group_lesson_students(student_id, students(student_name))")
        .eq("coach_id", coachId)
        .eq("active", true)
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!coachId,
  });
  const groups = groupsData ?? [];

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

  // Gate on the data actually being present, not just `isLoading` — react-query
  // reports `isLoading: false` while a query is still `enabled: false` (i.e.
  // before coachId resolves), which would otherwise let the list render empty
  // before groups actually arrive.
  const loading =
    identityLoading || !coachId || studentsLoading || groupsLoading || groupsData === undefined;

  const groupStudentMatches =
    groupStudentInput.trim().length > 0
      ? coachStudents.filter(
          (link: any) =>
            link.students?.student_name
              ?.toLowerCase()
              .includes(groupStudentInput.trim().toLowerCase()) &&
            !groupStudents.some((s) => s.id === link.student_id)
        )
      : [];

  function addGroupStudent(entry: RosterEntry) {
    const cleanName = entry.name.trim();
    if (!cleanName) return;
    if (groupStudents.some((s) => s.name.toLowerCase() === cleanName.toLowerCase())) return;
    setGroupStudents((prev) => [...prev, { id: entry.id, name: cleanName }]);
    setGroupStudentInput("");
  }

  function removeGroupStudent(name: string) {
    setGroupStudents((prev) => prev.filter((s) => s.name !== name));
  }

  function openNewForm() {
    setEditingGroup(null);
    setGroupStudents([]);
    setGroupStudentInput("");
    setFormTitle("");
    setFormStartTime("09:00");
    setFormDuration("60");
    setFormHourlyRate(rateOptions[0] ? String(rateOptions[0].amount) : "");
    setBillingMode("per_student");
    setFormFrequency("once");
    setFormDays([]);
    setFormDate(new Date().toLocaleDateString("en-CA"));
    setFormNotes("");
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString("en-CA");
    const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toLocaleDateString("en-CA");
    setRangeStart(firstOfMonth);
    setRangeEnd(lastOfMonth);
    setCalendarMonth(new Date());
    setShowDateRangePicker(false);
    setShowForm(true);
  }

  function openEditForm(g: any) {
    setEditingGroup(g);
    const roster: RosterEntry[] = (g.group_lesson_students || []).map((row: any) => ({
      id: row.student_id,
      name: row.students?.student_name || "Student",
    }));
    setGroupStudents(roster);
    setGroupStudentInput("");
    setFormTitle(g.title || "");
    setFormStartTime(g.start_time?.slice(0, 5) || "09:00");
    setFormDuration(String(g.duration_minutes));
    setFormHourlyRate(String(g.rate_amount || ""));
    setBillingMode(g.billing_mode);
    setFormFrequency(g.frequency);
    setFormDays(g.days_of_week || []);
    setFormDate(g.start_date);
    setRangeStart(g.start_date);
    setRangeEnd(g.end_date || "");
    setFormNotes(g.notes || "");
    setCalendarMonth(new Date(g.start_date + "T00:00:00"));
    setShowDateRangePicker(false);
    setShowForm(true);
  }

  function toggleDay(day: string) {
    setFormDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  // Calendar logic — exact same as RecurringLessons.tsx / Invoices.tsx
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

  async function resolveRosterIds(): Promise<string[] | null> {
    if (!coachId) return null;

    const { data: existingLinks, error } = await supabase
      .from("coach_students")
      .select("student_id, students(id, student_name)")
      .eq("coach_id", coachId);

    if (error) return null;

    const resolvedIds: string[] = [];

    for (const entry of groupStudents) {
      if (entry.id) {
        resolvedIds.push(entry.id);
        continue;
      }

      const existing = existingLinks?.find(
        (link: any) =>
          link.students?.student_name?.trim().toLowerCase() === entry.name.toLowerCase()
      );
      if (existing) {
        resolvedIds.push(existing.student_id);
        continue;
      }

      const { data: newStudent, error: newStudentError } = await supabase
        .from("students")
        .insert({ student_name: entry.name, active: true })
        .select()
        .single();
      if (newStudentError || !newStudent) return null;

      await supabase.from("coach_students").insert({ coach_id: coachId, student_id: newStudent.id });
      resolvedIds.push(newStudent.id);
    }

    return resolvedIds;
  }

  async function handleSave() {
    if (isSaving) return;
    if (groupStudents.length === 0) { alert("Please add at least one student."); return; }
    if (!formHourlyRate) { alert("Please enter a rate."); return; }
    if (formFrequency === "once") {
      if (!formDate) { alert("Please select a date."); return; }
    } else {
      if (formDays.length === 0) { alert("Please select at least one day."); return; }
      if (!rangeStart || !rangeEnd) { alert("Please select a date range."); return; }
      if (rangeEnd <= rangeStart) { alert("End date must be after start date."); return; }
    }

    setIsSaving(true);
    try {
      const resolvedIds = await resolveRosterIds();
      if (!resolvedIds) { alert("Could not resolve the student roster."); return; }

      queryClient.invalidateQueries({ queryKey: ["coach-students", coachId] });

      const groupPayload = {
        coach_id: coachId,
        title: formTitle || null,
        start_time: formStartTime,
        duration_minutes: Number(formDuration),
        lesson_type: formTitle || null,
        billing_mode: billingMode,
        rate_amount: Number(formHourlyRate),
        frequency: formFrequency,
        days_of_week: formFrequency === "once" ? [] : formDays,
        start_date: formFrequency === "once" ? formDate : rangeStart,
        end_date: formFrequency === "once" ? null : rangeEnd,
        notes: formNotes || null,
        active: true,
        updated_at: new Date().toISOString(),
      };

      let groupId = editingGroup?.id;
      const today = new Date().toLocaleDateString("en-CA");
      const existingBilledKeys = new Set<string>();

      if (editingGroup) {
        await supabase.from("group_lessons").update(groupPayload).eq("id", groupId);

        const { data: existingRows } = await supabase
          .from("lessons")
          .select("lesson_date, student_id, billing_status")
          .eq("group_lesson_id", groupId);

        (existingRows || []).forEach((r: any) => {
          if (r.billing_status !== "unbilled") {
            existingBilledKeys.add(`${r.lesson_date}_${r.student_id}`);
          }
        });

        await supabase
          .from("lessons")
          .delete()
          .eq("group_lesson_id", groupId)
          .eq("billing_status", "unbilled")
          .gte("lesson_date", today);

        await supabase.from("group_lesson_students").delete().eq("group_lesson_id", groupId);
      } else {
        const { data: newGroup, error } = await supabase
          .from("group_lessons").insert(groupPayload).select().single();
        if (error || !newGroup) { alert(`Could not create group ${term.lower}: ` + error?.message); return; }
        groupId = newGroup.id;
      }

      const rosterRows = resolvedIds.map((studentId) => ({
        group_lesson_id: groupId,
        student_id: studentId,
      }));
      await supabase.from("group_lesson_students").insert(rosterRows);

      let occurrences: string[] = [];
      if (formFrequency === "once") {
        if (!editingGroup || formDate >= today) occurrences = [formDate];
      } else {
        const genStart = editingGroup ? today : rangeStart;
        occurrences = generateOccurrences(genStart, rangeEnd, formFrequency, formDays);
      }

      if (occurrences.length > 0) {
        const rateAmount = Number(formHourlyRate);
        const studentCount = resolvedIds.length;
        const perStudentRate =
          billingMode === "split_total"
            ? Number((rateAmount / studentCount).toFixed(2))
            : Number((rateAmount * Number(formDuration) / 60).toFixed(2));

        const lessonRows = occurrences.flatMap((date) =>
          resolvedIds
            .filter((studentId) => !existingBilledKeys.has(`${date}_${studentId}`))
            .map((studentId) => ({
              coach_id: coachId,
              student_id: studentId,
              lesson_date: date,
              start_time: formStartTime,
              duration_minutes: Number(formDuration),
              lesson_type: formTitle || null,
              hourly_rate: billingMode === "per_student" ? rateAmount : null,
              rate: perStudentRate,
              billing_status: "unbilled",
              notes: formNotes || null,
              is_recurring: formFrequency !== "once",
              group_lesson_id: groupId,
            }))
        );

        if (lessonRows.length > 0) {
          const { error: lessonError } = await supabase.from("lessons").insert(lessonRows);
          if (lessonError) console.log("Group lesson rows insert error:", lessonError);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["group-lessons", coachId] });
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
      const today = new Date().toLocaleDateString("en-CA");
      await supabase.from("group_lessons").update({ active: false }).eq("id", deletingId);
      await supabase
        .from("lessons")
        .delete()
        .eq("group_lesson_id", deletingId)
        .eq("billing_status", "unbilled")
        .gte("lesson_date", today);
      queryClient.invalidateQueries({ queryKey: ["group-lessons", coachId] });
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
      month: "long", day: "numeric", year: "numeric",
    });
  }

  function frequencyLabel(g: any) {
    if (g.frequency === "once") return formatDate(g.start_date);
    return `${g.frequency === "biweekly" ? "Every 2 weeks" : "Weekly"} • ${formatDays(g.days_of_week || [])}`;
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
        <div className="rl-title-row">
          <h1 className="rl-title">Group {term.plural}</h1>
          <button type="button" className="rl-add-btn rl-add-btn-desktop" onClick={openNewForm}>
            <FaPlus />
          </button>
        </div>
        <p className="rl-subtitle">Schedule one {term.lower} for multiple students at once.</p>
      </div>

      {/* Group list */}
      <div className="rl-body">
        {groups.length === 0 ? (
          <div className="rl-empty">
            <FaUserFriends className="rl-empty-icon" />
            <p>No group {term.lowerPlural} yet.</p>
            <button type="button" className="rl-empty-btn" onClick={openNewForm}>
              Create your first group {term.lower}
            </button>
          </div>
        ) : (
          <div className="rl-list">
            {groups.map((g: any) => {
              const roster = g.group_lesson_students || [];
              return (
                <div key={g.id} className="rl-card">
                  <div className="rl-card-top">
                    <div className="gl-card-avatars">
                      {roster.slice(0, 3).map((row: any, i: number) => (
                        <div key={row.student_id} className="rl-card-avatar gl-card-avatar" style={{ zIndex: 3 - i }}>
                          {row.students?.student_name?.charAt(0).toUpperCase() || "S"}
                        </div>
                      ))}
                      {roster.length > 3 && (
                        <div className="rl-card-avatar gl-card-avatar gl-card-avatar-more">
                          +{roster.length - 3}
                        </div>
                      )}
                    </div>
                    <div className="rl-card-info">
                      <strong>{g.title || `Group of ${roster.length}`}</strong>
                      <span className="rl-card-title">
                        {roster.map((r: any) => r.students?.student_name).filter(Boolean).join(", ")}
                      </span>
                      <span>{frequencyLabel(g)}</span>
                      <span>{g.start_time?.slice(0, 5)} • {g.duration_minutes} min</span>
                    </div>
                    <div className="rl-card-actions">
                      <button type="button" className="rl-edit-btn" onClick={() => openEditForm(g)}><FaEdit /></button>
                      <button type="button" className="rl-delete-btn" onClick={() => { setDeletingId(g.id); setShowDeleteModal(true); }}><FaTrash /></button>
                    </div>
                  </div>
                  <div className="rl-card-dates">
                    <span>{g.billing_mode === "split_total" ? "Split total" : "Per student"} • ${Number(g.rate_amount).toFixed(0)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate("/dashboard")}><FaHome /><span>Dashboard</span></div>
        <div className="nav-item" onClick={() => navigate("/lessons")}><FaCalendarAlt /><span>{term.plural}</span></div>
        <div className="nav-item" onClick={() => navigate("/students")}><FaUsers /><span>Students</span></div>
        <div className="nav-item" onClick={() => navigate("/invoices")}><FaFileInvoiceDollar /><span>Invoices</span></div>
        <div className="nav-item" onClick={() => navigate("/more")}><FaEllipsisH /><span>More</span></div>
      </nav>

      {/* ── Form Sheet ── */}
      {showForm && (
        <div className="invoices-add-overlay" onClick={() => setShowForm(false)}>
          <div className="invoices-add-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="invoices-add-header">
              <h2>{editingGroup ? `Edit Group ${term.singular}` : `New Group ${term.singular}`}</h2>
              <button type="button" onClick={() => setShowForm(false)}>×</button>
            </div>

            <form className="invoices-add-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

              {/* Roster */}
              <div className="input-block student-search-block">
                <label>Students</label>

                {groupStudents.length > 0 && (
                  <div className="group-student-chips">
                    {groupStudents.map((s) => (
                      <span key={s.name} className="group-student-chip">
                        {s.name}
                        {!s.id && <em>(new)</em>}
                        <button type="button" onClick={() => removeGroupStudent(s.name)}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="group-student-add-row">
                  <input
                    type="text"
                    value={groupStudentInput}
                    onChange={(e) => setGroupStudentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addGroupStudent({ id: null, name: groupStudentInput });
                      }
                    }}
                    placeholder="Search or add a student"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="group-student-add-btn"
                    onClick={() => addGroupStudent({ id: null, name: groupStudentInput })}
                  >
                    <FaPlus />
                  </button>
                </div>

                {groupStudentMatches.length > 0 && (
                  <div className="student-suggestions invoice-student-dropdown">
                    {groupStudentMatches.map((link: any) => (
                      <button
                        key={link.student_id}
                        type="button"
                        className="student-suggestion"
                        onClick={() => addGroupStudent({ id: link.student_id, name: link.students.student_name })}
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
                <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="e.g. Saturday Group Class" />
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

              {/* Billing */}
              <div className="input-block">
                <label>Billing</label>
                <div className="rl-chip-group">
                  <button type="button"
                    className={`rl-chip${billingMode === "per_student" ? " active" : ""}`}
                    onClick={() => setBillingMode("per_student")}>
                    Charge each student
                  </button>
                  <button type="button"
                    className={`rl-chip${billingMode === "split_total" ? " active" : ""}`}
                    onClick={() => setBillingMode("split_total")}>
                    Split total rate
                  </button>
                </div>
              </div>

              {/* Rate */}
              <div className="input-block">
                <label>
                  {billingMode === "split_total"
                    ? `Total Rate (split across ${groupStudents.length || "N"} students)`
                    : "Rate Per Student"}
                </label>
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
                  {(["once", "weekly", "biweekly"] as const).map((f) => (
                    <button key={f} type="button"
                      className={`rl-chip${formFrequency === f ? " active" : ""}`}
                      onClick={() => setFormFrequency(f)}>
                      {f === "once" ? "Once" : f === "weekly" ? "Weekly" : "Every 2 weeks"}
                    </button>
                  ))}
                </div>
              </div>

              {formFrequency === "once" ? (
                <div className="input-block">
                  <label htmlFor="groupDate">Date</label>
                  <input
                    id="groupDate"
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                  />
                </div>
              ) : (
                <>
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

                  {/* Date range */}
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
                </>
              )}

              {/* Preview */}
              {previewCount > 0 && (
                <div className="rl-preview">
                  <FaUserFriends style={{ fontSize: 12, marginRight: 8 }} />
                  <>
                    This will create{" "}
                    <strong>&nbsp;{previewCount * (groupStudents.length || 1)} {term.lowerPlural}&nbsp;</strong>
                    {editingGroup && " going forward"}.
                  </>
                </div>
              )}

              {/* Notes */}
              <div className="input-block">
                <label>Notes (optional)</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder={`Notes for all ${term.lowerPlural} in this group...`} />
              </div>

              <button type="submit" className="invoices-save-btn" disabled={isSaving}>
                {isSaving ? "Saving..." : editingGroup ? `Update Group ${term.singular}` : `Create Group ${term.singular}`}
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
            <h2>Cancel Group {term.singular}?</h2>
            <p>
              This will cancel the group session and delete all <strong>upcoming unbilled</strong> {term.lowerPlural} for every student in it.
              Past, billed, and paid {term.lowerPlural} are not affected.
            </p>
            <div className="billio-confirm-actions">
              <button type="button" className="billio-cancel-btn" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button type="button" className="billio-danger-btn" disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? "Deleting..." : "Cancel Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
