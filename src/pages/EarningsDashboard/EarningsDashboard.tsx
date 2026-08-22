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
import { useLessonTerm } from "../../hooks/useLessonTerm";
import "./EarningsDashboard.css";

export default function EarningsDashboard() {
  const navigate = useNavigate();
  const { coachId, identityLoading } = useCoachIdentity();
  const term = useLessonTerm();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  useEffect(() => { if (!coachId && !identityLoading) navigate("/login"); }, [coachId, identityLoading]);

  // Aggregation (sums/counts/group-bys) happens in Postgres via the
  // get_earnings_summary RPC instead of pulling every lesson/invoice a coach
  // has ever created to the client and reducing them here — see
  // scripts/add_earnings_summary_rpc.sql. Own query key (not the shared
  // ["lessons"/"invoices", coachId] used elsewhere), so it can't go stale
  // relative to, or interfere with, other pages' caches.
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["earnings-summary", coachId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_earnings_summary", { p_coach_id: coachId });
      if (error) throw error;
      return data as {
        thisMonth: { revenue: number; count: number };
        ytd: { revenue: number; count: number; monthsWithRevenue: number };
        allTime: { revenue: number; paidCount: number };
        unpaidLessons: { total: number; count: number };
        unpaidInvoices: { total: number; count: number };
        monthly: { key: string; revenue: number; count: number }[];
        topStudents: { name: string; revenue: number; count: number }[];
        byType: { type: string; amount: number }[];
      };
    },
    enabled: !!coachId,
  });

  // Gate on the data actually being present, not just `isLoading` — react-query
  // reports `isLoading: false` while a query is still `enabled: false` (i.e.
  // before coachId resolves), which would otherwise let stats render as zero
  // before the real numbers arrive.
  const loading = identityLoading || !coachId || summaryLoading || summary === undefined;

  const now = new Date();

  // ── This month ──
  const thisMonthRevenue = summary?.thisMonth.revenue ?? 0;
  const thisMonthCount = summary?.thisMonth.count ?? 0;

  // avg weekly: divide by weeks elapsed this month (at least 1)
  const dayOfMonth = now.getDate();
  const weeksElapsed = Math.max(1, Math.ceil(dayOfMonth / 7));
  const thisMonthAvgWeekly = thisMonthRevenue / weeksElapsed;

  // ── YTD ──
  const ytdRevenue = summary?.ytd.revenue ?? 0;
  const ytdCount = summary?.ytd.count ?? 0;
  const monthsWithRevenue = summary?.ytd.monthsWithRevenue ?? 0;
  const ytdAvgMonthly = monthsWithRevenue > 0 ? ytdRevenue / monthsWithRevenue : 0;

  // ── All time ──
  const allTimeRevenue = summary?.allTime.revenue ?? 0;
  const allTimePaidCount = summary?.allTime.paidCount ?? 0;

  // ── Outstanding ──
  const unpaidInvoiceTotal = summary?.unpaidInvoices.total ?? 0;
  const unpaidInvoiceCount = summary?.unpaidInvoices.count ?? 0;
  const unpaidLessonsTotal = summary?.unpaidLessons.total ?? 0;
  const unpaidLessonCount = summary?.unpaidLessons.count ?? 0;

  // ── Monthly chart (last 12 months) ──
  const monthlyData = (summary?.monthly ?? []).map((m) => {
    const [year, month] = m.key.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const fullLabel = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return { key: m.key, label, fullLabel, revenue: m.revenue, count: m.count };
  });
  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);

  const selectedMonthData = selectedMonth
    ? monthlyData.find(m => m.key === selectedMonth) ?? null
    : null;

  // ── Top students ──
  const topStudents = summary?.topStudents ?? [];

  // ── Revenue by type ──
  const typeEntries: [string, number][] = (summary?.byType ?? []).map(t => [t.type, t.amount]);
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
        <div className="ed-header-inner">
          <h1 className="ed-title">Earnings</h1>
          <p className="ed-subtitle">{now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</p>
        </div>
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
            <p>paid {term.lowerPlural}</p>
          </div>
          <div className="ed-stat-card ed-stat-purple">
            <div className="ed-stat-icon" style={{ background: "#ede9fe", color: "var(--primary-purple)" }}>
              <FaCalendarAlt />
            </div>
            <span>{term.plural}</span>
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
            <span>{term.plural}</span>
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
              <span>{unpaidInvoiceCount} unpaid {unpaidInvoiceCount === 1 ? "invoice" : "invoices"}</span>
            </div>
          </div>
          <div className="ed-outstanding-card">
            <div className="ed-outstanding-icon" style={{ background: "#fef2f2", color: "#ef4444" }}>
              <FaExclamationCircle />
            </div>
            <div>
              <strong>{fmtDec(unpaidLessonsTotal)}</strong>
              <span>{unpaidLessonCount} unbilled {unpaidLessonCount === 1 ? term.lower : term.lowerPlural}</span>
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
                <span>{term.plural}</span>
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
                      <p>{s.count} {s.count === 1 ? term.lower : term.lowerPlural}</p>
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
            <p>{allTimePaidCount} paid lessons total</p>
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
        <div className="nav-item" onClick={() => navigate("/lessons")}><FaCalendarAlt /><span>{term.plural}</span></div>
        <div className="nav-item" onClick={() => navigate("/students")}><FaUsers /><span>Students</span></div>
        <div className="nav-item" onClick={() => navigate("/invoices")}><FaFileInvoiceDollar /><span>Invoices</span></div>
        <div className="nav-item" onClick={() => navigate("/more")}><FaEllipsisH /><span>More</span></div>
      </nav>
    </div>
  );
}