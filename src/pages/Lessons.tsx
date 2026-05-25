import { useState, useEffect } from "react";
import {
  FaHome,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaUsers,
  FaPlus,
  FaChevronLeft,
  FaChevronRight,
  FaCalendarAlt,
  FaList,
  FaClock,
  FaEdit,
  FaTrash,
} from "react-icons/fa";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";

function Lessons() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [lessons, setLessons] = useState<any[]>([]);
  const [coachId, setCoachId] = useState("");
  const [loading, setLoading] = useState(true);

  // Form States
  const [studentName, setStudentName] = useState("");
  const [lessonDate, setLessonDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [lessonType, setLessonType] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");

  // Lesson specific states
  const [showEditLesson, setShowEditLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [coachStudents, setCoachStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState("unbilled");

  // Calendar 
  function getLocalDateString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const [selectedCalendarDate, setSelectedCalendarDate] = useState(getLocalDateString(new Date()));

  const navigate = useNavigate();

  useEffect(() => {
    async function loadLessons() {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError) {
        console.log("Profile error:", profileError);
        setLoading(false);
        return;
      }

      const { data: coachData, error: coachError } = await supabase
        .from("coaches")
        .select("id")
        .eq("profile_id", profileData.id)
        .single();

      if (coachError) {
        console.log("Coach error:", coachError);
        setLoading(false);
        return;
      }

      setCoachId(coachData.id);

      const { data: lessonData, error: lessonError } = await supabase
        .from("lessons")
        .select(`
          *,
          students (
            student_name
          )
        `)
        .eq("coach_id", coachData.id)
        .order("lesson_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (lessonError) {
        console.log("Lessons error:", lessonError);
        setLoading(false);
        return;
      }

      setLessons(lessonData || []);
      setLoading(false);
    }

    loadLessons();
  }, []);

  async function handleCreateLesson(e: any) {
    e.preventDefault();

    if (!coachId) return;

    const cleanStudentName = studentName.trim();

    if (!cleanStudentName) {
      alert("Please enter a student name.");
      return;
    }

    const { data: existingLinks, error: existingStudentError } = await supabase
      .from("coach_students")
      .select(`
        student_id,
        students (
          id,
          student_name
        )
      `)
      .eq("coach_id", coachId);

    if (existingStudentError) {
      console.log("Student lookup error:", existingStudentError);
      return;
    }

    const existingLink = existingLinks?.find((link: any) => {
      return (
        link.students?.student_name?.trim().toLowerCase() ===
        cleanStudentName.toLowerCase()
      );
    });

    let finalStudentId = existingLink?.student_id;
    if (selectedStudentId) {
      finalStudentId = selectedStudentId;
    }

    if (!finalStudentId) {
      const { data: newStudent, error: newStudentError } = await supabase
        .from("students")
        .insert({
          student_name: cleanStudentName,
          active: true,
        })
        .select()
        .single();

      if (newStudentError) {
        console.log("Student create error:", newStudentError);
        return;
      }

      finalStudentId = newStudent.id;

      const { error: linkError } = await supabase
        .from("coach_students")
        .insert({
          coach_id: coachId,
          student_id: finalStudentId,
        });

      if (linkError) {
        console.log("Coach-student link error:", linkError);
        return;
      }
    }

    const calculatedRate =
      Number(hourlyRate) * (Number(durationMinutes) / 60);

    const { data: lessonData, error: lessonError } = await supabase
      .from("lessons")
      .insert({
        coach_id: coachId,
        student_id: finalStudentId,
        lesson_date: lessonDate,
        start_time: startTime,
        duration_minutes: Number(durationMinutes),
        lesson_type: lessonType || null,
        hourly_rate: Number(hourlyRate),
        rate: calculatedRate,
        notes: notes || null,
        billing_status: "unbilled"
      })
      .select(`
        *,
        students (
          student_name
        )
      `)
      .single();

    if (lessonError) {
      console.log("Lesson create error:", lessonError);
      return;
    }

    setLessons((prev) => [...prev, lessonData]);

    setStudentName("");
    setSelectedStudentId(null);
    setLessonDate("");
    setStartTime("");
    setDurationMinutes("30");
    setLessonType("");
    setHourlyRate("");
    setNotes("");
    setShowAddLesson(false);
  }

  const groupedLessons = lessons.reduce((groups: any, lesson) => {
    if (!groups[lesson.dateLabel]) {
      groups[lesson.dateLabel] = [];
    }

    groups[lesson.dateLabel].push(lesson);
    return groups;
  }, {});

  function formatMoney(amount: any) {
    return Number(amount || 0).toLocaleString("en-US", {
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatTime(time: string) {
    if (!time) return "";

    const [hourString, minuteString] = time.split(":");
    const date = new Date();
    date.setHours(Number(hourString), Number(minuteString), 0);

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  function openEditLesson(lesson: any) {
  setEditingLesson(lesson);

  setStudentName(lesson.students?.student_name || "");
  setLessonDate(lesson.lesson_date || "");
  setStartTime(lesson.start_time?.slice(0, 5) || "");
  setDurationMinutes(String(lesson.duration_minutes || "30"));
  setLessonType(lesson.lesson_type || "");
  setHourlyRate(String(lesson.hourly_rate || ""));
  setNotes(lesson.notes || "");
  setBillingStatus(lesson.billing_status || "unbilled");

  setShowEditLesson(true);
  }

  function closeEditLesson() {
    setShowEditLesson(false);
    setEditingLesson(null);

    setStudentName("");
    setLessonDate("");
    setStartTime("");
    setDurationMinutes("30");
    setLessonType("");
    setHourlyRate("");
    setNotes("");
    setBillingStatus("unbilled");
  }

  async function handleUpdateLesson(e: any) {
    e.preventDefault();

    if (!editingLesson || !coachId) return;

    const calculatedRate =
      Number(hourlyRate) * (Number(durationMinutes) / 60);

    const { data, error } = await supabase
      .from("lessons")
      .update({
        lesson_date: lessonDate,
        start_time: startTime,
        duration_minutes: Number(durationMinutes),
        lesson_type: lessonType || null,
        hourly_rate: Number(hourlyRate),
        rate: calculatedRate,
        notes: notes || null,
        billing_status: billingStatus,
      })
      .eq("id", editingLesson.id)
      .eq("coach_id", coachId)
      .select(`
        *,
        students (
          student_name
        )
      `)
      .single();

    if (error) {
      console.log("Update lesson error:", error);
      return;
    }

    setLessons((prev) =>
      prev.map((lesson) => (lesson.id === editingLesson.id ? data : lesson))
    );

    await syncInvoiceStatusFromLesson(editingLesson.id);

    closeEditLesson();
  }

  async function handleDeleteLesson(lessonId: string) {

    await cleanupInvoicesAfterLessonDelete(lessonId);

    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lessonId)
      .eq("coach_id", coachId);

    if (error) {
      console.log("Delete lesson error:", error);
      return;
    }

    setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId));
    setShowEditLesson(false);
  }

  function getLessonStatus(lesson: any) {
    if (!lesson.lesson_date || !lesson.start_time) {
      return "upcoming";
    }

    const lessonStart = new Date(
      `${lesson.lesson_date}T${lesson.start_time}`
    );

    const lessonEnd = new Date(lessonStart);
    lessonEnd.setMinutes(
      lessonEnd.getMinutes() + Number(lesson.duration_minutes || 0)
    );

    const now = new Date();

    if (now < lessonStart) {
      return "upcoming";
    }

    if (now >= lessonStart && now <= lessonEnd) {
      return "current";
    }

    return "past";
  }
  async function pullDefaultRate() {
    if (!coachId) return;

    const { data, error } = await supabase
      .from("coaches")
      .select("default_hourly_rate")
      .eq("id", coachId)
      .single();

    if (error) {
      console.log("Default rate fetch error:", error);
      setHourlyRate("");
    } else {
      setHourlyRate(
        data?.default_hourly_rate
          ? String(data.default_hourly_rate)
          : ""
      );
    }

    setShowAddLesson(true);
  }

  const sortedLessons = [...lessons].sort((a, b) => {
    const dateA = new Date(`${a.lesson_date}T${a.start_time}`);
    const dateB = new Date(`${b.lesson_date}T${b.start_time}`);

    return dateB.getTime() - dateA.getTime();
  });

  const currentLessons = sortedLessons.filter(
    (lesson) => getLessonStatus(lesson) === "current"
  );

  const upcomingLessons = sortedLessons.filter(
    (lesson) => getLessonStatus(lesson) === "upcoming"
  );

  const pastLessons = sortedLessons.filter(
    (lesson) => getLessonStatus(lesson) === "past"
  );

  const studentMatches =
    studentName.trim().length > 0
      ? coachStudents.filter((link: any) =>
          link.students?.student_name
            ?.toLowerCase()
            .includes(studentName.trim().toLowerCase())
        )
      : [];

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

    if (error) {
      console.log("Load students error:", error);
      return;
    }

    setCoachStudents(data || []);
  }

  async function openAddLesson() {
    await pullDefaultRate();
    await loadCoachStudents();
    setShowAddLesson(true);
  }

  async function syncInvoiceStatusFromLesson(lessonId: string) {
    const { data: invoiceLinks, error: linkError } = await supabase
      .from("invoice_lessons")
      .select(`
        invoice_id,
        invoices (
          id,
          coach_id
        )
      `)
      .eq("lesson_id", lessonId);

    if (linkError || !invoiceLinks || invoiceLinks.length === 0) {
      return;
    }

    for (const link of invoiceLinks as any[]) {
      const invoiceId = link.invoice_id;

      const { data: attachedLessons, error: lessonsError } = await supabase
        .from("invoice_lessons")
        .select(`
          lessons (
            id,
            billing_status
          )
        `)
        .eq("invoice_id", invoiceId);

      if (lessonsError || !attachedLessons) {
        console.log("Invoice attached lessons error:", lessonsError);
        continue;
      }

      const lessons = attachedLessons.map((row: any) => row.lessons);

      const statuses = lessons.map(
        (lesson: any) => lesson.billing_status || "unbilled"
      );

      let invoiceStatus = "unbilled";

      if (statuses.length > 0 && statuses.every((status) => status === "paid")) {
        invoiceStatus = "paid";
      } else if (
        statuses.length > 0 &&
        statuses.every((status) => status === "billed")
      ) {
        invoiceStatus = "billed";
      } else if (statuses.some((status) => status === "unbilled")) {
        invoiceStatus = "unbilled";
      } else {
        invoiceStatus = "billed";
      }

      await supabase
        .from("invoices")
        .update({
          status: invoiceStatus,
        })
        .eq("id", invoiceId);
    }
  }

  function getInvoiceStatusFromLessons(lessons: any[]) {
    if (lessons.length === 0) return "unbilled";

    const statuses = lessons.map(
      (lesson) => lesson.billing_status || "unbilled"
    );

    if (statuses.every((status) => status === "paid")) {
      return "paid";
    }

    if (statuses.every((status) => status === "billed")) {
      return "billed";
    }

    if (statuses.some((status) => status === "unbilled")) {
      return "unbilled";
    }

    return "billed";
  }

  async function cleanupInvoicesAfterLessonDelete(lessonId: string) {
    if (!coachId) return;

    const { data: invoiceLinks, error: linkError } = await supabase
      .from("invoice_lessons")
      .select("invoice_id")
      .eq("lesson_id", lessonId);

    if (linkError) {
      console.log("Find invoice links error:", linkError);
      return;
    }

    if (!invoiceLinks || invoiceLinks.length === 0) return;

    for (const link of invoiceLinks) {
      const invoiceId = link.invoice_id;

      const { data: remainingLinks, error: remainingError } = await supabase
        .from("invoice_lessons")
        .select(`
          lesson_id,
          lessons (
            id,
            rate,
            billing_status
          )
        `)
        .eq("invoice_id", invoiceId)
        .neq("lesson_id", lessonId);

      if (remainingError) {
        console.log("Remaining invoice lessons error:", remainingError);
        continue;
      }

      if (!remainingLinks || remainingLinks.length === 0) {
        const { error: deleteInvoiceError } = await supabase
          .from("invoices")
          .delete()
          .eq("id", invoiceId)
          .eq("coach_id", coachId);

        if (deleteInvoiceError) {
          console.log("Delete empty invoice error:", deleteInvoiceError);
        }

        continue;
      }

      const remainingLessons = remainingLinks.map((row: any) => row.lessons);

      const newTotal = remainingLessons.reduce(
        (sum: number, lesson: any) => sum + Number(lesson.rate || 0),
        0
      );

      const newStatus = getInvoiceStatusFromLessons(remainingLessons);

      const { error: updateInvoiceError } = await supabase
        .from("invoices")
        .update({
          subtotal: newTotal,
          total: newTotal,
          status: newStatus,
        })
        .eq("id", invoiceId)
        .eq("coach_id", coachId);

      if (updateInvoiceError) {
        console.log("Update invoice after lesson delete error:", updateInvoiceError);
      }
    }
  }

  function resetLessonForm() {
    setStudentName("");
    setSelectedStudentId(null);
    setLessonDate("");
    setStartTime("");
    setDurationMinutes("30");
    setLessonType("");
    setHourlyRate("");
    setNotes("");
    setBillingStatus("unbilled");
    setEditingLesson(null);
  }

  function closeAddLesson() {
    setShowAddLesson(false);
    resetLessonForm();
  }

  function getCalendarMonthDays() {
    const selected = new Date(`${selectedCalendarDate}T00:00:00`);

    const year = selected.getFullYear();
    const month = selected.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startDay = firstDayOfMonth.getDay();

    const calendarStart = new Date(firstDayOfMonth);
    calendarStart.setDate(firstDayOfMonth.getDate() - startDay);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + index);

      const full = getLocalDateString(date);

      return {
        full,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        lessons: lessons.filter((lesson) => lesson.lesson_date === full),
      };
    });
  }

  function changeCalendarMonth(direction: "prev" | "next") {
    const current = new Date(`${selectedCalendarDate}T00:00:00`);
    current.setDate(1);
    current.setMonth(current.getMonth() + (direction === "next" ? 1 : -1));

    setSelectedCalendarDate(getLocalDateString(current));
  }

  function changeCalendarYear(direction: "prev" | "next") {
    const current = new Date(`${selectedCalendarDate}T00:00:00`);
    current.setFullYear(current.getFullYear() + (direction === "next" ? 1 : -1));

    setSelectedCalendarDate(getLocalDateString(current));
  }

const calendarMonthDays = getCalendarMonthDays();

const calendarWeekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const selectedCalendarLessons = lessons.filter(
    (lesson) => lesson.lesson_date === selectedCalendarDate
  );

  const calendarMonthLabel = new Date(
    `${selectedCalendarDate}T00:00:00`
  ).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  

  return (
    <div className="lessons-page">
      <div className="lessons-wrapper">
        <div className="lessons-body">
            <div className="lessons-header">
                <div className="lessons-header-add">
                    <h1>Lessons</h1>
                    <button
                        type="button"
                        className="lessons-add-btn"
                        onClick={() => openAddLesson()}
                    >
                        <FaPlus />
                    </button>
                </div>
            </div>
            <div className="lessons-view-toggle">
            <div
                className={`lessons-toggle-slider ${
                viewMode === "list" ? "lessons-toggle-slider-right" : ""
                }`}
            />

            <button
                type="button"
                className={`lessons-toggle-option ${viewMode === "calendar" ? "active" : ""}`}
                onClick={() => setViewMode("calendar")}
            >
                <FaCalendarAlt />
                Calendar
            </button>

            <button
                type="button"
                className={`lessons-toggle-option ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
            >
                <FaList />
                List
            </button>
            </div>
            {viewMode === "calendar" && (
              <div className="calendar-view">
                <div className="calendar-top">
                  <button type="button" onClick={() => changeCalendarYear("prev")}>
                    «
                  </button>

                  <button type="button" onClick={() => changeCalendarMonth("prev")}>
                    <FaChevronLeft />
                  </button>

                  <h2>{calendarMonthLabel}</h2>

                  <button type="button" onClick={() => changeCalendarMonth("next")}>
                    <FaChevronRight />
                  </button>

                  <button type="button" onClick={() => changeCalendarYear("next")}>
                    »
                  </button>
                </div>

                <div className="calendar-days">
                  {calendarWeekLabels.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>

                <div className="calendar-grid">
                  {calendarMonthDays.map((day) => (
                    <button
                      key={day.full}
                      type="button"
                      className={`calendar-day-card ${
                        selectedCalendarDate === day.full ? "active" : ""
                      } ${!day.isCurrentMonth ? "muted" : ""}`}
                      onClick={() => setSelectedCalendarDate(day.full)}
                    >
                      <strong>{day.dayNumber}</strong>

                      {day.lessons.length > 0 && (
                        <>
                          <div className="calendar-lesson-dot purple-dot" />
                          {/* <p>
                            {day.lessons.length}{" "}
                            {day.lessons.length === 1 ? "lesson" : "lessons"}
                          </p> */}
                        </>
                      )}
                    </button>
                  ))}
                </div>

                <section className="calendar-detail-card">
                <div className="calendar-detail-header">
                  <div>
                    <h3>
                      {new Date(`${selectedCalendarDate}T00:00:00`).toLocaleDateString(
                        "en-US",
                        {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </h3>

                    <span className="calendar-detail-count">
                      {selectedCalendarLessons.length}{" "}
                      {selectedCalendarLessons.length === 1
                        ? "lesson"
                        : "lessons"}
                    </span>
                  </div>

                  <button
                    type="button"
                    className="calendar-add-lesson-btn"
                    onClick={openAddLesson}
                  >
                    <FaPlus />
                  </button>
                </div>
                {selectedCalendarLessons.length === 0 ? (
                    <p className="empty-lessons">No lessons for this day.</p>
                  ) : (
                    selectedCalendarLessons.map((lesson) => (
                      <div key={lesson.id} className="calendar-detail-row">
                        <div className="calendar-time-icon">
                          <FaClock />
                        </div>

                        <div>
                          <strong>
                            {lesson.students?.student_name || "Student"} •{" "}
                            {formatTime(lesson.start_time)}
                          </strong>
                          <span>
                            {lesson.duration_minutes} min
                            {lesson.lesson_type
                              ? ` • ${lesson.lesson_type}`
                              : ""}
                            {" • $"}
                            {formatMoney(lesson.rate)}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="lesson-edit-btn"
                          onClick={() => openEditLesson(lesson)}
                        >
                          <FaEdit />
                        </button>
                      </div>
                    ))
                  )}
                </section>
              </div>
            )}
            {viewMode === "list" && (
              <div className="lessons-list-view">
                {lessons.length === 0 ? (
                  <p className="empty-lessons">No lessons yet. Tap + to add one.</p>
                ) : (
                  <>
                    {[
                      { title: "Current Lessons", items: currentLessons },
                      { title: "Upcoming Lessons", items: upcomingLessons },
                      { title: "Past Lessons", items: pastLessons },
                    ].map(
                      (group) =>
                        group.items.length > 0 && (
                          <section className="lesson-group" key={group.title}>
                            <div className="lesson-group-title">
                              <h2>{group.title}</h2>
                              <span>
                                {group.items.length}{" "}
                                {group.items.length === 1 ? "lesson" : "lessons"}
                              </span>
                            </div>

                            <div className="lesson-group-card">
                              {group.items.map((lesson) => (
                                <div key={lesson.id} className="lesson-page-row">
                                  <div className="lesson-page-time">
                                    <strong>{formatTime(lesson.start_time)}</strong>
                                    <span>{lesson.lesson_date}</span>
                                  </div>

                                  <div className="lesson-page-info">
                                    <strong>
                                      {lesson.students?.student_name || "Student"}
                                    </strong>
                                    <span>
                                      {lesson.duration_minutes} min •{" "}$
                                      {formatMoney(lesson.rate)}
                                    </span>
                                  </div>

                                  <span
                                    className={`lesson-page-status ${getLessonStatus(
                                      lesson
                                    )}`}
                                  >
                                    {getLessonStatus(lesson)}
                                  </span>

                                  <button
                                    type="button"
                                    className="lesson-edit-btn"
                                    onClick={() => openEditLesson(lesson)}
                                  >
                                    <FaEdit />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </section>
                        )
                    )}
                  </>
                )}
              </div>
            )}
        </div>

        <nav className="bottom-nav">
            <div className="nav-item" onClick={() => navigate("/dashboard")}>
                <FaHome />
                <span>Dashboard</span>
            </div>
    
            <div className="nav-item active" onClick={() => navigate("/lessons")}>
                <FaCalendarAlt />
                <span>Lessons</span>
            </div>
    
                <div className="nav-item" onClick={() => navigate("/students")}>
                <FaUsers />
                <span>Students</span>
            </div>
    
            <div className="nav-item" onClick={() => navigate("/invoices")}>
                <FaFileInvoiceDollar />
                <span>Invoices</span>
            </div>
    
            <div className="nav-item" onClick={() => navigate("/more")}>
                <FaEllipsisH />
                <span>More</span>
            </div>
        </nav>
      </div>

      {showAddLesson && (
        <div className="add-lesson-overlay" onClick={
          closeAddLesson}>
          <div className="add-lesson-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="add-lesson-header">
              <h2>Add Lesson</h2>
              <button type="button" onClick={closeAddLesson}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateLesson} autoComplete="off" className="add-lesson-form">
              <div className="input-block student-search-block">
                <label htmlFor="studentName">Student Name</label>

                <input
                  id="studentName"
                  type="text"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    setSelectedStudentId(null);
                  }}
                  placeholder="Enter student name"
                  required
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                />

                {studentMatches.length > 0 && !selectedStudentId && (
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
                <label htmlFor="lessonDate">Lesson Date</label>
                <input
                  id="lessonDate"
                  type="date"
                  value={lessonDate}
                  onChange={(e) => setLessonDate(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="startTime">Start Time</label>
                <input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="durationMinutes">Duration</label>
                <input
                  id="durationMinutes"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="lessonType">Lesson Type</label>
                <input
                  id="lessonType"
                  type="text"
                  placeholder="Freestyle, jumps, choreography..."
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                />
              </div>

              <div className="input-block">
                <label htmlFor="hourlyRate">Hourly Rate</label>
                <input
                  id="hourlyRate"
                  type="text"
                  inputMode="decimal"
                  value={hourlyRate ? `$${hourlyRate}` : ""}
                  onChange={(e) =>
                    setHourlyRate(
                      e.target.value.replace(/[^0-9.]/g, "")
                    )
                  }
                  placeholder="$100"
                />
              </div>

              <div className="input-block">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  placeholder="Optional lesson notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="save-lesson-btn">
                Save Lesson
              </button>
            </form>
          </div>
        </div>
      )}
      {showEditLesson && editingLesson && (
        <div className="add-lesson-overlay" onClick={closeEditLesson}>
          <div className="add-lesson-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="add-lesson-header">
              <h2>Edit Lesson</h2>
              <button type="button" onClick={closeEditLesson}>
                ×
              </button>
            </div>

            <form autoComplete="off" onSubmit={handleUpdateLesson} className="add-lesson-form">
              <div className="input-block">
                <label htmlFor="editStudentName">Student Name</label>
                <input
                  id="editStudentName"
                  type="text"
                  value={studentName}
                  disabled
                />
              </div>

              <div className="input-block">
                <label htmlFor="editLessonDate">Lesson Date</label>
                <input
                  id="editLessonDate"
                  type="date"
                  value={lessonDate}
                  onChange={(e) => setLessonDate(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="editStartTime">Start Time</label>
                <input
                  id="editStartTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="editDurationMinutes">Duration</label>
                <input
                  id="editDurationMinutes"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>

              <div className="input-block">
                <label>Billing Status</label>

                <select
                  value={billingStatus}
                  onChange={(e) => setBillingStatus(e.target.value)}
                >
                  <option value="unbilled">Unbilled</option>
                  <option value="billed">Billed</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              <div className="input-block">
                <label htmlFor="editLessonType">Lesson Type</label>
                <input
                  id="editLessonType"
                  type="text"
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                />
              </div>

              <div className="input-block">
                <label htmlFor="editHourlyRate">Hourly Rate</label>
                <input
                  id="hourlyRate"
                  type="text"
                  inputMode="decimal"
                  value={hourlyRate ? `$${hourlyRate}` : ""}
                  onChange={(e) =>
                    setHourlyRate(
                      e.target.value.replace(/[^0-9.]/g, "")
                    )
                  }
                  placeholder="$100"
                />
              </div>

              <div className="input-block">
                <label htmlFor="editNotes">Notes</label>
                <textarea
                  id="editNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="save-lesson-btn">
                Save Changes
              </button>

              <button
                type="button"
                className="delete-lesson-btn"
                onClick={() => handleDeleteLesson(editingLesson.id)}
              >
                <FaTrash />
                Delete Lesson
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Lessons;