import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  FaBars,
  FaBell,
  FaPlus,
  FaChevronRight,
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaTrash
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

function Dashboard() {
  const [fullName, setFullName] = useState("");
  const [profileId, setProfileId] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [coachId, setCoachId] = useState("");
  const [visibleName, setVisibleName] = useState("");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [bio, setBio] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  //Lessons and other functions
  const [lessons, setLessons] = useState<any[]>([]);
  const [coachStudents, setCoachStudents] = useState<any[]>([]);
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [lessonDate, setLessonDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [lessonType, setLessonType] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");

  const [showEditLesson, setShowEditLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);

  const navigate = useNavigate();

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const metadataFullName = user.user_metadata.full_name || "New User";
      const metadataRole = user.user_metadata.role || "coach";

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            full_name: metadataFullName,
            email: user.email,
            role: metadataRole,
          },
          {
            onConflict: "user_id",
          }
        )
        .select()
        .single();

      if (profileError) {
        console.log("Profile upsert error:", profileError);
        setLoading(false);
        return;
      }

      setFullName(profileData.full_name);
      setRole(profileData.role);
      setProfileId(profileData.id);

      // Create onboarding notification only once
      const { error: onboardingNotificationError } = await supabase
        .from("notifications")
        .upsert(
          {
            profile_id: profileData.id,
            title: "Finish setting up Billio",
            message:
              "Complete your coach setup so Billio can calculate lesson rates and billing correctly.",
            type: "onboarding",
            is_read: false,
          },
          {
            onConflict: "profile_id,type",
            ignoreDuplicates: true,
          }
        );

      if (onboardingNotificationError) {
        console.log(
          "Onboarding notification error:",
          onboardingNotificationError
        );
      }

      // Load notifications
      const { data: notificationData, error: notificationError } = await supabase
        .from("notifications")
        .select("*")
        .eq("profile_id", profileData.id)
        .order("created_at", { ascending: false });

      if (notificationError) {
        console.log("Notification load error:", notificationError);
      }

      if (notificationData) {
        setNotifications(notificationData);
      }

      // Create coach profile if role is coach
      if (profileData.role === "coach") {
        const { data: coachData, error: coachLookupError } = await supabase
          .from("coaches")
          .select("*")
          .eq("profile_id", profileData.id)
          .maybeSingle();

        if (coachLookupError) {
          console.log("Coach lookup error:", coachLookupError);
        }

        if (!coachData) {
        const { data: newCoach, error: coachInsertError } = await supabase
          .from("coaches")
          .insert({
            profile_id: profileData.id,
            active: true,
            setup_completed: false,
          })
          .select()
          .single();

        if (coachInsertError) {
          console.log("Coach insert error:", coachInsertError);
        }

        if (newCoach) {
          setCoachId(newCoach.id);
          setShowOnboarding(true);
          await loadDashboardLessons(newCoach.id);
          await loadCoachStudents(newCoach.id);
        }
        } else {
          setCoachId(coachData.id);
          await loadDashboardLessons(coachData.id);
          await loadCoachStudents(coachData.id);

          if (!coachData.setup_completed) {
            setShowOnboarding(true);
          } else {
            // cleanup onboarding notification if setup already completed
            await supabase
              .from("notifications")
              .delete()
              .eq("profile_id", profileData.id)
              .eq("type", "onboarding");

            // remove locally too
            setNotifications((prev) =>
              prev.filter(
                (notification) => notification.type !== "onboarding"
              )
            );
          }
        }
      }

      // Create student profile if role is student
      if (profileData.role === "student") {
        const { data: studentData, error: studentLookupError } = await supabase
          .from("students")
          .select("*")
          .eq("profile_id", profileData.id)
          .maybeSingle();

        if (studentLookupError) {
          console.log("Student lookup error:", studentLookupError);
        }

        if (!studentData) {
          const { error: studentInsertError } = await supabase
            .from("students")
            .insert({
              profile_id: profileData.id,
              student_name: profileData.full_name,
              active: true,
            });

          if (studentInsertError) {
            console.log("Student insert error:", studentInsertError);
          }
        }
      }

      setLoading(false);
    }

    loadDashboard();
  },[]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function markNotificationAsRead(notification: any) {
    if (notification.type === "onboarding") {
      setShowOnboarding(true);
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id);

    if (error) {
      console.log("Mark notification read error:", error);
      return;
    }

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id
          ? { ...item, is_read: true }
          : item
      )
    );
  }

  async function deleteNotification(notificationId: string) {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (error) {
      console.log("Delete notification error:", error);
      return;
    }

    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== notificationId)
    );
  }

  async function handleSaveOnboarding(e: any) {
  e.preventDefault();

  if (!defaultHourlyRate || Number(defaultHourlyRate) <= 0) {
  alert("Please enter your hourly rate before finishing setup.");
  return;
  }

  if (!coachId) return;

  const { data, error } = await supabase
    .from("coaches")
    .update({
      visible_name: visibleName,
      default_hourly_rate: Number(defaultHourlyRate),
      bio: bio || null,
      phone_number: phoneNumber,
      setup_completed: true,
    })
    .eq("id", coachId)
    .select();

  if (error) {
    console.log("Onboarding save error:", error);
    return;
  }

  await supabase
    .from("notifications")
    .delete()
    .eq("profile_id", profileId)
    .eq("type", "onboarding");

  // remove onboarding notification locally
  setNotifications((prev) =>
    prev.filter(
      (notification) => notification.type !== "onboarding"
    )
  );

  setShowOnboarding(false);
  }

  async function handleSkipOnboarding() {
    setShowOnboarding(false);
  }

  async function loadDashboardLessons(currentCoachId: string) {
    const { data, error } = await supabase
      .from("lessons")
      .select(`
        *,
        students (
          student_name
        )
      `)
      .eq("coach_id", currentCoachId)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.log("Dashboard lessons error:", error);
      return;
    }

    setLessons(data || []);
  }

  async function loadCoachStudents(currentCoachId: string) {
    const { data, error } = await supabase
      .from("coach_students")
      .select(`
        student_id,
        students (
          id,
          student_name
        )
      `)
      .eq("coach_id", currentCoachId);

    if (error) {
      console.log("Dashboard students error:", error);
      return;
    }

    setCoachStudents(data || []);
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
      return;
    }

    setHourlyRate(data?.default_hourly_rate ? String(data.default_hourly_rate) : "");
  }

  async function openAddLesson() {
    await pullDefaultRate();
    await loadCoachStudents(coachId);
    setShowAddLesson(true);
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

  function formatMoney(amount: any) {
    return Number(amount || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  async function handleCreateLesson(e: any) {
    e.preventDefault();

    if (!coachId) return;

    const cleanStudentName = studentName.trim();

    if (!cleanStudentName) {
      alert("Please enter a student name.");
      return;
    }

    let finalStudentId = selectedStudentId;

    if (!finalStudentId) {
      const existingLink = coachStudents.find((link: any) =>
        link.students?.student_name?.trim().toLowerCase() ===
        cleanStudentName.toLowerCase()
      );

      finalStudentId = existingLink?.student_id;
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

    const calculatedRate = Number(hourlyRate) * (Number(durationMinutes) / 60);

    const { error: lessonError } = await supabase.from("lessons").insert({
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
    });

    if (lessonError) {
      console.log("Lesson create error:", lessonError);
      return;
    }

    await loadDashboardLessons(coachId);

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
    setSelectedStudentId(null);
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
      console.log("Update dashboard lesson error:", error);
      return;
    }

    setLessons((prev) =>
      prev.map((lesson) =>
        lesson.id === editingLesson.id ? data : lesson
      )
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
      console.log("Delete dashboard lesson error:", error);
      return;
    }

    setLessons((prev) =>
      prev.filter((lesson) => lesson.id !== lessonId)
    );

    closeEditLesson();
  }

  function getLocalToday() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const today = getLocalToday();

  const todayLessons = lessons.filter(
    (lesson) => lesson.lesson_date === today
  );

  const upcomingTodayLessons = todayLessons
  .filter((lesson) => getLessonStatus(lesson) === "upcoming")
  .sort((a, b) => {
    const dateA = new Date(`${a.lesson_date}T${a.start_time}`);
    const dateB = new Date(`${b.lesson_date}T${b.start_time}`);

    return dateA.getTime() - dateB.getTime();
  });

  const todayEarnings = todayLessons.reduce(
    (total, lesson) => total + Number(lesson.rate || 0),
    0
  );

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekLessons = lessons.filter((lesson) => {
    const lessonDate = new Date(`${lesson.lesson_date}T00:00:00`);
    return lessonDate >= weekStart && lessonDate <= weekEnd;
  });

  const weekEarnings = weekLessons.reduce(
    (total, lesson) => total + Number(lesson.rate || 0),
    0
  );
  const weekUnbilledLessons = weekLessons.filter(
  (lesson) => lesson.billed !== true
  );

  const weekPendingInvoices = weekLessons.filter(
    (lesson) => lesson.status === "pending"
  );
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

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="billio-loader">
          <div className="billio-loader-glow"></div>
          <img className="billio-loader-logo" src="/logo.png" alt="Billio" />
        </div>
      </div>
    );
  }
  
  return (
    <div className="mb-dashboard">
      <div className="mb-dashboard-wrapper">
        <header className="mb-dashboard-header">
          <div className="mb-dashboard-left">
            <button
              type="button"
              className="dashboard-menu-btn"
              onClick={() => setMenuOpen(true)}
            >
              <FaBars className="dashboard-menu" />
            </button>
            <img className="mb-dashboard-logo" src="/logo.png" alt="Billio" />
          </div>

          <button
            type="button"
            className="dashboard-bell"
            onClick={() => setNotificationsOpen(true)}
          >
            <FaBell />
            {notifications.filter((n) => !n.is_read).length > 0 && (
              <span>{notifications.filter((n) => !n.is_read).length > 99
                ? "99+"
                : notifications.filter((n) => !n.is_read).length
              }</span>
            )}
          </button>
        </header>
        <div className="mb-dashboard-body">
          <p className="dashboard-welcome">
            Welcome back{fullName ? `, ${fullName.split(" ")[0]}` : ""} 👋
          </p>

          <button className="add-lesson-card" onClick={openAddLesson}>
            <div className="add-circle">
              <FaPlus />
            </div>

            <div className="add-text">
              <h2>Add Lesson</h2>
              <p>Log a lesson in seconds</p>
            </div>

            <FaChevronRight className="add-arrow" />
          </button>

          <section className="stat-card">
            <div className="card-header">
              <h3>Today</h3>
              <button onClick={() => navigate("/lessons")}>View lessons</button>
            </div>

            <div className="today-stats">
              <div>
                <strong>{todayLessons.length}</strong>
                <p>Lessons<br />Today</p>
              </div>

              <span className="divider" />

              <div>
                <strong>{formatMoney(todayEarnings)}</strong>
                <p>Earned</p>
              </div>

              <span className="divider" />

              <div>
                <strong>  {
                  weekLessons.filter(
                    (lesson) => getLessonStatus(lesson) === "upcoming"
                  ).length
                }</strong>
                <p>Upcoming</p>
              </div>
            </div>
          </section>

          <section className="stat-card">
            <h3>This Week</h3>

            <div className="week-stats">
              <div>
                <strong className="purple">{formatMoney(weekEarnings)}</strong>
                <p>Earnings</p>
              </div>

              <span className="divider" />

              <div>
                <strong>{weekLessons.length}</strong>
                <p>Lessons</p>
              </div>

              <span className="divider" />

              <div>
                <strong className="orange">{weekUnbilledLessons.length}</strong>
                <p>Unbilled</p>
              </div>

              <span className="divider" />

              <div>
                <strong className="red">{weekPendingInvoices.length}</strong>
                <p>Invoices<br />Pending</p>
              </div>
            </div>
          </section>

          <section className="dashboard-section">
            <h3>Upcoming</h3>

            {todayLessons
              .filter((lesson) => getLessonStatus(lesson) === "upcoming")
              .sort((a, b) => {
                const dateA = new Date(
                  `${a.lesson_date}T${a.start_time}`
                );

                const dateB = new Date(
                  `${b.lesson_date}T${b.start_time}`
                );

                return dateA.getTime() - dateB.getTime();
              }).length === 0 ? (
              <p className="empty-lessons">
                No upcoming lessons for today.
              </p>
            ) : (
              <div className="lesson-list">
                {todayLessons
                  .filter(
                    (lesson) => getLessonStatus(lesson) === "upcoming"
                  )
                  .sort((a, b) => {
                    const dateA = new Date(
                      `${a.lesson_date}T${a.start_time}`
                    );

                    const dateB = new Date(
                      `${b.lesson_date}T${b.start_time}`
                    );

                    return dateA.getTime() - dateB.getTime();
                  })
                  .map((lesson, index, array) => {
                    const lessonStart = new Date(
                      `${lesson.lesson_date}T${lesson.start_time}`
                    );

                    const now = new Date();

                    const diffMs =
                      lessonStart.getTime() - now.getTime();

                    const totalMinutes = Math.max(
                      0,
                      Math.floor(diffMs / 60000)
                    );

                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;

                    let timeUntil = "";

                    if (hours > 0) {
                      timeUntil = `In ${hours}h ${minutes}m`;
                    } else {
                      timeUntil = `In ${minutes} min`;
                    }

                    return (
                      <div
                        key={lesson.id}
                        className={`lesson-row ${
                          index === array.length - 1 ? "last" : ""
                        }`}
                      >
                        <div className="lesson-time">
                          <strong>
                            {formatTime(lesson.start_time)}
                          </strong>

                          <span>Today</span>
                        </div>

                        <div className="lesson-info">
                          <strong>
                            {lesson.students?.student_name ||
                              "Student"}
                          </strong>

                          <span>
                            {lesson.duration_minutes} min • {formatMoney(lesson.rate)}
                          </span>
                        </div>

                        <div className="lesson-status purple-bg">
                          {timeUntil}
                        </div>
                        <button
                          type="button"
                          className="dashboard-row-edit-btn"
                          onClick={() => openEditLesson(lesson)}
                        >
                          <FaChevronRight />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>

          <section className="dashboard-section">
            <div className="section-title-row">
              <h3>Recent Invoices</h3>
              <button>View all</button>
            </div>

            {weekPendingInvoices.length === 0 ? (
              <p className="empty-lessons">
                No pending invoices right now.
              </p>
            ) : (
              <div className="recent-invoices-card">
              </div>
            )}
            {/* <div className="invoice-card">
              <div className="invoice-avatar">AP</div>

              <div className="invoice-info">
                <strong>Anna Petrova</strong>
                <span>May 12 – May 18</span>
              </div>

              <strong className="invoice-price">$225</strong>
              <span className="invoice-status">Sent</span>
              <FaChevronRight className="row-arrow" />
            </div> */}
          </section>

        </div>
      </div>

      <nav className="bottom-nav">
        <div className="nav-item active" onClick={() => navigate("/dashboard")}>
          <FaHome />
          <span>Dashboard</span>
        </div>

        <div className="nav-item" onClick={() => navigate("/lessons")}>
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

      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="side-menu" onClick={(e) => e.stopPropagation()}>
            <div className="side-menu-header">
              <img src="/logo.png" alt="Billio" />
              <button type="button" onClick={() => setMenuOpen(false)}>
                ×
              </button>
            </div>

            <div className="side-menu-user">
              <div className="side-menu-avatar">
                {fullName ? fullName.charAt(0).toUpperCase() : "B"}
              </div>

              <div>
                <strong>{fullName || "Billio User"}</strong>
                <span>Coach account</span>
              </div>
            </div>

            <nav className="side-menu-links">
              <a
                onClick={() => {
                  navigate("/dashboard");
                  setMenuOpen(false);
                }}
              >
                Dashboard
              </a>

              <a
                onClick={() => {
                  navigate("/lessons");
                  setMenuOpen(false);
                }}
              >
                Lessons
              </a>

              <a
                onClick={() => {
                  navigate("/students");
                  setMenuOpen(false);
                }}
              >
                Students
              </a>

              <a
                onClick={() => {
                  navigate("/invoices");
                  setMenuOpen(false);
                }}
              >
                Invoices
              </a>

              <a
                onClick={() => {
                  navigate("/settings");
                  setMenuOpen(false);
                }}
              >
                Settings
              </a>
            </nav>

            <button className="side-menu-logout" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>
      )}

      {notificationsOpen && (
        <div className="menu-overlay" onClick={() => setNotificationsOpen(false)}>
          <div className="notification-panel" onClick={(e) => e.stopPropagation()}>
            <div className="notification-header">
              <h3>Notifications</h3>
              <button type="button" onClick={() => setNotificationsOpen(false)}>
                ×
              </button>
            </div>

            {notifications.length === 0 ? (
              <p className="empty-notifications">No notifications yet.</p>
            ) : (
              <div className="notification-list">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`notification-item ${
                      notification.is_read ? "read" : "unread"
                    }`}
                    onClick={() => markNotificationAsRead(notification)}
                  >
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <div className="notification-bottom">
                      <span>
                        {new Date(notification.created_at).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        className="notification-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                      >
                        <FaTrash/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showOnboarding && (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
            <img
              className="onboarding-logo"
              src="/logo.png"
              alt="Billio logo"
            />

            <img
              className="onboarding-image"
              src="/onboarding_logo.png"
              alt="Coach onboarding"
            />

            <h2>Set up your coaching profile</h2>

            <p>
              Add a few details so Billio can help calculate lessons and billing
              faster.
            </p>

            <form
              onSubmit={handleSaveOnboarding}
              className="onboarding-form"
            >
              <div className="input-block">
                <label htmlFor="visibleName">
                  Visible Coach Name
                </label>

                <input
                  id="visibleName"
                  type="text"
                  value={visibleName}
                  onChange={(e) => setVisibleName(e.target.value)}
                  placeholder="Example: John Cool"
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="defaultHourlyRate">
                  Default Hourly Rate
                </label>

                <div className="currency-input">
                  <span>$</span>

                  <input
                    id="defaultHourlyRate"
                    type="number"
                    value={defaultHourlyRate}
                    onChange={(e) => setDefaultHourlyRate(e.target.value)}
                    placeholder="100"
                    required
                  />
                </div>
              </div>

              <div className="input-block">
                <label htmlFor="phoneNumber">
                  Phone Number
                </label>

                <input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(555) 555-5555"
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="bio">
                  Bio (Optional)
                </label>

                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell students a little about yourself..."
                  rows={4}
                />
              </div>

              <button type="submit">
                Finish Setup
              </button>

              <button
                type="button"
                className="onboarding-skip"
                onClick={handleSkipOnboarding}
              >
                Skip for now
              </button>
            </form>
          </div>
        </div>
      )}

      {showAddLesson && (
        <div
          className="add-lesson-overlay"
          onClick={() => setShowAddLesson(false)}
        >
          <div
            className="add-lesson-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="add-lesson-header">
              <h2>Add Lesson</h2>
              <button type="button" onClick={() => setShowAddLesson(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateLesson} className="add-lesson-form">
              <div className="input-block">
                <label>Student Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    setSelectedStudentId(null);
                  }}
                  placeholder="Enter student name"
                  required
                  autoComplete="new-password"
                />
              </div>

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
                  placeholder="Optional"
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
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
                <label>Student Name</label>
                <input
                  type="text"
                  value={studentName}
                  disabled
                />
              </div>

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
                Delete Lesson
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;