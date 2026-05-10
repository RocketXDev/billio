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

function Dashboard() {
  const [fullName, setFullName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

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
          const { error: coachInsertError } = await supabase
            .from("coaches")
            .insert({
              profile_id: profileData.id,
              active: true,
              setup_completed: false,
            });

          if (coachInsertError) {
            console.log("Coach insert error:", coachInsertError);
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

  async function markNotificationAsRead(notificationId: string) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      console.log("Mark notification read error:", error);
      return;
    }

    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, is_read: true }
          : notification
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

          <button className="add-lesson-card">
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
              <button>View calendar</button>
            </div>

            <div className="today-stats">
              <div>
                <strong className="purple">3</strong>
                <p>Lessons<br />Today</p>
              </div>

              <span className="divider" />

              <div>
                <strong>$300</strong>
                <p>Earned</p>
              </div>

              <span className="divider" />

              <div>
                <strong className="orange">1</strong>
                <p>Upcoming</p>
              </div>
            </div>
          </section>

          <section className="stat-card">
            <h3>This Week</h3>

            <div className="week-stats">
              <div>
                <strong className="purple">$1,240</strong>
                <p>Earnings</p>
              </div>

              <span className="divider" />

              <div>
                <strong>18</strong>
                <p>Lessons</p>
              </div>

              <span className="divider" />

              <div>
                <strong className="orange">6</strong>
                <p>Unbilled</p>
              </div>

              <span className="divider" />

              <div>
                <strong className="red">3</strong>
                <p>Invoices<br />Pending</p>
              </div>
            </div>
          </section>

          <section className="dashboard-section">
            <h3>Upcoming</h3>

            <div className="lesson-list">
              <div className="lesson-row">
                <div className="lesson-time">
                  <strong>10:00 AM</strong>
                  <span>Today</span>
                </div>

                <div className="lesson-info">
                  <strong>Anna Petrova</strong>
                  <span>Freestyle • 45 min</span>
                  <span>World Ice Arena</span>
                </div>

                <div className="lesson-status green">In 18 min</div>
                <FaChevronRight className="row-arrow" />
              </div>

              <div className="lesson-row">
                <div className="lesson-time">
                  <strong>11:00 AM</strong>
                  <span>Today</span>
                </div>

                <div className="lesson-info">
                  <strong>Maya Chen</strong>
                  <span>Spins • 30 min</span>
                  <span>World Ice Arena</span>
                </div>

                <div className="lesson-status purple-bg">In 1h 18m</div>
                <FaChevronRight className="row-arrow" />
              </div>

              <div className="lesson-row last">
                <div className="lesson-time">
                  <strong>12:00 PM</strong>
                  <span>Today</span>
                </div>

                <div className="lesson-info">
                  <strong>Alex Kim</strong>
                  <span>Jumps • 45 min</span>
                  <span>Summit Rink</span>
                </div>

                <div className="lesson-status purple-bg">In 2h 18m</div>
                <FaChevronRight className="row-arrow" />
              </div>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-title-row">
              <h3>Recent Invoices</h3>
              <button>View all</button>
            </div>

            <div className="invoice-card">
              <div className="invoice-avatar">AP</div>

              <div className="invoice-info">
                <strong>Anna Petrova</strong>
                <span>May 12 – May 18</span>
              </div>

              <strong className="invoice-price">$225</strong>
              <span className="invoice-status">Sent</span>
              <FaChevronRight className="row-arrow" />
            </div>
          </section>

        </div>
      </div>

      <nav className="bottom-nav">
        <div className="nav-item active">
          <FaHome />
          <span>Dashboard</span>
        </div>

        <div className="nav-item">
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
              <a>Dashboard</a>
              <a>Lessons</a>
              <a>Students</a>
              <a>Invoices</a>
              <a>Settings</a>
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
                    onClick={() => markNotificationAsRead(notification.id)}
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

    </div>
  );
}

export default Dashboard;