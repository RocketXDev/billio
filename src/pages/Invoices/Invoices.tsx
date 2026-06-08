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
  FaChevronDown, 
  FaChevronRight,
  FaCog
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import "./Invoices.css"

function Invoices() {
  const navigate = useNavigate();

  const [invoices, setInvoices] = useState<any[]>([]);
  const [coachId, setCoachId] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [sendSuccessRecipient, setSendSuccessRecipient] = useState("");
  const [sendSuccessMethod, setSendSuccessMethod] = useState("");
  const [sendError, setSendError] = useState("");

  // Invoices Creation States
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [invoiceLessons, setInvoiceLessons] = useState<any[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [isClosingCalendar, setIsClosingCalendar] = useState(false);
  const [showStudentPicker, setShowStudentPicker] = useState(false);

  // Invoices Editing
  const [showEditInvoice, setShowEditInvoice] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [editInvoiceNumber, setEditInvoiceNumber] = useState("");
  const [editInvoiceStatus, setEditInvoiceStatus] = useState("");
  const [editIssueDate, setEditIssueDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editInvoiceLessons, setEditInvoiceLessons] = useState<any[]>([]);
  const [editSelectedLessonIds, setEditSelectedLessonIds] = useState<string[]>([]);
  const [originalInvoiceStatus, setOriginalInvoiceStatus] = useState("unbilled");
  const [sendingInvoiceId, setSendingInvoiceId] = useState<string | null>(null);
  const [openMonths, setOpenMonths] = useState<any>({});
  const [openWeeks, setOpenWeeks] = useState<any>({});

  // Invoices settings
  const [showInvoiceSettings, setShowInvoiceSettings] = useState(false);
  const [invoiceGenerationDay, setInvoiceGenerationDay] = useState("0");
  const [invoiceGenerationTime, setInvoiceGenerationTime] = useState("15:00");
  const [invoiceReviewDay, setInvoiceReviewDay] = useState("0");
  const [invoiceReviewTime, setInvoiceReviewTime] = useState("15:05");
  const [invoiceTimezone, setInvoiceTimezone] = useState("America/Denver");
  const [savingInvoiceSettings, setSavingInvoiceSettings] = useState(false);

  // Loading
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    if (coachId && selectedStudentId && rangeStart && rangeEnd) {
      loadInvoiceLessons();
    }
  }, [coachId, selectedStudentId, rangeStart, rangeEnd]);

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
    await loadInvoiceSettings(coachData.id);
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
    .filter((invoice) => invoice.status === "unbilled" || invoice.status === "billed")
    .reduce((total, invoice) => total + Number(invoice.total || 0), 0);

  const paidThisMonth = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((total, invoice) => total + Number(invoice.total || 0), 0);

  const draftInvoices = invoices.filter((invoice) => invoice.status === "unbilled");

  const pendingInvoices = invoices.filter((invoice) => invoice.status === "billed");

  async function openAddInvoice() {
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
      console.log("Load invoice students error:", error);
      return;
    }

    setStudents(data || []);
    setShowAddInvoice(true);
  }

  async function loadInvoiceLessons() {
    if (!coachId || !selectedStudentId || !rangeStart || !rangeEnd) return;

    const { data, error } = await supabase
      .from("lessons")
      .select("*")
      .eq("coach_id", coachId)
      .eq("student_id", selectedStudentId)
      .gte("lesson_date", rangeStart)
      .lte("lesson_date", rangeEnd)
      .order("lesson_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.log("Load invoice lessons error:", error);
      return;
    }

    setInvoiceLessons(data || []);
    setSelectedLessonIds((data || []).map((lesson) => lesson.id));
  }

  function toggleInvoiceLesson(lessonId: string) {
    setSelectedLessonIds((prev) =>
      prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId]
    );
  }

  async function handleCreateInvoice(e: any) {
    e.preventDefault();

    if (isSaving) return; 
    setIsSaving(true);

    try {

      if (!coachId || !selectedStudentId || selectedLessonIds.length === 0) return;

      const selectedLessons = invoiceLessons.filter((lesson) =>
        selectedLessonIds.includes(lesson.id)
      );

      const total = selectedLessons.reduce(
        (sum, lesson) => sum + Number(lesson.rate || 0),
        0
      );

      const invoiceNumber = generateInvoiceNumber();

      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          coach_id: coachId,
          student_id: selectedStudentId,
          status: "unbilled",
          subtotal: total,
          total,
          issue_date: new Date().toISOString().split("T")[0],
          notes: null,
        })
        .select(`
          *,
          students (
            student_name
          )
        `)
        .single();

      if (invoiceError) {
        console.log("Create invoice error:", invoiceError);
        return;
      }

      const invoiceLessonRows = selectedLessonIds.map((lessonId) => ({
        invoice_id: invoiceData.id,
        lesson_id: lessonId,
      }));

      const { error: linkError } = await supabase
        .from("invoice_lessons")
        .insert(invoiceLessonRows);

      if (linkError) {
        console.log("Invoice lesson link error:", linkError);
        return;
      }

      await supabase
        .from("lessons")
        .update({
          status: "unbilled",
        })
        .in("id", selectedLessonIds);

      setInvoices((prev) => [invoiceData, ...prev]);

    } finally {
      setIsSaving(false);
    }

    
    setSelectedStudentId("");
    setRangeStart("");
    setRangeEnd("");
    setInvoiceLessons([]);
    setSelectedLessonIds([]);
    setShowAddInvoice(false);
  }

  function formatDateRangeLabel() {
    if (!rangeStart && !rangeEnd) return "Select date range";
    if (rangeStart && !rangeEnd) return `${rangeStart} → End date`;
    return `${rangeStart} → ${rangeEnd}`;
  }

  function getCalendarDays() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days = [];

    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const value = date.toLocaleDateString("en-CA");
      days.push(value);
    }

    return days;
  }

  async function handleDateRangeSelect(dateValue: string) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(dateValue);
      setRangeEnd("");
      setInvoiceLessons([]);
      setSelectedLessonIds([]);
      return;
    }

    if (dateValue < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(dateValue);
    } else {
      setRangeEnd(dateValue);
    }

    setIsClosingCalendar(true);

    setTimeout(() => {
      setShowDateRangePicker(false);
      setIsClosingCalendar(false);
    }, 220);
  }

  function closeAddInvoice() {
    setShowAddInvoice(false);
    setSelectedStudentId("");
    setRangeStart("");
    setRangeEnd("");
    setInvoiceLessons([]);
    setSelectedLessonIds([]);
    setShowDateRangePicker(false);
    setShowStudentPicker(false);
  }

  async function openEditInvoice(invoice: any) {
    setEditingInvoice(invoice);

    setOriginalInvoiceStatus(invoice.status || "unbilled");
    setEditInvoiceStatus(invoice.status || "unbilled"); 
    setEditIssueDate(invoice.issue_date || "");
    setEditDueDate(invoice.due_date || "");
    setEditNotes(invoice.notes || "");

    const { data, error } = await supabase
      .from("invoice_lessons")
      .select(`
        lesson_id,
        lessons (
          id,
          lesson_date,
          start_time,
          duration_minutes,
          rate,
          billing_status
        )
      `)
      .eq("invoice_id", invoice.id);

    if (error) {
      console.log("Load invoice lessons error:", error);
      setEditInvoiceLessons([]);
      setEditSelectedLessonIds([]);
    } else {
      const lessons = data?.map((row: any) => row.lessons) || [];

      setEditInvoiceLessons(lessons);
      setEditSelectedLessonIds(data?.map((row: any) => row.lesson_id) || []);
    }

    setShowEditInvoice(true);
  }

  function closeEditInvoice() {
    setShowEditInvoice(false);
    setEditingInvoice(null);

    setEditInvoiceStatus("unbilled");
    setEditIssueDate("");
    setEditDueDate("");
    setEditNotes("");
    setEditInvoiceLessons([]);
    setEditSelectedLessonIds([]);
  }

  function toggleEditInvoiceLesson(lessonId: string) {
    setEditSelectedLessonIds((prev) =>
      prev.includes(lessonId)
        ? prev.filter((id) => id !== lessonId)
        : [...prev, lessonId]
    );
  }

  async function handleUpdateInvoice(e: any) {
    e.preventDefault();

    if (!editingInvoice || !coachId) return;

    const selectedLessons = editInvoiceLessons.filter((lesson) =>
      editSelectedLessonIds.includes(lesson.id)
    );

    const total = editSelectedLessonIds.reduce((sum, lessonId) => {
      const lesson = editInvoiceLessons.find(
        (lesson) => lesson.id === lessonId
      );

      return sum + Number(lesson?.rate || 0);
    }, 0);

    const originalLessonIds = editInvoiceLessons.map((lesson) => lesson.id);

    const removedLessonIds = originalLessonIds.filter(
      (lessonId) => !editSelectedLessonIds.includes(lessonId)
    );

    const invoiceStatusChanged =
      editInvoiceStatus !== originalInvoiceStatus;

    if (editSelectedLessonIds.length === 0) {
      const { error: deleteInvoiceError } = await supabase
        .from("invoices")
        .delete()
        .eq("id", editingInvoice.id)
        .eq("coach_id", coachId);

      if (deleteInvoiceError) {
        console.log("Delete empty invoice error:", deleteInvoiceError);
        return;
      }

      if (removedLessonIds.length > 0) {
        await supabase
          .from("lessons")
          .update({
            billing_status: "unbilled",
          })
          .in("id", removedLessonIds)
          .eq("coach_id", coachId);
      }

      setInvoices((prev) =>
        prev.filter((invoice) => invoice.id !== editingInvoice.id)
      );

      setEditInvoiceLessons(selectedLessons);
      closeEditInvoice();
      return;
    }

    const { error: deleteLinksError } = await supabase
      .from("invoice_lessons")
      .delete()
      .eq("invoice_id", editingInvoice.id);

    if (deleteLinksError) {
      console.log("Delete old invoice lesson links error:", deleteLinksError);
      return;
    }

    const { error: linkError } = await supabase
      .from("invoice_lessons")
      .insert(
        editSelectedLessonIds.map((lessonId) => ({
          invoice_id: editingInvoice.id,
          lesson_id: lessonId,
        }))
      );

    if (linkError) {
      console.log("Update invoice lessons error:", linkError);
      return;
    }

    if (removedLessonIds.length > 0) {
      await supabase
        .from("lessons")
        .update({
          billing_status: "unbilled",
        })
        .in("id", removedLessonIds)
        .eq("coach_id", coachId);
    }

    if (invoiceStatusChanged && editSelectedLessonIds.length > 0) {
      const { error: selectedLessonsError } = await supabase
        .from("lessons")
        .update({
          billing_status: editInvoiceStatus,
        })
        .in("id", editSelectedLessonIds)
        .eq("coach_id", coachId);

      if (selectedLessonsError) {
        console.log(
          "Update selected lessons billing status error:",
          selectedLessonsError
        );
        return;
      }
    }

    const finalSelectedLessons = invoiceStatusChanged
      ? selectedLessons.map((lesson) => ({
          ...lesson,
          billing_status: editInvoiceStatus,
        }))
      : selectedLessons;

    const finalInvoiceStatus =
      getInvoiceStatusFromLessons(finalSelectedLessons);

    const { data: updatedInvoice, error: invoiceError } = await supabase
      .from("invoices")
      .update({
        status: finalInvoiceStatus,
        issue_date: editIssueDate || null,
        due_date: editDueDate || null,
        notes: editNotes || null,
        subtotal: total,
        total,
      })
      .eq("id", editingInvoice.id)
      .eq("coach_id", coachId)
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
      .single();

    if (invoiceError) {
      console.log("Update invoice error:", invoiceError);
      return;
    }

    setInvoices((prev) =>
      prev.map((invoice) =>
        invoice.id === editingInvoice.id ? updatedInvoice : invoice
      )
    );

    closeEditInvoice();
  }

  async function handleDeleteInvoice(invoiceId: string) {

    const lessonIds = editInvoiceLessons.map((lesson) => lesson.id);

    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoiceId)
      .eq("coach_id", coachId);

    if (error) {
      console.log("Delete invoice error:", error);
      return;
    }

    setInvoices((prev) =>
      prev.filter((invoice) => invoice.id !== invoiceId)
    );

    closeEditInvoice();
  }

  function generateInvoiceNumber() {
    const year = new Date().getFullYear();

    const randomCode = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();

    return `INV-${year}-${randomCode}`;
  }

  function getInvoiceStatusFromLessons(lessons: any[]) {
    if (lessons.length === 0) return "unbilled";

    const statuses = lessons.map(
      (lesson) => lesson.billing_status || "unbilled"
    );

    if (statuses.every((status) => status === "paid")) {
      return "paid";
    }

    if (statuses.some((status) => status === "unbilled")) {
      return "unbilled";
    }

    return "billed";
  }
  const currentInvoices = invoices.filter(
    (invoice) => (invoice.status || "unbilled") === "unbilled"
  );

  const billedInvoices = invoices.filter(
    (invoice) => invoice.status === "billed"
  );

  const pastInvoices = invoices.filter(
    (invoice) => invoice.status === "paid"
  );

  async function sendInvoice(invoiceId: string) {
    if (sendingInvoiceId) return;

    setSendingInvoiceId(invoiceId);
    setSendError("");
    setSendSuccessRecipient("");

    const { data, error } = await supabase.functions.invoke(
      "send-single-invoice",
      {
        body: { invoiceId },
      }
    );

    setSendingInvoiceId(null);

    if (error || data?.error) {
      const rawError =
        data?.error ||
        error?.message ||
        "Invoice could not be sent.";

      let customMessage = "Invoice could not be sent. Please try again.";

      if (rawError.toLowerCase().includes("student email")) {
        customMessage =
          "Student email is missing. Please open this student and add their email before sending the invoice.";
      } else if (rawError.toLowerCase().includes("parent email")) {
        customMessage =
          "Parent email is missing. Please open this student and add the parent email before sending the invoice.";
      } else if (rawError.toLowerCase().includes("no email")) {
        customMessage =
          "No email was found for this student. Please add either a student email or parent email before sending.";
      } else if (rawError.toLowerCase().includes("text delivery")) {
        customMessage =
          "Text invoice delivery is not available yet. Please use email delivery for now.";
      }

      setSendError(customMessage);
      return;
    }

    setInvoices((prev) =>
      prev.map((invoice) =>
        invoice.id === invoiceId
          ? {
              ...invoice,
              status: "billed",
              sent_at: new Date().toISOString(),
              delivery_method: data.deliveryMethod || "email",
              recipient_email: data.recipientEmail,
            }
          : invoice
      )
    );

    setSendSuccessRecipient(
      data.recipientPhone || data.recipientEmail || "recipient"
    );

    setSendSuccessMethod(data.deliveryMethod || "email");
  }

  function getWeekStart(dateString: string) {
    const date = new Date(`${dateString}T00:00:00`);
    const day = date.getDay();
    const diff = date.getDate() - day + 1;

    if (day === 0) {
      date.setDate(date.getDate() - 6);
    } else {
      date.setDate(diff);
    }

    return date;
  }

  function getWeekEnd(weekStart: Date) {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    return end;
  }

  function formatMonthYear(date: Date) {
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  function formatWeekRange(start: Date, end: Date) {
    const startText = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    const endText = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });

    return `${startText} – ${endText}`;
  }

  const groupedPastInvoices = pastInvoices.reduce((groups: any, invoice: any) => {
    const dateSource =
      invoice.period_start ||
      invoice.issue_date ||
      invoice.created_at;

    const weekStart = getWeekStart(dateSource);
    const weekEnd = getWeekEnd(weekStart);

    const monthKey = formatMonthYear(weekStart);
    const weekKey = `${weekStart.toISOString().slice(0, 10)}_${weekEnd
      .toISOString()
      .slice(0, 10)}`;

    if (!groups[monthKey]) {
      groups[monthKey] = {};
    }

    if (!groups[monthKey][weekKey]) {
      groups[monthKey][weekKey] = {
        label: formatWeekRange(weekStart, weekEnd),
        invoices: [],
      };
    }

    groups[monthKey][weekKey].invoices.push(invoice);

    return groups;
  }, {});

  async function loadInvoiceSettings(currentCoachId: string) {
    const { data, error } = await supabase
      .from("coaches")
      .select(`
        invoice_generation_day,
        invoice_generation_time,
        invoice_review_day,
        invoice_review_time,
        invoice_timezone
      `)
      .eq("id", currentCoachId)
      .single();

    if (error || !data) {
      console.log("Load invoice settings error:", error);
      return;
    }

    setInvoiceGenerationDay(String(data.invoice_generation_day ?? 0));
    setInvoiceGenerationTime(data.invoice_generation_time || "15:00");
    setInvoiceReviewDay(String(data.invoice_review_day ?? 0));
    setInvoiceReviewTime(data.invoice_review_time || "15:05");
    setInvoiceTimezone(data.invoice_timezone || "America/Denver");
  }

  async function handleSaveInvoiceSettings(e: any) {
    e.preventDefault();

    if (!coachId || savingInvoiceSettings) return;

    setSavingInvoiceSettings(true);

    const { error } = await supabase
      .from("coaches")
      .update({
        invoice_generation_day: Number(invoiceGenerationDay),
        invoice_generation_time: invoiceGenerationTime,
        invoice_review_day: Number(invoiceReviewDay),
        invoice_review_time: invoiceReviewTime,
        invoice_timezone: invoiceTimezone,
      })
      .eq("id", coachId);

    setSavingInvoiceSettings(false);

    if (error) {
      console.log("Save invoice settings error:", error);
      return;
    }

    setShowInvoiceSettings(false);
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
    <div className="invoices-page">
        <div className="invoices-wrapper">
        <div className="invoices-body">
            <div className="invoices-header">
                <div className="invoices-header-add">
                    <h1>Invoices</h1>

                     <div className="invoices-header-actions">
                      <button
                        type="button"
                        className="invoices-settings-btn"
                        onClick={() => setShowInvoiceSettings(true)}
                      >
                        <FaCog />
                      </button>

                      <button
                      type="button"
                      className="invoices-add-btn"
                      onClick={openAddInvoice}
                      >
                        <FaPlus />
                      </button>
                    </div>
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
                <span>Unbilled invoices</span>
                <strong>{draftInvoices.length}</strong>
                <p>{formatMoney(draftInvoices.reduce((t, i) => t + Number(i.total || 0), 0))}</p>
              </div>

              <div className="invoice-stat-card red-stat">
                <div className="invoice-stat-icon"><FaClock /></div>
                <span>Billed Invoices</span>
                <strong>{pendingInvoices.length}</strong>
                <p>{formatMoney(pendingInvoices.reduce((t, i) => t + Number(i.total || 0), 0))}</p>
              </div>
            </div>


            <div className="invoices-list-view">
              {/* ── Unbilled ── */}
              <section className="invoices-group">
                <div className="invoices-group-title">
                  <h2>Current Invoices</h2>
                  <span>{currentInvoices.length} {currentInvoices.length === 1 ? "invoice" : "invoices"}</span>
                </div>
                {currentInvoices.length === 0 ? (
                  <p className="invoices-empty">No current invoices.</p>
                ) : (
                  <div className="invoices-group-card">
                    {currentInvoices.map((invoice) => (
                      <div key={invoice.id} className="invoices-row">
                        <div className="invoices-avatar">
                          {invoice.students?.student_name ? invoice.students.student_name.charAt(0).toUpperCase() : "I"}
                        </div>
                        <div className="invoices-info">
                          <strong>{invoice.invoice_number || "Invoice"}</strong>
                          <span>{invoice.students?.student_name || "Student"} • {formatMoney(invoice.total)}</span>
                          <span><div className="calendar-billing-label unbilled">Unbilled</div></span>
                        </div>
                        <div className="invoice-actions">
                          <button type="button" className="invoice-edit-btn" onClick={(e) => { e.stopPropagation(); openEditInvoice(invoice); }}>
                            <FaEdit />
                          </button>
                          <button type="button" className="invoice-send-btn" disabled={sendingInvoiceId === invoice.id} onClick={(e) => { e.stopPropagation(); sendInvoice(invoice.id); }}>
                            {sendingInvoiceId === invoice.id ? "..." : <FaPaperPlane />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="invoices-group">
                <div className="invoices-group-title">
                  <h2>Billed Invoices</h2>
                  <span>{billedInvoices.length} {billedInvoices.length === 1 ? "invoice" : "invoices"}</span>
                </div>
                {billedInvoices.length === 0 ? (
                  <p className="invoices-empty">No billed invoices awaiting payment.</p>
                ) : (
                  <div className="invoices-group-card">
                    {billedInvoices.map((invoice) => (
                      <div key={invoice.id} className="invoices-row">
                        <div className="invoices-avatar" style={{ background: "#dbeafe", color: "#2563eb" }}>
                          {invoice.students?.student_name ? invoice.students.student_name.charAt(0).toUpperCase() : "I"}
                        </div>
                        <div className="invoices-info">
                          <strong>{invoice.invoice_number || "Invoice"}</strong>
                          <span>{invoice.students?.student_name || "Student"} • {formatMoney(invoice.total)}</span>
                          <span>
                            <div className="calendar-billing-label billed">Billed</div>
                            {invoice.due_date && (
                              <span style={{ fontSize: 11, color: new Date(invoice.due_date + "T00:00:00") < new Date() ? "#ef4444" : "var(--secondary-text)", marginLeft: 6 }}>
                                Due {formatDate(invoice.due_date)}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="invoice-actions">
                          <button type="button" className="invoice-edit-btn" onClick={(e) => { e.stopPropagation(); openEditInvoice(invoice); }}>
                            <FaEdit />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="invoices-group past-invoices-group">
                <div className="invoices-group-title">
                  <h2>Past Invoices</h2>
                  <span>
                    {pastInvoices.length}{" "}
                    {pastInvoices.length === 1 ? "invoice" : "invoices"}
                  </span>
                </div>

                {pastInvoices.length === 0 ? (
                  <p className="invoices-empty">No past invoices.</p>
                ) : (
                  <div className="invoice-archive">
                    {Object.entries(groupedPastInvoices).map(
                      ([monthLabel, weeks]: any) => (
                        <div key={monthLabel} className="invoice-month-group">
                          <button
                            type="button"
                            className="invoice-month-toggle"
                            onClick={() =>
                              setOpenMonths((prev: any) => ({
                                ...prev,
                                [monthLabel]: !prev[monthLabel],
                              }))
                            }
                          >
                            <span>
                              {openMonths[monthLabel] ? (
                                <FaChevronDown />
                              ) : (
                                <FaChevronRight />
                              )}

                              {monthLabel}
                            </span>

                            <strong>
                              {Object.values(weeks).reduce(
                                (sum: number, week: any) =>
                                  sum + week.invoices.length,
                                0
                              )}
                            </strong>
                          </button>

                          {openMonths[monthLabel] && (
                            <div className="invoice-week-list">
                              {Object.entries(weeks).map(([weekKey, week]: any) => (
                                <div key={weekKey} className="invoice-week-group">
                                  <button
                                    type="button"
                                    className="invoice-week-toggle"
                                    onClick={() =>
                                      setOpenWeeks((prev: any) => ({
                                        ...prev,
                                        [weekKey]: !prev[weekKey],
                                      }))
                                    }
                                  >
                                    <span>
                                      {openWeeks[weekKey] ? (
                                        <FaChevronDown />
                                      ) : (
                                        <FaChevronRight />
                                      )}
                                      {week.label}
                                    </span>

                                    <strong>{week.invoices.length}</strong>
                                  </button>

                                  {openWeeks[weekKey] && (
                                    <div className="invoices-group-card">
                                      {week.invoices.map((invoice: any) => (
                                        <div
                                          key={invoice.id}
                                          className="invoices-row past-invoice-row"
                                        >
                                          <div className="invoices-avatar">
                                            {invoice.students?.student_name
                                              ? invoice.students.student_name
                                                  .charAt(0)
                                                  .toUpperCase()
                                              : "I"}
                                          </div>

                                          <div className="invoices-info">
                                            <strong>
                                              {invoice.invoice_number || "Invoice"}
                                            </strong>

                                            <span>
                                              {invoice.students?.student_name ||
                                                "Student"}{" "}
                                              • {formatMoney(invoice.total)}
                                            </span>

                                            <div
                                              className={`calendar-billing-label ${
                                                (invoice.status || "unbilled")
                                                  .trim()
                                                  .toLowerCase()
                                              }`}
                                            >
                                              {(invoice.status || "unbilled")
                                                .charAt(0)
                                                .toUpperCase() +
                                                (invoice.status || "unbilled").slice(1)}
                                            </div>
                                          </div>

                                          <div className="invoice-actions">
                                            <button
                                              type="button"
                                              className="invoice-edit-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openEditInvoice(invoice);
                                              }}
                                            >
                                              <FaEdit />
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    )}
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
        {showAddInvoice && (
          <div
            className="invoices-add-overlay"
            onClick={closeAddInvoice}
          >
            <div
              className={`invoices-add-sheet ${
                showStudentPicker ? "student-picker-open" : ""
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="invoices-add-header">
                <h2>Create Invoice</h2>
                <button type="button" onClick={closeAddInvoice}>
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="invoices-add-form">
                <div className="input-block student-search-block">
                  <label>Student</label>

                  <input
                    type="text"
                    className="invoice-date-range-btn"
                    value={
                      selectedStudentId
                        ? students.find((link: any) => link.student_id === selectedStudentId)
                            ?.students?.student_name || ""
                        : ""
                    }
                    placeholder="Select student"
                    readOnly
                    onClick={() => setShowStudentPicker(true)}
                  />

                  {showStudentPicker && (
                    <div className="student-suggestions invoice-student-dropdown">
                      {students.map((link: any) => (
                        <button
                          key={link.student_id}
                          type="button"
                          className="student-suggestion"
                          onClick={() => {
                            setSelectedStudentId(link.student_id);
                            setShowStudentPicker(false);
                            setInvoiceLessons([]);
                            setSelectedLessonIds([]);
                          }}
                        >
                          {link.students?.student_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="input-block invoice-date-range-wrapper">
                  <label>Date Range</label>
                  <button
                    type="button"
                    className="invoice-date-range-btn"
                    onClick={() => setShowDateRangePicker(true)}
                  >
                    {formatDateRangeLabel()}
                  </button>
                    {showDateRangePicker && (
                      <div className={`invoice-calendar-floating ${
                              isClosingCalendar ? "closing" : ""
                            }`}>
                        <div className="invoice-calendar-header">
                          <button
                            type="button"
                            onClick={() =>
                              setCalendarMonth(
                                new Date(
                                  calendarMonth.getFullYear(),
                                  calendarMonth.getMonth() - 1,
                                  1
                                )
                              )
                            }
                          >
                            ‹
                          </button>

                          <strong>
                            {calendarMonth.toLocaleDateString("en-US", {
                              month: "long",
                              year: "numeric",
                            })}
                          </strong>

                          <button
                            type="button"
                            onClick={() =>
                              setCalendarMonth(
                                new Date(
                                  calendarMonth.getFullYear(),
                                  calendarMonth.getMonth() + 1,
                                  1
                                )
                              )
                            }
                          >
                            ›
                          </button>
                        </div>

                        <div className="invoice-calendar-weekdays">
                          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                            <span key={day}>{day.charAt(0)}</span>
                          ))}
                        </div>

                        <div className="invoice-calendar-grid">
                          {getCalendarDays().map((dateValue, index) => {
                            const isSelected =
                              dateValue === rangeStart || dateValue === rangeEnd;

                            const isInRange =
                              dateValue &&
                              rangeStart &&
                              rangeEnd &&
                              dateValue > rangeStart &&
                              dateValue < rangeEnd;

                            return (
                              <button
                                key={index}
                                type="button"
                                className={`
                                  invoice-calendar-day
                                  ${isSelected ? "selected" : ""}
                                  ${isInRange ? "in-range" : ""}
                                `}
                                disabled={!dateValue}
                                onClick={() => dateValue && handleDateRangeSelect(dateValue)}
                              >
                                {dateValue ? Number(dateValue.split("-")[2]) : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
                {rangeStart && rangeEnd && (
                  <>
                    {invoiceLessons.length === 0 ? (
                      <p className="invoices-empty">
                        No lessons in that date range.
                      </p>
                    ) : (
                      <div className="invoice-lessons-section">
                        <h3>Lessons</h3>

                        <div className="invoice-lessons-picker">
                          {invoiceLessons.map((lesson) => {
                            const billingStatus = lesson.status || "unbilled";

                            return (
                              <button
                                key={lesson.id}
                                type="button"
                                className={`invoice-lesson-option ${
                                  selectedLessonIds.includes(lesson.id) ? "selected" : ""
                                }`}
                                onClick={() => toggleInvoiceLesson(lesson.id)}
                              >
                                <div>
                                  <strong>
                                    {lesson.lesson_date} • {lesson.duration_minutes} min
                                  </strong>

                                  <span>
                                    {lesson.start_time?.slice(0, 5)} •{" "}
                                    <b className={`billing-status ${billingStatus}`}>
                                      {billingStatus.charAt(0).toUpperCase() + billingStatus.slice(1)}
                                    </b>
                                  </span>
                                </div>

                                <span className="invoice-lesson-check">
                                  {selectedLessonIds.includes(lesson.id) ? "✓" : ""}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <button type="submit" className="invoices-save-btn" disabled={isSaving}>
                  {isSaving ? "Creating..." : "Create Invoice"}
                </button>
              </form>
            </div>
          </div>
        )}
        {showEditInvoice && editingInvoice && (
          <div
            className="invoices-add-overlay"
            onClick={closeEditInvoice}
          >
            <div
              className="invoices-add-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="invoices-add-header">
                <h2>Edit Invoice</h2>

                <button type="button" onClick={closeEditInvoice}>
                  ×
                </button>
              </div>

              <form onSubmit={handleUpdateInvoice} className="invoices-add-form">
                <div className="invoice-readonly-number">
                  <span>Invoice Number</span>
                  <strong>
                    {editingInvoice.invoice_number || "No invoice number"}
                  </strong>
                </div>

                <div className="input-block">
                  <label>Status</label>
                  <select
                    value={editInvoiceStatus}
                    onChange={(e) => setEditInvoiceStatus(e.target.value)}
                  >
                    <option value="unbilled">Unbilled</option>
                    <option value="billed">Billed</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>

                <div className="input-block">
                  <label>Issue Date</label>
                  <input
                    type="date"
                    value={editIssueDate}
                    onChange={(e) => setEditIssueDate(e.target.value)}
                  />
                </div>

                <div className="input-block">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                  />
                </div>

                <div className="input-block">
                  <label>Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Invoice notes"
                  />
                </div>

                {editInvoiceLessons.length > 0 && (
                  <div className="invoice-lessons-section">
                    <h3>Lessons</h3>

                    <div className="invoice-lessons-picker">
                      {editInvoiceLessons.map((lesson) => {
                        const isSelected = editSelectedLessonIds.includes(lesson.id);
                        const billingStatus = lesson.billing_status || "unbilled";

                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            className={`invoice-lesson-option ${
                              isSelected ? "selected" : ""
                            }`}
                            onClick={() => toggleEditInvoiceLesson(lesson.id)}
                          >
                            <div>
                              <strong>
                                {lesson.lesson_date} • {lesson.duration_minutes} min
                              </strong>

                              <span>
                                {lesson.start_time?.slice(0, 5)} •{" "}
                                <b className={`billing-status ${billingStatus}`}>
                                  {billingStatus.charAt(0).toUpperCase() + billingStatus.slice(1)}
                                </b>
                              </span>
                            </div>

                            <span className="invoice-lesson-check">
                              {isSelected ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button type="submit" className="invoices-save-btn">
                  Save Changes
                </button>

                <button
                  type="button"
                  className="invoices-delete-btn"
                  onClick={() => handleDeleteInvoice(editingInvoice.id)}
                >
                  Delete Invoice
                </button>
              </form>
            </div>
          </div>
        )}
        {sendSuccessRecipient && (
          <div
            className="invoice-success-overlay"
            onClick={() => {
              setSendSuccessRecipient("");
              setSendSuccessMethod("");
            }}
          >
            <div
              className="invoice-success-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="invoice-success-icon">
                ✓
              </div>

              <h2>Invoice Sent</h2>

              <p>
                Invoice was successfully sent by{" "}
                <strong>
                  {sendSuccessMethod === "text"
                    ? "text message"
                    : sendSuccessMethod === "both"
                    ? "email and text message"
                    : "email"}
                </strong>{" "}
                to <strong>{sendSuccessRecipient}</strong>.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSendSuccessRecipient("");
                  setSendSuccessMethod("");
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
        {sendError && (
          <div
            className="invoice-success-overlay"
            onClick={() => setSendError("")}
          >
            <div
              className="invoice-success-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="invoice-error-icon">
                !
              </div>

              <h2>Failed</h2>

              <p>
                Please add student's info before sending invoices
              </p>

              <button
                type="button"
                onClick={() => setSendError("")}
              >
                Close
              </button>
            </div>
          </div>
        )}
        {sendingInvoiceId && (
          <div className="invoice-sending-overlay">
            <div className="invoice-sending-card">
              <div className="billio-mini-spinner" />

              <h2>Sending Invoice</h2>
              <p>Please wait while Billio sends this invoice.</p>
            </div>
          </div>
        )}
        {showInvoiceSettings && (
          <div
            className="invoice-settings-overlay"
            onClick={() => setShowInvoiceSettings(false)}
          >
            <div
              className="invoice-settings-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="invoice-settings-header">
                <h2>Invoice Settings</h2>

                <button
                  type="button"
                  onClick={() => setShowInvoiceSettings(false)}
                >
                  ×
                </button>
              </div>

              <form className="invoice-settings-form" onSubmit={handleSaveInvoiceSettings}>
                <section className="invoice-settings-section">
                  <h3>Generate Invoices</h3>
                  <p>
                    Choose when Billio should automatically create invoices from
                    unbilled lessons.
                  </p>

                  <div className="input-block">
                    <label>Day</label>
                    <select
                      value={invoiceGenerationDay}
                      onChange={(e) => setInvoiceGenerationDay(e.target.value)}
                    >
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </div>

                  <div className="input-block">
                    <label>Time</label>
                    <input
                      type="time"
                      value={invoiceGenerationTime}
                      onChange={(e) => setInvoiceGenerationTime(e.target.value)}
                    />
                  </div>
                </section>

                <section className="invoice-settings-section">
                  <h3>Send Review Reminder</h3>
                  <p>
                    Choose when Billio should notify you that invoices are ready to
                    review.
                  </p>

                  <div className="input-block">
                    <label>Day</label>
                    <select
                      value={invoiceReviewDay}
                      onChange={(e) => setInvoiceReviewDay(e.target.value)}
                    >
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </div>

                  <div className="input-block">
                    <label>Time</label>
                    <input
                      type="time"
                      value={invoiceReviewTime}
                      onChange={(e) => setInvoiceReviewTime(e.target.value)}
                    />
                  </div>
                </section>

                <section className="invoice-settings-section">
                  <h3>Timezone</h3>
                  <p>
                    Used for invoice automation timing.
                  </p>

                  <div className="input-block">
                    <label>Timezone</label>
                    <select
                      value={invoiceTimezone}
                      onChange={(e) => setInvoiceTimezone(e.target.value)}
                    >
                      <option value="America/Denver">Mountain Time</option>
                      <option value="America/Los_Angeles">Pacific Time</option>
                      <option value="America/Chicago">Central Time</option>
                      <option value="America/New_York">Eastern Time</option>
                    </select>
                  </div>
                </section>

                <button
                  type="submit"
                  className="invoice-settings-save-btn"
                  disabled={savingInvoiceSettings}
                >
                  {savingInvoiceSettings ? "Saving..." : "Save Settings"}
                </button>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}

export default Invoices;