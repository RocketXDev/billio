import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaPlus,
  FaEdit
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
    setShowEditStudent(false);
    setEditingStudent(null);

    setStudentName("");
    setEmail("");
    setPhoneNumber("");
    setParentName("");
    setParentPhone("");
    setActive(true);
    setNotes("");
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
    const confirmDelete = window.confirm(
        "Delete this student? This will remove the student from your list."
    );

    if (!confirmDelete || !coachId) return;

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
                      <div key={link.student_id} className="students-row">
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
                        onClick={() => openEditStudent(link)}
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

      {showAddStudent && (
        <div
          className="students-add-overlay"
          onClick={() => setShowAddStudent(false)}
        >
          <div
            className="students-add-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="students-add-header">
              <h2>Add Student</h2>
              <button type="button" onClick={() => setShowAddStudent(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="students-add-form">
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
    </div>
  );
}

export default Students;