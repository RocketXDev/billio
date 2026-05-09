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
} from "react-icons/fa";

function Dashboard() {
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setFullName(data.full_name);
      }

      setLoading(false);
    }

    loadDashboard();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="billio-loader">
          <div className="billio-loader-glow"></div>
          <img className="billio-loader-logo" src="/logo_icon.png" alt="Billio" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-dashboard">
      <div className="mb-dashboard-wrapper">
        <header className="mb-dashboard-header">
          <div className="mb-dashboard-left">
            <FaBars className="mb-dashboard-menu" />
            <img className="mb-dashboard-logo" src="/logo.png" alt="Billio" />
          </div>

          <div className="mb-dashboard-bell">
            <FaBell />
            <span>3</span>
          </div>
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

          {/* <button onClick={handleLogout} className="dashboard-logout">
            Log out
          </button> */}
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

    </div>
  );
}

export default Dashboard;