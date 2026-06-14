import { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./DesktopLayout.css";
import {
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaUser,
  FaCog,
  FaCrown,
  FaSignOutAlt,
  FaBell,
  FaTrash,
} from "react-icons/fa";

type Props = { children: React.ReactNode };

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/lessons": "Lessons",
  "/students": "Students",
  "/invoices": "Invoices",
  "/profile": "Profile",
  "/settings": "Settings",
  "/upgrade": "Upgrade",
  "/more": "More",
  "/earnings-dashboard": "Earnings",
  "/recurring-lessons": "Recurring Lessons",
  "/timer": "Lesson Timer",
  "/pdf-invoice": "PDF Invoice",
};

function DesktopLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [initials, setInitials] = useState("?");
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  const pageTitle = PAGE_TITLES[location.pathname] ?? "";
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name ?? "");
        setAvatarUrl(profile.avatar_url ?? "");
        const name = profile.full_name ?? user.email ?? "";
        setInitials(
          name
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        );
      }

      const { data: notifData } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (notifData) setNotifications(notifData);
    }
    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `desktop-nav-link${isActive ? " active" : ""}`;

  async function markRead(notification: any) {
    if (notification.type === "onboarding") {
      navigate("/dashboard");
    }
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
    );
  }

  async function deleteNotif(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="desktop-shell">
      {/* ── Sidebar ── */}
      <aside className="desktop-sidebar">
        <img
          src="/logo.png"
          alt="Billio"
          className="desktop-sidebar-logo"
        />

        <nav className="desktop-sidebar-nav">
          <NavLink to="/dashboard" className={navLinkClass}>
            <FaHome /> Dashboard
          </NavLink>
          <NavLink to="/lessons" className={navLinkClass}>
            <FaCalendarAlt /> Lessons
          </NavLink>
          <NavLink to="/students" className={navLinkClass}>
            <FaUsers /> Students
          </NavLink>
          <NavLink to="/invoices" className={navLinkClass}>
            <FaFileInvoiceDollar /> Invoices
          </NavLink>
          <NavLink to="/more" className={navLinkClass}>
            <FaFileInvoiceDollar /> More
          </NavLink>

          <div className="desktop-sidebar-divider" />

          <NavLink to="/profile" className={navLinkClass}>
            <FaUser /> Profile
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            <FaCog /> Settings
          </NavLink>
          <NavLink to="/upgrade" className={navLinkClass}>
            <FaCrown /> Upgrade
          </NavLink>
        </nav>

        <div className="desktop-sidebar-user">
          <div className="side-menu-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              initials
            )}
          </div>
          <div className="desktop-sidebar-user-info">
            <strong>{fullName || "User"}</strong>
            <span>{email}</span>
          </div>
        </div>

        <button className="desktop-sidebar-logout" onClick={handleLogout}>
          <FaSignOutAlt /> Log out
        </button>
      </aside>

      {/* ── Main content ── */}
      <main className="desktop-main">
        <header className="desktop-topbar">
          <h1 className="desktop-topbar-title">{pageTitle}</h1>

          <div className="desktop-topbar-right">
            <div className="desktop-bell-wrapper">
              <button
                className="desktop-bell-btn"
                onClick={() => setNotifOpen((o) => !o)}
              >
                <FaBell />
                {unreadCount > 0 && (
                  <span className="desktop-bell-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div
                    className="desktop-notif-backdrop"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="desktop-notif-dropdown">
                    <div className="desktop-notif-header">
                      <span>Notifications</span>
                      <button onClick={() => setNotifOpen(false)}>×</button>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="desktop-notif-empty">No notifications yet.</p>
                    ) : (
                      <div className="desktop-notif-list">
                        {notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`desktop-notif-item ${n.is_read ? "read" : "unread"}`}
                            onClick={() => markRead(n)}
                          >
                            <div className="desktop-notif-body">
                              <strong>{n.title}</strong>
                              <p>{n.message}</p>
                            </div>
                            <div className="desktop-notif-meta">
                              <span>
                                {new Date(n.created_at).toLocaleDateString()}
                              </span>
                              <button
                                className="desktop-notif-delete"
                                onClick={(e) => deleteNotif(n.id, e)}
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <div className="desktop-content">
          {children}
        </div>
      </main>
    </div>
  );
}

export default DesktopLayout;
