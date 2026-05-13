import { useState, useEffect } from "react";
import {
  FaHome,
  FaBars,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaUsers,
  FaPlus,
  FaChevronLeft,
  FaChevronRight,
  FaCalendarAlt,
  FaList,
  FaClock,
  FaMapMarkerAlt,
} from "react-icons/fa";
import { supabase } from "../lib/supabaseClient";

function Lessons() {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
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
        .select("*")
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
        status: "scheduled",
        billed: false,
        notes: notes || null,
      })
      .select()
      .single();

    if (lessonError) {
      console.log("Lesson create error:", lessonError);
      return;
    }

    setLessons((prev) => [...prev, lessonData]);

    setStudentName("");
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
                        onClick={() => setShowAddLesson(true)}
                    >
                        <FaPlus />
                    </button>
                </div>
            </div>
            <div className="lessons-view-toggle">
            <div
                className={`lessons-toggle-slider ${
                viewMode === "calendar" ? "lessons-toggle-slider-right" : ""
                }`}
            />

            <button
                type="button"
                className={`lessons-toggle-option ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
            >
                <FaList />
                List
            </button>

            <button
                type="button"
                className={`lessons-toggle-option ${viewMode === "calendar" ? "active" : ""}`}
                onClick={() => setViewMode("calendar")}
            >
                <FaCalendarAlt />
                Calendar
            </button>
            </div>

            {viewMode === "list" && (
              <div className="lessons-list-view">
                <section className="lesson-group">
                  <div className="lesson-group-title">
                    <h2>Upcoming Lessons</h2>
                    <span>{lessons.length} lessons</span>
                  </div>

                  {lessons.length === 0 ? (
                    <p className="empty-lessons">
                      No lessons yet. Tap + to add one.
                    </p>
                  ) : (
                    <div className="lesson-group-card">
                      {lessons.map((lesson) => (
                        <div key={lesson.id} className="lesson-page-row">
                          <div className="lesson-page-time">
                            <strong>{formatTime(lesson.start_time)}</strong>
                            <span>{lesson.lesson_date}</span>
                          </div>

                          <div className="lesson-page-info">
                            <strong>
                              {lesson.lesson_type || "Lesson"}
                            </strong>

                            <span>
                              {lesson.duration_minutes} min • $
                              {formatMoney(lesson.rate)}
                            </span>

                            <span>{lesson.status}</span>
                          </div>

                          <div
                            className={`lesson-page-status ${lesson.status}`}
                          >
                            {lesson.status}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {viewMode === "calendar" && (
            <div className="calendar-view">
                <div className="calendar-top">
                <button type="button">
                    <FaChevronLeft />
                </button>

                <h2>May 2026</h2>

                <button type="button">
                    <FaChevronRight />
                </button>
                </div>

                <div className="calendar-days">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <span key={day}>{day}</span>
                ))}
                </div>

                <div className="calendar-grid">
                {[7, 8, 9, 10, 11, 12, 13].map((date) => (
                    <div
                    key={date}
                    className={`calendar-day-card ${
                        date === 9 ? "active" : ""
                    }`}
                    >
                    <strong>{date}</strong>

                    {date === 9 && (
                        <>
                        <div className="calendar-lesson-dot purple-dot" />
                        <p>2 lessons</p>
                        </>
                    )}

                    {date === 11 && (
                        <>
                        <div className="calendar-lesson-dot orange-dot" />
                        <p>1 lesson</p>
                        </>
                    )}
                    </div>
                ))}
                </div>

                <section className="calendar-detail-card">
                <h3>May 9</h3>

                <div className="calendar-detail-row">
                    <div className="calendar-time-icon">
                    <FaClock />
                    </div>

                    <div>
                    <strong>Anna Petrova</strong>
                    <span>10:00 AM • Freestyle • 45 min</span>
                    </div>
                </div>

                <div className="calendar-detail-row">
                    <div className="calendar-time-icon">
                    <FaClock />
                    </div>

                    <div>
                    <strong>Alex Kim</strong>
                    <span>2:00 PM • Jumps • 60 min</span>
                    </div>
                </div>
                </section>
            </div>
            )}
        </div>

        <nav className="bottom-nav" onClick={() => (window.location.href = "/dashboard")}>
            <div className="nav-item">
                <FaHome />
                <span>Dashboard</span>
            </div>
    
            <div className="nav-item active" onClick={() => (window.location.href = "/lessons")}>
                <FaCalendarAlt />
                <span>Lessons</span>
            </div>
    
                <div className="nav-item">
                <FaUsers />
                <span>Students</span>
            </div>
    
            <div className="nav-item">
                <FaFileInvoiceDollar />
                <span>Invoices</span>
            </div>
    
            <div className="nav-item">
                <FaEllipsisH />
                <span>More</span>
            </div>
        </nav>
      </div>

      {showAddLesson && (
        <div className="add-lesson-overlay">
          <div className="add-lesson-sheet">
            <div className="add-lesson-header">
              <h2>Add Lesson</h2>
              <button type="button" onClick={() => setShowAddLesson(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateLesson} className="add-lesson-form">
              <div className="input-block">
                <label htmlFor="studentName">Student Name</label>
                <input
                  id="studentName"
                  type="text"
                  placeholder="Anna Petrova"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  required
                />
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
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
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
                  type="number"
                  placeholder="100"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  required
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
    </div>
  );
}

export default Lessons;