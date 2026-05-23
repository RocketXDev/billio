import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaPlus,
  FaPaperPlane,
  FaEdit,
  FaFilter,
  FaReceipt,
  FaClock,
  FaWallet,
} from "react-icons/fa";
import { supabase } from "../lib/supabaseClient";

function Invoices() {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [coachId, setCoachId] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      navigate("/login");
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profileData) {
      setLoading(false);
      return;
    }

    const { data: coachData } = await supabase
      .from("coaches")
      .select("id")
      .eq("profile_id", profileData.id)
      .single();

    if (!coachData) {
      setLoading(false);
      return;
    }

    setCoachId(coachData.id);

    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *,
        students (
          student_name,
          email,
          phone_number,
          parent_name,
          parent_phone
        )
      `)
      .eq("coach_id", coachData.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Invoices load error:", error);
      setLoading(false);
      return;
    }

    setInvoices(data || []);
    setLoading(false);
  }

  function formatMoney(amount: any) {
    return Number(amount || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function formatDate(date: string) {
    if (!date) return "Not set";

    return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const filteredInvoices =
    selectedFilter === "all"
      ? invoices
      : invoices.filter((invoice) => invoice.status === selectedFilter);

  const unpaidThisWeek = invoices
    .filter((invoice) => invoice.status === "pending" || invoice.status === "billed")
    .reduce((total, invoice) => total + Number(invoice.total || 0), 0);

  const paidThisMonth = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((total, invoice) => total + Number(invoice.total || 0), 0);

  const draftInvoices = invoices.filter((invoice) => invoice.status === null);

  const pendingInvoices = invoices.filter((invoice) => invoice.status === "pending");

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
    <div className="invoices-page">
        <div className="invoices-wrapper">
        <div className="invoices-body">
            <div className="invoices-header">
                <div className="invoices-header-add">
                    <h1>Invoices</h1>

                    <button
                    type="button"
                    className="invoices-add-btn"
                    // onClick={() => setShowAddInvoice(true)}
                    >
                    <FaPlus />
                    </button>
                </div>
            </div>
            <div className="invoice-stat-grid">
              <div className="invoice-stat-card purple-stat">
                <div className="invoice-stat-icon"><FaWallet /></div>
                <span>Unpaid this week</span>
                <strong>{formatMoney(unpaidThisWeek)}</strong>
                <p>{pendingInvoices.length} invoices</p>
              </div>

              <div className="invoice-stat-card green-stat">
                <div className="invoice-stat-icon"><FaFileInvoiceDollar /></div>
                <span>Paid total</span>
                <strong>{formatMoney(paidThisMonth)}</strong>
                <p>{invoices.filter((i) => i.status === "paid").length} invoices</p>
              </div>

              <div className="invoice-stat-card orange-stat">
                <div className="invoice-stat-icon"><FaReceipt /></div>
                <span>Draft invoices</span>
                <strong>{draftInvoices.length}</strong>
                <p>{formatMoney(draftInvoices.reduce((t, i) => t + Number(i.total || 0), 0))}</p>
              </div>

              <div className="invoice-stat-card red-stat">
                <div className="invoice-stat-icon"><FaClock /></div>
                <span>Pending</span>
                <strong>{pendingInvoices.length}</strong>
                <p>{formatMoney(pendingInvoices.reduce((t, i) => t + Number(i.total || 0), 0))}</p>
              </div>
            </div>


            <div className="invoices-list-view">
            <section className="invoices-group">
                <div className="invoices-group-title">
                <h2>Your Invoices</h2>
                <span>
                    {invoices.length}{" "}
                    {invoices.length === 1 ? "invoice" : "invoices"}
                </span>
                </div>

                {invoices.length === 0 ? (
                <p className="invoices-empty">
                    No invoices yet. Tap + to create one.
                </p>
                ) : (
                <div className="invoices-group-card">
                    {invoices.map((invoice) => (
                    <div key={invoice.id} className="invoices-row">
                        <div className="invoices-avatar">
                        {invoice.students?.student_name
                            ? invoice.students.student_name.charAt(0).toUpperCase()
                            : "I"}
                        </div>

                        <div className="invoices-info">
                        <strong>
                            {invoice.invoice_number || "Invoice"}
                        </strong>

                        <span>
                            {invoice.students?.student_name || "Student"} •{" "}
                            {formatMoney(invoice.total)}
                        </span>

                        <span>
                            {invoice.status || "No status"}
                        </span>
                        </div>

                        <button
                        type="button"
                        className="invoices-edit-btn"
                        // onClick={() => openEditInvoice(invoice)}
                        >
                        <FaEdit />
                        </button>
                    </div>
                    ))}
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

            <div className="nav-item" onClick={() => navigate("/students")}>
            <FaUsers />
            <span>Students</span>
            </div>

            <div className="nav-item active">
            <FaFileInvoiceDollar />
            <span>Invoices</span>
            </div>

            <div className="nav-item" onClick={() => navigate("/more")}>
            <FaEllipsisH />
            <span>More</span>
            </div>
        </nav>
        </div>
    </div>
  );
}

export default Invoices;