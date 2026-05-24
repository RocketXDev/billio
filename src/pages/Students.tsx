import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaPlus,
  FaEdit,
  FaFilter
} from "react-icons/fa";
import { supabase } from "../lib/supabaseClient";

function Students() {
  const navigate = useNavigate();

  const [students, setStudents] = useState<any[]>([]);
  const [coachId, setCoachId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);

//   Add Student Block
  const [studentName, setStudentName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [parentEmail, setParentEmail] = useState("");

  // Student - lessons+invoices popup
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentLessons, setStudentLessons] = useState<any[]>([]);
  const [studentInvoices, setStudentInvoices] = useState<any[]>([]);

  // Edit lessons
  const [selectedLessonActionId, setSelectedLessonActionId] = useState<string | null>(null);
  const [showEditLesson, setShowEditLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);

  const [lessonDate, setLessonDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [lessonType, setLessonType] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [lessonNotes, setLessonNotes] = useState("");


  useEffect(() => {
    loadStudents();
  }, []);

  async function loadStudents() {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      navigate("/login");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profileData) {
      console.log("Profile fetch error:", profileError);
      setLoading(false);
      return;
    }

    const { data: coachData, error: coachError } = await supabase
      .from("coaches")
      .select("id")
      .eq("profile_id", profileData.id)
      .single();

    if (coachError || !coachData) {
      console.log("Coach fetch error:", coachError);
      setLoading(false);
      return;
    }

    setCoachId(coachData.id);

    const { data, error } = await supabase
      .from("coach_students")
      .select(`
        student_id,
        students (
          id,
          student_name,
          active,
          created_at
        )
      `)
      .eq("coach_id", coachData.id);

    if (error) {
      console.log("Students load error:", error);
      setLoading(false);
      return;
    }

    setStudents(data || []);
    setLoading(false);
  }

  async function handleCreateStudent(e: any) {
    e.preventDefault();

    if (!coachId) return;

    const cleanStudentName = studentName.trim();

    if (!cleanStudentName) {
      alert("Please enter a student name.");
      return;
    }

    const existingStudent = students.find(
      (link: any) =>
        link.students?.student_name?.trim().toLowerCase() ===
        cleanStudentName.toLowerCase()
    );

    if (existingStudent) {
      alert("This student already exists.");
      return;
    }

    const { data: newStudent, error: studentError } = await supabase
      .from("students")
      .insert({
        student_name: cleanStudentName,
        email: email || null,
        phone_number: phoneNumber || null,
        parent_name: parentName || null,
        parent_email: parentEmail || null,
        parent_phone: parentPhone || null,
        active: true,
        notes: notes || null,
      })
      .select()
      .single();

    if (studentError) {
      console.log("Student create error:", studentError);
      return;
    }

    const { error: linkError } = await supabase.from("coach_students").insert({
      coach_id: coachId,
      student_id: newStudent.id,
    });

    if (linkError) {
      console.log("Coach-student link error:", linkError);
      return;
    }

    setStudents((prev) => [
      ...prev,
      {
        student_id: newStudent.id,
        students: newStudent,
      },
    ]);

    setStudentName("");
    setShowAddStudent(false);
  }

  function openEditStudent(link: any) {
    const student = link.students;

    setEditingStudent(student);

    setStudentName(student?.student_name || "");
    setEmail(student?.email || "");
    setPhoneNumber(student?.phone_number || "");
    setParentName(student?.parent_name || "");
    setParentPhone(student?.parent_phone || "");
    setActive(student?.active ?? true);
    setNotes(student?.notes || "");

    setShowEditStudent(true);
  }

  function closeEditStudent() {
    setShowAddStudent(false);
    resetStudentForm();
  }

  function openEditLesson(lesson: any) {
    setEditingLesson(lesson);

    setLessonDate(lesson.lesson_date || "");
    setStartTime(lesson.start_time?.slice(0, 5) || "");
    setDurationMinutes(String(lesson.duration_minutes || "30"));
    setLessonType(lesson.lesson_type || "");
    setHourlyRate(String(lesson.hourly_rate || ""));
    setLessonNotes(lesson.notes || "");

    setShowEditLesson(true);
    setSelectedLessonActionId(null);
  }

  function resetStudentForm() {
    setStudentName("");
    setEmail("");
    setPhoneNumber("");
    setParentName("");
    setParentPhone("");
    setActive(true);
    setNotes("");
    setEditingStudent(null);
  }

  function closeAddStudent() {
  setShowAddStudent(false);
  resetStudentForm();
  }

  function closeEditLesson() {
    setShowEditLesson(false);
    setEditingLesson(null);

    setLessonDate("");
    setStartTime("");
    setDurationMinutes("30");
    setLessonType("");
    setHourlyRate("");
    setLessonNotes("");
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
        notes: lessonNotes || null,
      })
      .eq("id", editingLesson.id)
      .eq("coach_id", coachId)
      .select()
      .single();

    if (error) {
      console.log("Update student lesson error:", error);
      return;
    }

    setStudentLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === editingLesson.id ? data : lesson
      )
    );

    closeEditLesson();
  }

  async function handleDeleteStudentLesson(lessonId: string) {

    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lessonId)
      .eq("coach_id", coachId);

    if (error) {
      console.log("Delete student lesson error:", error);
      return;
    }

    setStudentLessons((prev) =>
      prev.filter((lesson) => lesson.id !== lessonId)
    );

    setSelectedLessonActionId(null);
  }

  async function handleUpdateStudent(e: any) {
      e.preventDefault();

      if (!editingStudent) return;

      const cleanStudentName = studentName.trim();

      if (!cleanStudentName) {
          alert("Please enter a student name.");
          return;
      }

      const { data, error } = await supabase
          .from("students")
          .update({
          student_name: cleanStudentName,
          email: email || null,
          phone_number: phoneNumber || null,
          parent_name: parentName || null,
          parent_phone: parentPhone || null,
          active,
          notes: notes || null,
          })
          .eq("id", editingStudent.id)
          .select()
          .single();

      if (error) {
          console.log("Update student error:", error);
          return;
      }

      setStudents((prev) =>
          prev.map((link: any) =>
          link.student_id === editingStudent.id
              ? { ...link, students: data }
              : link
          )
      );

      closeEditStudent();
  }
  async function handleDeleteStudent(studentId: string) {

    const { error: linkError } = await supabase
        .from("coach_students")
        .delete()
        .eq("coach_id", coachId)
        .eq("student_id", studentId);

    if (linkError) {
        console.log("Delete student link error:", linkError);
        return;
    }

    const { error: studentError } = await supabase
        .from("students")
        .delete()
        .eq("id", studentId);

    if (studentError) {
        console.log("Delete student error:", studentError);
        return;
    }

    setStudents((prev) =>
        prev.filter((link: any) => link.student_id !== studentId)
    );

    closeEditStudent();
  }

  async function openStudentDetails(link: any) {
    const student = link.students;

    setSelectedStudent(student);

    if (!coachId || !student?.id) return;

    const { data: lessonsData, error: lessonsError } = await supabase
      .from("lessons")
      .select("*")
      .eq("coach_id", coachId)
      .eq("student_id", student.id)
      .order("lesson_date", { ascending: false })
      .order("start_time", { ascending: false });

    if (lessonsError) {
      console.log("Student lessons error:", lessonsError);
    } else {
      setStudentLessons(lessonsData || []);
    }

    const { data: invoicesData, error: invoicesError } = await supabase
      .from("invoices")
      .select("*")
      .eq("coach_id", coachId)
      .eq("student_id", student.id)
      .order("created_at", { ascending: false });

    if (invoicesError) {
      console.log("Student invoices error:", invoicesError);
    } else {
      setStudentInvoices(invoicesData || []);
    }
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
    <div className="students-page">
      <div className="students-wrapper">
        <div className="students-body">
          <div className="students-header">
            <div className="students-header-add">
              <h1>Students</h1>

              <button
                type="button"
                className="students-add-btn"
                onClick={() => setShowAddStudent(true)}
              >
                <FaPlus />
              </button>
            </div>
          </div>

          <div className="students-list-view">
            <section className="students-group">
              <div className="students-group-title">
                <h2>Your Students</h2>
                <span>
                  {students.length}{" "}
                  {students.length === 1 ? "student" : "students"}
                </span>
              </div>

              {students.length === 0 ? (
                <p className="students-empty">
                  No students yet. Tap + to add one.
                </p>
              ) : (
                <div className="students-group-card">
                  {students.map((link: any) => {
                    const student = link.students;

                    return (
                      <div key={link.student_id} className="students-row" onClick={() => openStudentDetails(link)}>
                        <div className="students-avatar">
                          {student?.student_name
                            ? student.student_name.charAt(0).toUpperCase()
                            : "S"}
                        </div>

                        <div className="students-info">
                          <strong>{student?.student_name || "Student"}</strong>
                          <span>
                            Added{" "}
                            {student?.created_at
                              ? new Date(student.created_at).toLocaleDateString()
                              : "recently"}
                          </span>
                        </div>
                        <button
                        type="button"
                        className="students-edit-btn"
                        onClick={(e) => {e.stopPropagation(), openEditStudent(link)}}
                        >
                        <FaEdit />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>

        <nav className="bottom-nav">
          <div className="nav-item" onClick={() => navigate("/dashboard")}>
            <FaHome />
            <span>Dashboard</span>
          </div>

          <div className="nav-item" onClick={() => navigate("/lessons")}>
            <FaCalendarAlt />
            <span>Lessons</span>
          </div>

          <div className="nav-item active" onClick={() => navigate("/students")}>
            <FaUsers />
            <span>Students</span>
          </div>

          <div className="nav-item" onClick={() => navigate("/invoices")}>
            <FaFileInvoiceDollar />
            <span>Invoices</span>
          </div>

          <div className="nav-item" onClick={() => navigate("/settings")}>
            <FaEllipsisH />
            <span>More</span>
          </div>
        </nav>
      </div>

      {showAddStudent && (
        <div
          className="students-add-overlay"
          onClick={closeAddStudent}
        >
          <div
            className="students-add-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="students-add-header">
              <h2>Add Student</h2>
              <button type="button" onClick={closeAddStudent}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateStudent} autoComplete="off" className="students-add-form">
                <div className="input-block">
                    <label htmlFor="studentName">Student Name (Required)</label>

                    <input
                    id="studentName"
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="Enter student name"
                    required
                    spellCheck={false}
                    />
                </div>

                <div className="input-block">
                    <label htmlFor="studentEmail">Email</label>

                    <input
                    id="studentEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    autoComplete="off"
                    />
                </div>

                <div className="input-block">
                    <label htmlFor="studentPhone">Phone Number</label>

                    <input
                    id="studentPhone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="(555) 555-5555"
                    autoComplete="off"
                    />
                </div>

                <div className="input-block">
                    <label htmlFor="parentName">Parent Name</label>

                    <input
                    id="parentName"
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="Enter parent name"
                    autoComplete="off"
                    />
                </div>

                <div className="input-block">
                    <label htmlFor="parentEmail">Parent Email</label>

                    <input
                    id="parentEmail"
                    type="text"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    placeholder="Enter parent email"
                    autoComplete="off"
                    />
                </div>

                <div className="input-block">
                    <label htmlFor="parentPhone">Parent Phone</label>

                    <input
                    id="parentPhone"
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    placeholder="(555) 555-5555"
                    autoComplete="off"
                    />
                </div>

                <div className="input-block">
                    <label htmlFor="studentNotes">Notes</label>

                    <textarea
                    id="studentNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes..."
                    />
                </div>

                <button
                type="button"
                className={`student-active-button ${active ? "active" : "inactive"}`}
                onClick={() => setActive((prev) => !prev)}
                >
                <div>
                    <strong>Active Student</strong>
                    <span>
                    {active
                        ? "This student is currently active"
                        : "This student is currently inactive"}
                    </span>
                </div>

                <div className="student-active-pill">
                    {active ? "Active" : "Inactive"}
                </div>
                </button>

                <button type="submit" className="students-save-btn">
                    Save Student
                </button>
                </form>
          </div>
        </div>
      )}
      {showEditStudent && editingStudent && (
        <div
            className="students-add-overlay"
            onClick={closeEditStudent}
        >
            <div
            className="students-add-sheet"
            onClick={(e) => e.stopPropagation()}
            >
            <div className="students-add-header">
                <h2>Edit Student</h2>
                <button type="button" onClick={closeEditStudent}>
                ×
                </button>
            </div>

            <form onSubmit={handleUpdateStudent} className="students-add-form">
                <div className="input-block">
                <label htmlFor="editStudentName">Student Name</label>
                <input
                    id="editStudentName"
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    required
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                />
                </div>

                <div className="input-block">
                <label htmlFor="editStudentEmail">Email</label>
                <input
                    id="editStudentEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                />
                </div>

                <div className="input-block">
                <label htmlFor="editStudentPhone">Phone Number</label>
                <input
                    id="editStudentPhone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    autoComplete="off"
                />
                </div>

                <div className="input-block">
                <label htmlFor="editParentName">Parent Name</label>
                <input
                    id="editParentName"
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    autoComplete="off"
                />
                </div>

                <div className="input-block">
                <label htmlFor="editParentPhone">Parent Phone</label>
                <input
                    id="editParentPhone"
                    type="tel"
                    value={parentPhone}
                    onChange={(e) => setParentPhone(e.target.value)}
                    autoComplete="off"
                />
                </div>

                <div className="input-block">
                <label htmlFor="editStudentNotes">Notes</label>
                <textarea
                    id="editStudentNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
                </div>

                <button
                type="button"
                className={`student-active-button ${active ? "active" : "inactive"}`}
                onClick={() => setActive((prev) => !prev)}
                >
                <div>
                    <strong>Active Student</strong>
                    <span>
                    {active
                        ? "This student is currently active"
                        : "This student is currently inactive"}
                    </span>
                </div>

                <div className="student-active-pill">
                    {active ? "Active" : "Inactive"}
                </div>
                </button>

                <button type="submit" className="students-save-btn">
                Save Changes
                </button>

                <button
                type="button"
                className="students-delete-btn"
                onClick={() => handleDeleteStudent(editingStudent.id)}
                >
                Delete Student
                </button>
            </form>
            </div>
        </div>
      )}
      {selectedStudent && (
        <div
          className="students-detail-overlay"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="students-detail-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="students-detail-header">
              <div>
                <h2>{selectedStudent.student_name}</h2>
                <span>Student details</span>
              </div>

              <button
                type="button"
                className="students-filter-btn"
              >
                <FaFilter />
              </button>

              <button
                type="button"
                className="students-close-btn"
                onClick={() => setSelectedStudent(null)}
              >
                ×
              </button>
            </div>

            <section className="students-detail-section">
              <div className="students-detail-title">
                <h3>Lessons</h3>
                <span>{studentLessons.length}</span>
              </div>

              {studentLessons.length === 0 ? (
                <p className="students-empty">
                  No lessons for this student yet.
                </p>
              ) : (
                <div className="students-detail-card">
                  {studentLessons.map((lesson) => (
                    <div
                    key={lesson.id}
                    className={`students-detail-row ${
                      selectedLessonActionId === lesson.id ? "action-mode" : ""
                    }`}
                    onClick={() =>
                      setSelectedLessonActionId(
                        selectedLessonActionId === lesson.id ? null : lesson.id
                      )
                    }
                  >
                    {selectedLessonActionId === lesson.id ? (
                      <div className="students-lesson-actions">
                        <button
                          type="button"
                          className="students-lesson-edit-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudentDetails(false)
                            openEditLesson(lesson);
                          }}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="students-lesson-delete-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStudentLesson(lesson.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <strong>{lesson.lesson_date}</strong>
                          <span>
                            {lesson.start_time?.slice(0, 5)} •{" "}
                            {lesson.duration_minutes} min
                          </span>
                        </div>

                        <strong>${Number(lesson.rate || 0).toFixed(2)}</strong>
                      </>
                    )}
                  </div>
                  ))}
                </div>
              )}
            </section>

            <section className="students-detail-section">
              <div className="students-detail-title">
                <h3>Invoices</h3>
                <span>{studentInvoices.length}</span>
              </div>

              {studentInvoices.length === 0 ? (
                <p className="students-empty">
                  No invoices for this student yet.
                </p>
              ) : (
                <div className="students-detail-card">
                  {studentInvoices.map((invoice) => (
                    <div key={invoice.id} className="students-detail-row">
                      <div>
                        <strong>{invoice.invoice_number || "Invoice"}</strong>
                        <span>
                          {invoice.status
                            ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)
                            : "No status"}
                        </span>
                      </div>

                      <strong>${Number(invoice.total || 0).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
      {showEditLesson && editingLesson && (
        <div
          className="add-lesson-overlay"
          onClick={closeEditLesson}
        >
          <div
            className="add-lesson-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="add-lesson-header">
              <h2>Edit Lesson</h2>
              <button type="button" onClick={closeEditLesson}>
                ×
              </button>
            </div>

            <form onSubmit={handleUpdateLesson} className="add-lesson-form">
              <div className="input-block">
                <label>Lesson Date</label>
                <input
                  type="date"
                  value={lessonDate}
                  onChange={(e) => setLessonDate(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label>Start Time</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label>Duration</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(e.target.value.replace(/\D/g, ""))
                  }
                  required
                />
              </div>

              <div className="input-block">
                <label>Lesson Type</label>
                <input
                  type="text"
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                />
              </div>

              <div className="input-block">
                <label>Hourly Rate</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={hourlyRate ? `$${hourlyRate}` : ""}
                  onChange={(e) =>
                    setHourlyRate(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="$60"
                  required
                />
              </div>

              <div className="input-block">
                <label>Notes</label>
                <textarea
                  value={lessonNotes}
                  onChange={(e) => setLessonNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="save-lesson-btn">
                Save Changes
              </button>

              <button
                type="button"
                className="delete-lesson-btn"
                onClick={() => handleDeleteStudentLesson(editingLesson.id)}
              >
                Delete Lesson
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Students;