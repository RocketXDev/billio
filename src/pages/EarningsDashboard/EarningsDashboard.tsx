import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  FaArrowLeft, FaHome, FaCalendarAlt, FaUsers,
  FaFileInvoiceDollar, FaEllipsisH, FaTrophy,
  FaChartBar, FaExclamationCircle,
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import "./EarningsDashboard.css";

export default function EarningsDashboard() {
  const navigate = useNavigate();
  const { coachId, identityLoading } = useCoachIdentity();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => { if (!coachId && !identityLoading) navigate("/login"); }, [coachId, identityLoading]);

  const { data: lessons = [], isLoading: lessonsLoading } = useQuery({
    queryKey: ["lessons", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*, students(student_name)")
        .eq("coach_id", coachId)
        .order("lesson_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!coachId,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`*, students(student_name, email, phone_number, parent_name, parent_phone)`)
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!coachId,
  });

  const loading = identityLoading || lessonsLoading || invoicesLoading;

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisYearStart = new Date(now.getFullYear(), 0, 1);

  // ── This month ──
  const thisMonthLessons = lessons.filter(l =>
    l.lesson_date && new Date(l.lesson_date + "T00:00:00") >= thisMonthStart
  );
  const thisMonthRevenue = thisMonthLessons
    .filter(l => l.billing_status === "paid")
    .reduce((sum, l) => sum + Number(l.rate || 0), 0);
  const thisMonthCount = thisMonthLessons.length;

  // avg weekly: divide by weeks elapsed this month (at least 1)
  const dayOfMonth = now.getDate();
  const weeksElapsed = Math.max(1, Math.ceil(dayOfMonth / 7));
  const thisMonthAvgWeekly = thisMonthRevenue / weeksElapsed;

  // ── YTD ──
  const ytdLessons = lessons.filter(l =>
    l.lesson_date && new Date(l.lesson_date + "T00:00:00") >= thisYearStart
  );
  const ytdRevenue = ytdLessons
    .filter(l => l.billing_status === "paid")
    .reduce((sum, l) => sum + Number(l.rate || 0), 0);
  const ytdCount = ytdLessons.length;
  const monthsWithRevenue = new Set(
    ytdLessons.filter(l => l.billing_status === "paid").map(l => l.lesson_date?.slice(0, 7))
  ).size;
  const ytdAvgMonthly = monthsWithRevenue > 0 ? ytdRevenue / monthsWithRevenue : 0;

  // ── All time ──
  const allTimeRevenue = lessons
    .filter(l => l.billing_status === "paid")
    .reduce((sum, l) => sum + Number(l.rate || 0), 0);

  // ── Outstanding ──
  const unpaidInvoices = invoices.filter(i => i.status === "unbilled" || i.status === "billed");
  const unpaidInvoiceTotal = unpaidInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  const unpaidLessons = lessons.filter(l => l.billing_status === "unbilled");
  const unpaidLessonsTotal = unpaidLessons.reduce((sum, l) => sum + Number(l.rate || 0), 0);

  // ── Monthly chart (last 12 months) ──
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = d.toLocaleDateString("en-CA").slice(0, 7);
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const fullLabel = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const monthLessons = lessons.filter(l => l.lesson_date?.startsWith(key));
    const revenue = monthLessons.filter(l => l.billing_status === "paid")
      .reduce((sum, l) => sum + Number(l.rate || 0), 0);
    const count = monthLessons.length;
    return { key, label, fullLabel, revenue, count };
  });
  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);

  const selectedMonthData = selectedMonth
    ? monthlyData.find(m => m.key === selectedMonth) ?? null
    : null;

  // ── Top students ──
  const studentRevMap: Record<string, { name: string; revenue: number; count: number }> = {};
  lessons.filter(l => l.billing_status === "paid").forEach(l => {
    const id = l.student_id;
    const name = l.students?.student_name || "Unknown";
    if (!studentRevMap[id]) studentRevMap[id] = { name, revenue: 0, count: 0 };
    studentRevMap[id].revenue += Number(l.rate || 0);
    studentRevMap[id].count += 1;
  });
  const topStudents = Object.values(studentRevMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // ── Revenue by type ──
  const typeMap: Record<string, number> = {};
  lessons.filter(l => l.billing_status === "paid" && l.lesson_type).forEach(l => {
    const t = l.lesson_type.trim();
    typeMap[t] = (typeMap[t] || 0) + Number(l.rate || 0);
  });
  const typeEntries = Object.entries(typeMap).sort((a, b) => b[1] - a[1]);
  const typeTotal = typeEntries.reduce((sum, [, v]) => sum + v, 0);
  const typeColors = ["#6366f1","#22c55e","#f59e0b","#3b82f6","#ec4899","#14b8a6"];

  // ── Insights ──
  const withRevenue = monthlyData.filter(m => m.revenue > 0);
  const bestMonth = withRevenue.length > 0 ? withRevenue.reduce((a, b) => a.revenue > b.revenue ? a : b) : null;
  const worstMonth = withRevenue.length > 1 ? withRevenue.reduce((a, b) => a.revenue < b.revenue ? a : b) : null;

  function fmt(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  function fmtDec(n: number) {
    return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    <div className="ed-page">
      <div className="ed-header">
        <div className="ed-header-top">
          <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
            <FaArrowLeft />
          </button>
          <img src="/logo.png" alt="Billio" className="about-logo" />
        </div>
        <h1 className="ed-title">Earnings</h1>
        <p className="ed-subtitle">{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
      </div>

      <div className="ed-body">

        {/* ── This Month ── */}
        <div className="ed-section-label">This Month</div>
        <div className="ed-stat-grid">
          <div className="ed-stat-card ed-stat-green">
            <div className="ed-stat-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
              <FaFileInvoiceDollar />
            </div>
            <span>Revenue</span>
            <strong>{fmtDec(thisMonthRevenue)}</strong>
            <p>paid lessons</p>
          </div>
          <div className="ed-stat-card ed-stat-purple">
            <div className="ed-stat-icon" style={{ background: "#ede9fe", color: "var(--primary-purple)" }}>
              <FaCalendarAlt />
            </div>
            <span>Lessons</span>
            <strong>{thisMonthCount}</strong>
            <p>taught this month</p>
          </div>
          <div className="ed-stat-card ed-stat-blue">
            <div className="ed-stat-icon" style={{ background: "#dbeafe", color: "#2563eb" }}>
              <FaChartBar />
            </div>
            <span>Avg/Week</span>
            <strong>{fmt(thisMonthAvgWeekly)}</strong>
            <p>per week</p>
          </div>
        </div>

        {/* ── YTD ── */}
        <div className="ed-section-label">Year to Date — {now.getFullYear()}</div>
        <div className="ed-stat-grid">
          <div className="ed-stat-card ed-stat-green">
            <div className="ed-stat-icon" style={{ background: "#dcfce7", color: "#16a34a" }}>
              <FaFileInvoiceDollar />
            </div>
            <span>Revenue</span>
            <strong>{fmtDec(ytdRevenue)}</strong>
            <p>{now.getFullYear()}</p>
          </div>
          <div className="ed-stat-card ed-stat-purple">
            <div className="ed-stat-icon" style={{ background: "#ede9fe", color: "var(--primary-purple)" }}>
              <FaCalendarAlt />
            </div>
            <span>Lessons</span>
            <strong>{ytdCount}</strong>
            <p>this year</p>
          </div>
          <div className="ed-stat-card ed-stat-blue">
            <div className="ed-stat-icon" style={{ background: "#dbeafe", color: "#2563eb" }}>
              <FaChartBar />
            </div>
            <span>Avg/Month</span>
            <strong>{fmt(ytdAvgMonthly)}</strong>
            <p>monthly avg</p>
          </div>
        </div>

        {/* ── Outstanding ── */}
        <div className="ed-section-label">Outstanding</div>
        <div className="ed-outstanding-row">
          <div className="ed-outstanding-card">
            <div className="ed-outstanding-icon" style={{ background: "#fff7ed", color: "#f59e0b" }}>
              <FaFileInvoiceDollar />
            </div>
            <div>
              <strong>{fmtDec(unpaidInvoiceTotal)}</strong>
              <span>{unpaidInvoices.length} unpaid {unpaidInvoices.length === 1 ? "invoice" : "invoices"}</span>
            </div>
          </div>
          <div className="ed-outstanding-card">
            <div className="ed-outstanding-icon" style={{ background: "#fef2f2", color: "#ef4444" }}>
              <FaExclamationCircle />
            </div>
            <div>
              <strong>{fmtDec(unpaidLessonsTotal)}</strong>
              <span>{unpaidLessons.length} unbilled {unpaidLessons.length === 1 ? "lesson" : "lessons"}</span>
            </div>
          </div>
        </div>

        {/* ── Monthly chart ── */}
        <div className="ed-section-label">
          <FaChartBar style={{ marginRight: 6, fontSize: 12 }} />
          Monthly Revenue
        </div>

        {/* Selected month detail */}
        {selectedMonthData && (
          <div className="ed-month-detail">
            <div className="ed-month-detail-header">
              <span>{selectedMonthData.fullLabel}</span>
              <button type="button" onClick={() => setSelectedMonth(null)}>×</button>
            </div>
            <div className="ed-month-detail-stats">
              <div>
                <span>Revenue</span>
                <strong>{fmtDec(selectedMonthData.revenue)}</strong>
              </div>
              <div>
                <span>Lessons</span>
                <strong>{selectedMonthData.count}</strong>
              </div>
              <div>
                <span>Avg/week</span>
                <strong>{fmt(selectedMonthData.revenue / 4)}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="ed-chart-card">
          <div className="ed-bar-chart">
            {monthlyData.map((m) => {
              const heightPct = maxRevenue > 0 ? (m.revenue / maxRevenue) * 100 : 0;
              const isCurrent = m.key === now.toLocaleDateString("en-CA").slice(0, 7);
              const isSelected = m.key === selectedMonth;
              return (
                <button key={m.key} type="button" className="ed-bar-col"
                  onClick={() => setSelectedMonth(isSelected ? null : m.key)}>
                  <div className="ed-bar-track">
                    <div className={`ed-bar-fill${isCurrent ? " current" : ""}${isSelected ? " selected" : ""}`}
                      style={{ height: `${Math.max(heightPct, m.revenue > 0 ? 3 : 0)}%` }} />
                  </div>
                  <span className={`ed-bar-label${isCurrent ? " current" : ""}${isSelected ? " selected" : ""}`}>
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Top students ── */}
        {topStudents.length > 0 && (
          <>
            <div className="ed-section-label">
              <FaTrophy style={{ marginRight: 6, fontSize: 12 }} />
              Top Students
            </div>
            <div className="ed-group-card">
              {topStudents.map((s, i) => {
                const pct = topStudents[0].revenue > 0 ? (s.revenue / topStudents[0].revenue) * 100 : 0;
                const medals = ["🥇","🥈","🥉","4️⃣","5️⃣"];
                return (
                  <div key={s.name} className="ed-student-row">
                    <span className="ed-rank">{medals[i]}</span>
                    <div className="ed-student-info">
                      <div className="ed-name-amount-row">
                        <strong>{s.name}</strong>
                        <span>{fmtDec(s.revenue)}</span>
                      </div>
                      <div className="ed-bar-track-thin">
                        <div className="ed-bar-fill-thin" style={{ width: `${pct}%` }} />
                      </div>
                      <p>{s.count} {s.count === 1 ? "lesson" : "lessons"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Revenue by type ── */}
        {typeEntries.length > 0 && (
          <>
            <div className="ed-section-label">Revenue by Type</div>
            <div className="ed-group-card">
              {typeEntries.map(([type, amount], i) => {
                const pct = typeTotal > 0 ? (amount / typeTotal) * 100 : 0;
                const color = typeColors[i % typeColors.length];
                return (
                  <div key={type} className="ed-type-row">
                    <div className="ed-type-dot" style={{ background: color }} />
                    <div className="ed-student-info">
                      <div className="ed-name-amount-row">
                        <strong style={{ textTransform: "capitalize" }}>{type}</strong>
                        <span>{fmtDec(amount)}</span>
                      </div>
                      <div className="ed-bar-track-thin">
                        <div className="ed-bar-fill-thin" style={{ width: `${pct}%`, background: color }} />
                      </div>
                      <p>{pct.toFixed(0)}% of revenue</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Insights ── */}
        <div className="ed-section-label">Insights</div>
        <div className="ed-insights-grid">
          <div className="ed-insight-card">
            <span>All-time Revenue</span>
            <strong>{fmtDec(allTimeRevenue)}</strong>
            <p>{lessons.filter(l => l.billing_status === "paid").length} paid lessons total</p>
          </div>
          <div className="ed-insight-card">
            <span>{now.getFullYear()} Revenue</span>
            <strong>{fmtDec(ytdRevenue)}</strong>
            <p>{ytdCount} lessons this year</p>
          </div>
          {bestMonth && (
            <div className="ed-insight-card ed-insight-green">
              <span>Best Month</span>
              <strong>{bestMonth.label}</strong>
              <p>{fmtDec(bestMonth.revenue)}</p>
            </div>
          )}
          {worstMonth && worstMonth.key !== bestMonth?.key && (
            <div className="ed-insight-card ed-insight-orange">
              <span>Slowest Month</span>
              <strong>{worstMonth.label}</strong>
              <p>{fmtDec(worstMonth.revenue)}</p>
            </div>
          )}
        </div>

        <div style={{ height: 20 }} />
      </div>

      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate("/dashboard")}><FaHome /><span>Dashboard</span></div>
        <div className="nav-item" onClick={() => navigate("/lessons")}><FaCalendarAlt /><span>Lessons</span></div>
        <div className="nav-item" onClick={() => navigate("/students")}><FaUsers /><span>Students</span></div>
        <div className="nav-item" onClick={() => navigate("/invoices")}><FaFileInvoiceDollar /><span>Invoices</span></div>
        <div className="nav-item" onClick={() => navigate("/more")}><FaEllipsisH /><span>More</span></div>
      </nav>
    </div>
  );
}