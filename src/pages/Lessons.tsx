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

  // Lesson specific states
  const [showEditLesson, setShowEditLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [coachStudents, setCoachStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

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
        status: "scheduled",
        billed: false,
        notes: notes || null,
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

    closeEditLesson();
  }

  async function handleDeleteLesson(lessonId: string) {

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
        <div className="add-lesson-overlay" onClick={() => {
          setShowAddLesson(false);
          setShowEditLesson(false);
        }}>
          <div className="add-lesson-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="add-lesson-header">
              <h2>Add Lesson</h2>
              <button type="button" onClick={() => setShowAddLesson(false)}>
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
        <div className="add-lesson-overlay" onClick={() => {
          setShowAddLesson(false);
          setShowEditLesson(false);
        }}>
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