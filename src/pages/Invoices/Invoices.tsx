import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  FaCog,
  FaLock,
  FaHistory
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { usePlan } from "../../hooks/usePlan";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import { useSettings } from "../../hooks/useSettings";
import { generateInvoicePdf } from "../../lib/generateInvoicePdf";
import "./Invoices.css"

function Invoices() {
  const navigate = useNavigate();
  const { isPro } = usePlan();
  const { coachId, userId, fullName, identityLoading } = useCoachIdentity();
  const { settings } = useSettings();
  const queryClient = useQueryClient();

  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [sendSuccessRecipient, setSendSuccessRecipient] = useState("");
  const [sendSuccessMethod, setSendSuccessMethod] = useState("");
  const [sendError, setSendError] = useState("");

  // Invoices Creation States
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentNameError, setStudentNameError] = useState("");
  const [invoiceLessons, setInvoiceLessons] = useState<any[]>([]);
  const [selectedLessonIds, setSelectedLessonIds] = useState<string[]>([]);
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [isClosingCalendar, setIsClosingCalendar] = useState(false);

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
  const [invoiceDetailView, setInvoiceDetailView] = useState<any>(null);
  const [invoiceDetailViewLessons, setInvoiceDetailViewLessons] = useState<any[]>([]);
  const [invoiceDetailViewLoading, setInvoiceDetailViewLoading] = useState(false);
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
  // Automatic invoices
  const [autoInvoiceEnabled, setAutoInvoiceEnabled] = useState(false);
  const [autoInvoiceFrequency, setAutoInvoiceFrequency] = useState("weekly");
  const [autoInvoiceDay, setAutoInvoiceDay] = useState("0");
  const [autoInvoiceDayOfMonth, setAutoInvoiceDayOfMonth] = useState("1");
  const [autoInvoiceTime, setAutoInvoiceTime] = useState("09:00");

  // Invoices Logs
  const [showSentLog, setShowSentLog] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logDeliveryFilter, setLogDeliveryFilter] = useState("all"); // all | email | text
  const [logStatusFilter, setLogStatusFilter] = useState("all");     // all | billed | paid | unbilled
  const [logSort, setLogSort] = useState("newest");                   // newest | oldest
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");

  // Loading
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  // Tutorial
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const addInvoiceBtnRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const [spotlightRect, setSpotlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // ── Cached data fetching ──────────────────────────────────────────────────

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`*, students(student_name, email, phone_number, parent_name, parent_phone), invoice_lessons(lessons(lesson_date))`)
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!coachId,
  });

  const { data: invoiceSettingsData } = useQuery({
    queryKey: ["invoice-settings", coachId],
    queryFn: async () => {
      const { data } = await supabase
        .from("coaches")
        .select(`invoice_generation_day, invoice_generation_time, invoice_review_day,
                 invoice_review_time, invoice_timezone, auto_invoice_enabled,
                 auto_invoice_frequency, auto_invoice_day, auto_invoice_day_of_month,
                 auto_invoice_time`)
        .eq("id", coachId)
        .single();
      return data;
    },
    enabled: !!coachId,
  });

  const invoices: any[] = invoicesData ?? [];

  useEffect(() => {
    if (!invoiceSettingsData) return;
    setInvoiceGenerationDay(String(invoiceSettingsData.invoice_generation_day ?? 0));
    setInvoiceGenerationTime(invoiceSettingsData.invoice_generation_time || "15:00");
    setInvoiceReviewDay(String(invoiceSettingsData.invoice_review_day ?? 0));
    setInvoiceReviewTime(invoiceSettingsData.invoice_review_time || "15:05");
    setInvoiceTimezone(invoiceSettingsData.invoice_timezone || "America/Denver");
    setAutoInvoiceEnabled(!!invoiceSettingsData.auto_invoice_enabled);
    setAutoInvoiceFrequency(invoiceSettingsData.auto_invoice_frequency || "weekly");
    setAutoInvoiceDay(String(invoiceSettingsData.auto_invoice_day ?? 0));
    setAutoInvoiceDayOfMonth(String(invoiceSettingsData.auto_invoice_day_of_month ?? 1));
    setAutoInvoiceTime((invoiceSettingsData.auto_invoice_time || "09:00").slice(0, 5));
  }, [invoiceSettingsData]);

  useEffect(() => {
    if (!coachId && !identityLoading) navigate("/login");
  }, [coachId, identityLoading]);

  const loading = identityLoading || invoicesLoading;

  useEffect(() => {
    if (coachId && selectedStudentId && rangeStart && rangeEnd) {
      loadInvoiceLessons();
    }
  }, [coachId, selectedStudentId, rangeStart, rangeEnd]);

  useEffect(() => {
    if (!loading) {
      const seen = localStorage.getItem("billio_invoices_tutorial_seen");
      if (!seen) {
        setTimeout(() => setShowTutorial(true), 500);
      }
    }
  }, [loading]);

  useEffect(() => {
    let target: HTMLButtonElement | null = null;

    if (showTutorial && tutorialStep === 1 && addInvoiceBtnRef.current) {
      target = addInvoiceBtnRef.current;
    }

    if (showTutorial && tutorialStep === 4 && settingsBtnRef.current) {
      target = settingsBtnRef.current;
    }

    if (target) {
      const rect = target.getBoundingClientRect();
      setSpotlightRect({
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      });
    } else {
      setSpotlightRect(null);
    }
  }, [showTutorial, tutorialStep]);

  function dismissTutorial() {
    localStorage.setItem("billio_invoices_tutorial_seen", "1");
    setShowTutorial(false);
    setTutorialStep(0);
    setSpotlightRect(null);
  }

  function advanceTutorial() {
    if (tutorialStep < 4) {
      setTutorialStep((prev) => prev + 1);
    } else {
      dismissTutorial();
    }
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
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatTime(time?: string | null) {
    if (!time) return "";

    const [hoursStr, minutesStr] = time.split(":");
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return time.slice(0, 5);

    if (settings.timeFormat === "24h") {
      return `${hoursStr.padStart(2, "0")}:${minutesStr.padStart(2, "0")}`;
    }

    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutesStr.padStart(2, "0")} ${period}`;
  }

  const filteredInvoices =
    selectedFilter === "all"
      ? invoices
      : invoices.filter((invoice) => invoice.status === selectedFilter);

  const now = new Date();

  function getInvoiceDate(invoice: any) {
    return (
      invoice.paid_at ||
      invoice.updated_at ||
      invoice.issue_date ||
      invoice.created_at
    );
  }

  function isCurrentMonth(dateValue: any) {
    if (!dateValue) return false;

    const d = new Date(dateValue);

    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth()
    );
  }

  const paidInvoicesThisMonth = invoices.filter((invoice) => {
    return (
      invoice.status === "paid" &&
      isCurrentMonth(getInvoiceDate(invoice))
    );
  });

  const paidThisMonth = paidInvoicesThisMonth.reduce(
    (total, invoice) => total + Number(invoice.total || 0),
    0
  );

  const draftInvoices = invoices.filter(
    (invoice) => (invoice.status || "unbilled") === "unbilled"
  );

  const pendingInvoices = invoices.filter(
    (invoice) => invoice.status === "billed"
  );

  const unpaidInvoices = invoices.filter(
    (invoice) =>
      invoice.status === "unbilled" ||
      invoice.status === "billed"
  );

  const unpaidTotal = unpaidInvoices.reduce(
    (total, invoice) => total + Number(invoice.total || 0),
    0
  );

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

    const isValidStudent = students.some(
      (link: any) => link.student_id === selectedStudentId
    );
    if (!isValidStudent) {
      setStudentNameError("Student name is not in the student list.");
      return;
    }
    setStudentNameError("");

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

      queryClient.setQueryData<any[]>(["invoices", coachId], (prev) => [invoiceData, ...(prev ?? [])]);

    } finally {
      setIsSaving(false);
    }

    
    setSelectedStudentId("");
    setStudentQuery("");
    setStudentNameError("");
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

  const studentMatches =
    studentQuery.trim().length > 0 && !selectedStudentId
      ? students.filter((link: any) =>
          link.students?.student_name
            ?.toLowerCase()
            .includes(studentQuery.trim().toLowerCase())
        )
      : [];

  function closeAddInvoice() {
    setShowAddInvoice(false);
    setSelectedStudentId("");
    setStudentQuery("");
    setStudentNameError("");
    setRangeStart("");
    setRangeEnd("");
    setInvoiceLessons([]);
    setSelectedLessonIds([]);
    setShowDateRangePicker(false);
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
      const lessons = (data?.map((row: any) => row.lessons) || []).sort(
        (a: any, b: any) =>
          a.lesson_date.localeCompare(b.lesson_date) ||
          (a.start_time || "").localeCompare(b.start_time || "")
      );

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

      queryClient.setQueryData<any[]>(["invoices", coachId], (prev) => (prev ?? []).filter((inv) => inv.id !== editingInvoice.id));

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

    queryClient.setQueryData<any[]>(["invoices", coachId], (prev) => (prev ?? []).map((inv) => inv.id === editingInvoice.id ? updatedInvoice : inv));

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

    queryClient.setQueryData<any[]>(["invoices", coachId], (prev) => (prev ?? []).filter((inv) => inv.id !== invoiceId));

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

  async function quickUpdateInvoiceStatus(invoice: any) {
    if (statusUpdatingId === invoice.id) return;
    const cycle: Record<string, string> = { unbilled: "billed", billed: "paid", paid: "unbilled" };
    const next = cycle[invoice.status || "unbilled"] || "unbilled";
    setStatusUpdatingId(invoice.id);
    const { data, error } = await supabase
      .from("invoices")
      .update({ status: next })
      .eq("id", invoice.id)
      .eq("coach_id", coachId)
      .select("*, students(student_name, email, phone_number, parent_name, parent_phone)")
      .single();
    if (!error && data) {
      queryClient.setQueryData<any[]>(["invoices", coachId], (prev) => (prev ?? []).map((inv) => inv.id === invoice.id ? data : inv));
      const { data: lessonLinks } = await supabase
        .from("invoice_lessons").select("lesson_id").eq("invoice_id", invoice.id);
      const lessonIds = (lessonLinks || []).map((l: any) => l.lesson_id);
      if (lessonIds.length > 0) {
        await supabase.from("lessons").update({ billing_status: next }).in("id", lessonIds);
      }
      queryClient.invalidateQueries({ queryKey: ["invoices", coachId] });
      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
    }
    setStatusUpdatingId(null);
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
  async function openInvoiceDetailView(invoice: any) {
    setInvoiceDetailView(invoice);
    setInvoiceDetailViewLoading(true);
    setInvoiceDetailViewLessons([]);

    const { data, error } = await supabase
      .from("invoice_lessons")
      .select("lessons(*)")
      .eq("invoice_id", invoice.id);

    if (!error && data) {
      const lessons = data
        .map((row: any) => row.lessons)
        .filter(Boolean)
        .sort((a: any, b: any) =>
          a.lesson_date.localeCompare(b.lesson_date) ||
          (a.start_time || "").localeCompare(b.start_time || "")
        );
      setInvoiceDetailViewLessons(lessons);
    }

    setInvoiceDetailViewLoading(false);
  }

  function getInvoiceWeekLabel(lessons: any[]) {
    const dates = lessons.map((l: any) => l.lesson_date).filter(Boolean).sort();
    if (dates.length === 0) return "";
    const date = new Date(`${dates[0]}T00:00:00`);
    const day = date.getDate();
    const year = date.getFullYear();
    const month = date.getMonth();

    let bucketStart: number;
    if (day <= 7) bucketStart = 1;
    else if (day <= 14) bucketStart = 8;
    else if (day <= 21) bucketStart = 15;
    else bucketStart = 22;

    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const bucketEnd = bucketStart === 22 ? lastDayOfMonth : bucketStart + 6;

    const start = new Date(year, month, bucketStart);
    const end = new Date(year, month, bucketEnd);

    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }

  const sentInvoices = invoices.filter((inv) => inv.sent_at);

  const filteredSentInvoices = sentInvoices
    .filter((inv) => {
      if (logSearch.trim()) {
        const q = logSearch.trim().toLowerCase();
        const name = (inv.students?.student_name || inv.student_name || "").toLowerCase();
        const number = (inv.invoice_number || "").toLowerCase();
        if (!name.includes(q) && !number.includes(q)) return false;
      }
      if (logDeliveryFilter !== "all") {
        const method = inv.delivery_method || "email";
        if (logDeliveryFilter === "email" && !(method === "email" || method === "both")) return false;
        if (logDeliveryFilter === "text" && !(method === "text" || method === "both")) return false;
      }
      if (logStatusFilter !== "all" && (inv.status || "unbilled") !== logStatusFilter) return false;

      const sentDay = (inv.sent_at || "").slice(0, 10);
      if (logStartDate && sentDay < logStartDate) return false;
      if (logEndDate && sentDay > logEndDate) return false;
      return true;
    })
    .sort((a, b) => {
      const da = a.sent_at || "";
      const db = b.sent_at || "";
      return logSort === "newest" ? db.localeCompare(da) : da.localeCompare(db);
    });

  function formatSentDate(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return (
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " · " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    );
  }

  function deliveryLabel(method: string) {
    if (method === "text") return "Text";
    if (method === "both") return "Email + Text";
    return "Email";
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

  async function maybeGenerateInvoicePdf(invoice: any): Promise<string | null> {
    if (!isPro || !coachId || !invoice.student_id) return null;

    const { data: link } = await supabase
      .from("coach_students")
      .select("invoice_delivery_method, auto_generate_pdf")
      .eq("coach_id", coachId)
      .eq("student_id", invoice.student_id)
      .maybeSingle();

    if (!link?.auto_generate_pdf) return null;
    // "auto" and "both" can both still resolve to an email being sent server-side -
    // only a pure "text" preference can never involve an email to attach this to.
    if (link.invoice_delivery_method === "text") return null;

    const { data: lessonRows, error: lessonsError } = await supabase
      .from("invoice_lessons")
      .select("lessons(lesson_date, start_time, duration_minutes, hourly_rate, rate)")
      .eq("invoice_id", invoice.id);

    if (lessonsError) {
      console.log("Load invoice lessons for PDF error:", lessonsError);
      return null;
    }

    const lessons = (lessonRows || [])
      .map((row: any) => row.lessons)
      .filter(Boolean)
      .sort((a: any, b: any) =>
        a.lesson_date.localeCompare(b.lesson_date) || (a.start_time || "").localeCompare(b.start_time || "")
      );

    const { data: brand } = await supabase
      .from("invoice_brand_settings")
      .select("business_name, accent_color, logo_url, footer_note")
      .eq("user_id", userId)
      .maybeSingle();

    const studentName = invoice.students?.student_name || invoice.student_name || "Student";

    const pdfBlob = await generateInvoicePdf({
      businessName: brand?.business_name || fullName || "Invoice",
      accentColor: brand?.accent_color || "#3b33d9",
      logoUrl: brand?.logo_url || undefined,
      footerNote: brand?.footer_note || undefined,
      studentName,
      invoiceNumber: invoice.invoice_number,
      issueDate: invoice.issue_date,
      dueDate: invoice.due_date,
      lessons,
      total: invoice.total,
    });

    const filePath = `${coachId}/${invoice.id}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("invoice-pdfs")
      .upload(filePath, pdfBlob, { contentType: "application/pdf", upsert: true });

    if (uploadError) {
      console.log("Invoice PDF upload error:", uploadError);
      return null;
    }

    const { error: invoiceUpdateError } = await supabase
      .from("invoices")
      .update({ pdf_path: filePath, pdf_generated_at: new Date().toISOString() })
      .eq("id", invoice.id);

    if (invoiceUpdateError) {
      console.log("Invoice pdf_path save error:", invoiceUpdateError);
      return null;
    }

    queryClient.invalidateQueries({ queryKey: ["invoices", coachId] });
    queryClient.invalidateQueries({ queryKey: ["auto-generated-pdf-invoices", coachId] });

    return filePath;
  }

  async function sendInvoice(invoice: any) {
    const invoiceId = invoice.id;
    if (sendingInvoiceId) return;

    setSendingInvoiceId(invoiceId);
    setSendError("");
    setSendSuccessRecipient("");

    let pdfPath: string | null = null;
    try {
      pdfPath = await maybeGenerateInvoicePdf(invoice);
    } catch (err) {
      console.log("Auto-generate PDF error:", err);
      // Never block sending the invoice on a PDF generation failure.
    }

    const { data, error } = await supabase.functions.invoke(
      "send-single-invoice",
      {
        body: { invoiceId, pdfPath },
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

    queryClient.setQueryData<any[]>(["invoices", coachId], (prev) => (prev ?? []).map((inv) =>
      inv.id === invoiceId
        ? { ...inv, status: "billed", sent_at: new Date().toISOString(), delivery_method: data.deliveryMethod || "email", recipient_email: data.recipientEmail }
        : inv
    ));

    queryClient.invalidateQueries({ queryKey: ["invoices", coachId] });
    queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });

    setSendSuccessRecipient(
      data.recipientPhone || data.recipientEmail || "recipient"
    );

    setSendSuccessMethod(data.deliveryMethod || "email");
  }

  function getMonthWeekBucket(dateStr: string) {
    const date = new Date(`${dateStr}T00:00:00`);
    const day = date.getDate();
    const year = date.getFullYear();
    const month = date.getMonth();

    let bucketStart: number;
    if (day <= 7) bucketStart = 1;
    else if (day <= 14) bucketStart = 8;
    else if (day <= 21) bucketStart = 15;
    else bucketStart = 22;

    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const bucketEnd = bucketStart === 22 ? lastDayOfMonth : bucketStart + 6;

    const start = new Date(year, month, bucketStart);
    const end = new Date(year, month, bucketEnd);

    return {
      monthLabel: start.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      weekKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(bucketStart).padStart(2, "0")}`,
      weekLabel: `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    };
  }

  const groupedPastInvoices = pastInvoices.reduce((groups: any, invoice: any) => {
    const lessonDates = (invoice.invoice_lessons || [])
      .map((il: any) => il.lessons?.lesson_date)
      .filter(Boolean)
      .sort();

    const firstDate = lessonDates[0];
    const anchorRaw = firstDate || invoice.period_start || invoice.issue_date || invoice.created_at;
    const anchorDate = (anchorRaw || "").slice(0, 10);

    const { monthLabel, weekKey, weekLabel } = getMonthWeekBucket(anchorDate);

    if (!groups[monthLabel]) groups[monthLabel] = {};
    if (!groups[monthLabel][weekKey]) {
      groups[monthLabel][weekKey] = { label: weekLabel, invoices: [] };
    }
    groups[monthLabel][weekKey].invoices.push(invoice);

    return groups;
  }, {});

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
        auto_invoice_enabled: autoInvoiceEnabled,
        auto_invoice_frequency: autoInvoiceFrequency,
        auto_invoice_day: Number(autoInvoiceDay),
        auto_invoice_day_of_month: Number(autoInvoiceDayOfMonth),
        auto_invoice_time: autoInvoiceTime,
      })
      .eq("id", coachId);

    setSavingInvoiceSettings(false);

    if (error) {
      console.log("Save invoice settings error:", error);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["invoice-settings", coachId] });
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
                        className="invoices-log-btn"
                        aria-disabled={showTutorial}
                        title="Sent invoice log"
                        onClick={(e) => {
                          if (showTutorial) { e.preventDefault(); return; }
                          setShowSentLog(true);
                        }}
                      >
                        <FaHistory />
                      </button>

                      <button
                        ref={settingsBtnRef}
                        type="button"
                        className={`invoices-settings-btn${showTutorial && tutorialStep === 4 ? " tutorial-highlighted" : ""}`}
                        aria-disabled={showTutorial}
                        onClick={(e) => {
                          if (showTutorial) {
                            e.preventDefault();
                            return;
                          }
                          setShowInvoiceSettings(true);
                        }}
                      >
                        <FaCog />
                      </button>

                      <button
                      ref={addInvoiceBtnRef}
                      type="button"
                      className={`invoices-add-btn${showTutorial && tutorialStep === 1 ? " tutorial-highlighted" : ""}`}
                      aria-disabled={showTutorial}
                      onClick={(e) => {
                        if (showTutorial) {
                          e.preventDefault();
                          return;
                        }
                        openAddInvoice();
                      }}
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
                <strong>{formatMoney(unpaidTotal)}</strong>
                <p>{pendingInvoices.length} invoices</p>
              </div>

              <div className="invoice-stat-card green-stat">
                <div className="invoice-stat-icon"><FaFileInvoiceDollar /></div>
                <span>Paid this month</span>
                <strong>{formatMoney(paidThisMonth)}</strong>
                <p>{paidInvoicesThisMonth.length} invoices</p>
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
              <section className="invoices-group">
                <div className="invoices-group-title">
                  <h2>Current Invoices</h2>
                  <span>
                    {currentInvoices.length}{" "}
                    {currentInvoices.length === 1 ? "invoice" : "invoices"}
                  </span>
                </div>

                {currentInvoices.length === 0 ? (
                  <p className="invoices-empty">No current invoices.</p>
                ) : (
                  <div className="invoices-group-card">
                    {currentInvoices.map((invoice) => (
                      <div key={invoice.id} className="invoices-row" style={{ cursor: "pointer" }} onClick={() => openInvoiceDetailView(invoice)}>
                        <div className="invoices-avatar">
                          {(invoice.students?.student_name || invoice.student_name) ? (invoice.students?.student_name || invoice.student_name).charAt(0).toUpperCase() : "I"}
                        </div>
                        <div className="invoices-info">
                          <strong>{invoice.invoice_number || "Invoice"}</strong>
                          <span>{invoice.students?.student_name || invoice.student_name || "Student"} • {formatMoney(invoice.total)}</span>
                          <button type="button"
                            className={`invoice-status-pill ${invoice.status || "unbilled"}`}
                            onClick={(e) => { e.stopPropagation(); quickUpdateInvoiceStatus(invoice); }}
                            disabled={statusUpdatingId === invoice.id}>
                            {statusUpdatingId === invoice.id ? "..." : (invoice.status || "unbilled").charAt(0).toUpperCase() + (invoice.status || "unbilled").slice(1)}
                          </button>
                        </div>
                        <div className="invoice-actions">
                          <button type="button" className="invoice-edit-btn"
                            onClick={(e) => { e.stopPropagation(); openEditInvoice(invoice); }}>
                            <FaEdit />
                          </button>
                          <button type="button" className="invoice-send-btn"
                            disabled={sendingInvoiceId === invoice.id}
                            onClick={(e) => { e.stopPropagation(); sendInvoice(invoice); }}>
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
                      <div key={invoice.id} className="invoices-row" style={{ cursor: "pointer" }} onClick={() => openInvoiceDetailView(invoice)}>
                        <div className="invoices-avatar" style={{ background: "#dbeafe", color: "#2563eb" }}>
                          {(invoice.students?.student_name || invoice.student_name) ? (invoice.students?.student_name || invoice.student_name).charAt(0).toUpperCase() : "I"}
                        </div>
                        <div className="invoices-info">
                          <strong>{invoice.invoice_number || "Invoice"}</strong>
                          <span>{invoice.students?.student_name || invoice.student_name || "Student"} • {formatMoney(invoice.total)}</span>
                          <span>
                            <button type="button"
                              className={`invoice-status-pill ${invoice.status || "unbilled"}`}
                              onClick={(e) => { e.stopPropagation(); quickUpdateInvoiceStatus(invoice); }}
                              disabled={statusUpdatingId === invoice.id}>
                              {statusUpdatingId === invoice.id ? "..." : (invoice.status || "unbilled").charAt(0).toUpperCase() + (invoice.status || "unbilled").slice(1)}
                            </button>
                            {invoice.due_date && (
                              <span style={{ fontSize: 11, marginLeft: 6, color: new Date(invoice.due_date + "T00:00:00") < new Date() ? "#ef4444" : "var(--secondary-text)" }}>
                                Due {formatDate(invoice.due_date)}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="invoice-actions">
                          <button type="button" className="invoice-edit-btn"
                            onClick={(e) => { e.stopPropagation(); openEditInvoice(invoice); }}>
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
                                        <div key={invoice.id} className="invoices-row past-invoice-row" style={{ cursor: "pointer" }} onClick={() => openInvoiceDetailView(invoice)}>
                                          <div className="invoices-avatar">
                                            {(invoice.students?.student_name || invoice.student_name) ? (invoice.students?.student_name || invoice.student_name).charAt(0).toUpperCase() : "I"}
                                          </div>
                                          <div className="invoices-info">
                                            <strong>{invoice.invoice_number || "Invoice"}</strong>
                                            <span>{invoice.students?.student_name || invoice.student_name || "Student"} • {formatMoney(invoice.total)}</span>
                                            <button type="button"
                                              className={`invoice-status-pill ${(invoice.status || "unbilled").trim().toLowerCase()}`}
                                              onClick={(e) => { e.stopPropagation(); quickUpdateInvoiceStatus(invoice); }}
                                              disabled={statusUpdatingId === invoice.id}>
                                              {statusUpdatingId === invoice.id ? "..." : (invoice.status || "unbilled").charAt(0).toUpperCase() + (invoice.status || "unbilled").slice(1)}
                                            </button>
                                          </div>
                                          <div className="invoice-actions">
                                            <button type="button" className="invoice-edit-btn"
                                              onClick={(e) => { e.stopPropagation(); openEditInvoice(invoice); }}>
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
              className="invoices-add-sheet"
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
                    value={studentQuery}
                    onChange={(e) => {
                      setStudentQuery(e.target.value);
                      setSelectedStudentId("");
                      setStudentNameError("");
                      setInvoiceLessons([]);
                      setSelectedLessonIds([]);
                    }}
                    placeholder="Type student name"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                  />

                  {studentMatches.length > 0 && (
                    <div className="student-suggestions invoice-student-dropdown">
                      {studentMatches.map((link: any) => (
                        <button
                          key={link.student_id}
                          type="button"
                          className="student-suggestion"
                          onClick={() => {
                            setStudentQuery(link.students.student_name);
                            setSelectedStudentId(link.student_id);
                            setStudentNameError("");
                            setInvoiceLessons([]);
                            setSelectedLessonIds([]);
                          }}
                        >
                          {link.students?.student_name}
                        </button>
                      ))}
                    </div>
                  )}

                  {studentNameError && (
                    <p className="invoice-student-error">{studentNameError}</p>
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
                            const billingStatus = lesson.billing_status || "unbilled";

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
                                    {formatDate(lesson.lesson_date)} • {lesson.duration_minutes} min
                                  </strong>

                                  <span>
                                    {formatTime(lesson.start_time)} •{" "}
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
                                {formatDate(lesson.lesson_date)} • {lesson.duration_minutes} min
                              </strong>

                              <span>
                                {formatTime(lesson.start_time)} •{" "}
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
        {invoiceDetailView && (
          <div
            className="invoices-add-overlay"
            style={{ zIndex: 400 }}
            onClick={() => setInvoiceDetailView(null)}
          >
            <div
              className="invoices-add-sheet"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="invoices-add-header">
                <div>
                  <h2>{invoiceDetailView.invoice_number || "Invoice"}</h2>
                  {!invoiceDetailViewLoading && invoiceDetailViewLessons.length > 0 && (
                    <span style={{ fontSize: 13, color: "var(--secondary-text)", fontWeight: 500 }}>
                      {getInvoiceWeekLabel(invoiceDetailViewLessons)}
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => setInvoiceDetailView(null)}>×</button>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 16px" }}>
                <button
                  type="button"
                  className={`invoice-status-pill ${invoiceDetailView.status || "unbilled"}`}
                  onClick={(e) => { e.stopPropagation(); quickUpdateInvoiceStatus(invoiceDetailView); setInvoiceDetailView(null); }}
                  disabled={statusUpdatingId === invoiceDetailView.id}
                >
                  {statusUpdatingId === invoiceDetailView.id ? "..." : (invoiceDetailView.status || "unbilled").charAt(0).toUpperCase() + (invoiceDetailView.status || "unbilled").slice(1)}
                </button>
                <strong style={{ marginLeft: "auto", fontSize: 16 }}>
                  {formatMoney(invoiceDetailView.total)}
                </strong>
              </div>

              {invoiceDetailViewLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                  <div className="billio-mini-spinner" />
                </div>
              ) : invoiceDetailViewLessons.length === 0 ? (
                <p className="invoices-empty" style={{ padding: "0 16px 24px" }}>No lessons attached to this invoice.</p>
              ) : (
                <div className="invoices-group-card" style={{ margin: "0 16px 24px" }}>
                  {invoiceDetailViewLessons.map((lesson: any) => (
                    <div key={lesson.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                      <div>
                        <strong style={{ fontSize: 14, display: "block" }}>{formatDate(lesson.lesson_date)}</strong>
                        <span style={{ fontSize: 13, color: "var(--secondary-text)" }}>{formatTime(lesson.start_time)} • {lesson.duration_minutes} min</span>
                      </div>
                      <strong style={{ fontSize: 14, whiteSpace: "nowrap" }}>{formatMoney(lesson.rate)}</strong>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, padding: "0 16px 16px" }}>
                <button
                  type="button"
                  className="invoices-save-btn"
                  style={{ flex: 1 }}
                  onClick={(e) => { e.stopPropagation(); setInvoiceDetailView(null); openEditInvoice(invoiceDetailView); }}
                >
                  Edit Invoice
                </button>
              </div>
            </div>
          </div>
        )}

        {showSentLog && (
          <div className="invoice-log-overlay" onClick={() => setShowSentLog(false)}>
            <div className="invoice-log-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="invoice-log-header">
                <div>
                  <h2>Sent Invoices History</h2>
                  <span>{filteredSentInvoices.length} of {sentInvoices.length} shown</span>
                </div>
                <button type="button" onClick={() => setShowSentLog(false)}>×</button>
              </div>

              <div className="invoice-log-filters">
                <input
                  type="text"
                  className="invoice-log-search"
                  placeholder="Search by student or invoice #"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                />

                <div className="invoice-log-segment">
                  {["all", "email", "text"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={logDeliveryFilter === opt ? "active" : ""}
                      onClick={() => setLogDeliveryFilter(opt)}
                    >
                      {opt === "all" ? "All" : opt === "email" ? "Email" : "Text"}
                    </button>
                  ))}
                </div>

                <div className="invoice-log-segment">
                  {["all", "billed", "paid", "unbilled"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={logStatusFilter === opt ? "active" : ""}
                      onClick={() => setLogStatusFilter(opt)}
                    >
                      {opt === "all" ? "All" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="invoice-log-dates">
                  <div className="input-block">
                    <label>From</label>
                    <input type="date" value={logStartDate} onChange={(e) => setLogStartDate(e.target.value)} />
                  </div>
                  <div className="input-block">
                    <label>To</label>
                    <input type="date" value={logEndDate} onChange={(e) => setLogEndDate(e.target.value)} />
                  </div>
                </div>

                <div className="invoice-log-toolbar">
                  <button
                    type="button"
                    className="invoice-log-sort"
                    onClick={() => setLogSort((s) => (s === "newest" ? "oldest" : "newest"))}
                  >
                    {logSort === "newest" ? "Newest first" : "Oldest first"}
                  </button>
                  {(logSearch || logDeliveryFilter !== "all" || logStatusFilter !== "all" || logStartDate || logEndDate) && (
                    <button
                      type="button"
                      className="invoice-log-clear"
                      onClick={() => {
                        setLogSearch(""); setLogDeliveryFilter("all");
                        setLogStatusFilter("all"); setLogStartDate(""); setLogEndDate("");
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              </div>

              {filteredSentInvoices.length === 0 ? (
                <p className="invoices-empty">No sent invoices match your filters.</p>
              ) : (
                <div className="invoices-group-card invoice-log-list">
                  {filteredSentInvoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="invoices-row"
                      style={{ cursor: "pointer" }}
                      onClick={() => { setShowSentLog(false); openInvoiceDetailView(invoice); }}
                    >
                      <div className="invoices-avatar" style={{ background: "#dbeafe", color: "#2563eb" }}>
                        {(invoice.students?.student_name || invoice.student_name) ? (invoice.students?.student_name || invoice.student_name).charAt(0).toUpperCase() : "I"}
                      </div>
                      <div className="invoices-info">
                        <strong>{invoice.invoice_number || "Invoice"}</strong>
                        <span>{invoice.students?.student_name || invoice.student_name || "Student"} • {formatMoney(invoice.total)}</span>
                        <span className="invoice-log-meta">
                          <span className={`invoice-log-method ${invoice.delivery_method || "email"}`}>
                            {deliveryLabel(invoice.delivery_method || "email")}
                          </span>
                          <span className="invoice-log-sent">Sent {formatSentDate(invoice.sent_at)}</span>
                        </span>
                      </div>
                      <span
                        className={`invoice-status-pill ${invoice.status || "unbilled"}`}
                        style={{ pointerEvents: "none" }}
                      >
                        {(invoice.status || "unbilled").charAt(0).toUpperCase() + (invoice.status || "unbilled").slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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

              {!isPro && (
                <div className="invoice-pro-overlay">
                  <div className="invoice-pro-overlay-card">
                    <div className="invoice-pro-overlay-icon">
                      <FaLock />
                    </div>
                    <strong>Pro Feature</strong>
                    <p>Invoice automation is available for Pro users only.</p>
                    <button
                      type="button"
                      className="invoice-pro-overlay-btn"
                      onClick={() => navigate("/upgrade")}
                    >
                      Upgrade to Pro
                    </button>
                  </div>
                </div>
              )}

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
                  <h3>Automatic Invoices</h3>
                  <p>
                    Automatically send all unbilled invoices to your students on a
                    schedule. You'll receive a summary of what was sent and anything
                    that failed due to missing student info.
                  </p>

                  <div className="input-block">
                    <label>Automatic sending</label>
                    <select
                      value={autoInvoiceEnabled ? "yes" : "no"}
                      onChange={(e) => setAutoInvoiceEnabled(e.target.value === "yes")}
                    >
                      <option value="no">Off</option>
                      <option value="yes">On</option>
                    </select>
                  </div>

                  {autoInvoiceEnabled && (
                    <>
                      <div className="input-block">
                        <label>Frequency</label>
                        <select
                          value={autoInvoiceFrequency}
                          onChange={(e) => setAutoInvoiceFrequency(e.target.value)}
                        >
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Bi-weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>

                      {autoInvoiceFrequency === "weekly" ? (
                        <div className="input-block">
                          <label>Day</label>
                          <select
                            value={autoInvoiceDay}
                            onChange={(e) => setAutoInvoiceDay(e.target.value)}
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
                      ) : (
                        <div className="input-block">
                          <label>
                            Day of month
                            {autoInvoiceFrequency === "biweekly" ? " (repeats 14 days later)" : ""}
                          </label>
                          <select
                            value={autoInvoiceDayOfMonth}
                            onChange={(e) => setAutoInvoiceDayOfMonth(e.target.value)}
                          >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                              <option key={d} value={String(d)}>{d}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="input-block">
                        <label>Time</label>
                        <input
                          type="time"
                          value={autoInvoiceTime}
                          onChange={(e) => setAutoInvoiceTime(e.target.value)}
                        />
                      </div>
                    </>
                  )}
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
                      <optgroup label="Americas">
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/New_York">Eastern Time</option>
                      </optgroup>
                      <optgroup label="Europe">
                        <option value="Europe/London">London (GMT/BST)</option>
                        <option value="Europe/Lisbon">Lisbon (WET/WEST)</option>
                        <option value="Europe/Paris">Paris, Berlin, Madrid, Rome (CET/CEST)</option>
                        <option value="Europe/Athens">Athens, Helsinki, Bucharest (EET/EEST)</option>
                        <option value="Europe/Istanbul">Istanbul (TRT)</option>
                        <option value="Europe/Moscow">Moscow (MSK)</option>
                      </optgroup>
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

        {showTutorial && (
          <>
            <div
              className="tutorial-overlay"
              style={spotlightRect ? { background: "transparent" } : undefined}
            />

            {spotlightRect && (
              <div
                className="tutorial-spotlight"
                style={{
                  top: spotlightRect.top,
                  left: spotlightRect.left,
                  width: spotlightRect.width,
                  height: spotlightRect.height,
                }}
              />
            )}

            <div className="tutorial-card">
              {tutorialStep === 0 && (
                <>
                  <div className="tutorial-icon-wrap">🧾</div>
                  <h2 className="tutorial-title">Welcome to Invoices</h2>
                  <p className="tutorial-text">
                    This page helps you turn completed lessons into invoices, track what is unbilled, see what has already been sent, and keep paid invoices organized.
                  </p>
                  <div className="tutorial-dots">
                    {[0, 1, 2, 3, 4].map((step) => (
                      <span key={step} className={`tutorial-dot${tutorialStep === step ? " tutorial-dot-active" : ""}`} />
                    ))}
                  </div>
                  <button className="tutorial-btn-primary" onClick={advanceTutorial}>
                    Show me around →
                  </button>
                  <button className="tutorial-btn-skip" onClick={dismissTutorial}>
                    Skip tutorial
                  </button>
                </>
              )}

              {tutorialStep === 1 && (
                <>
                  <div className="tutorial-arrow-label">
                    <span className="tutorial-arrow-up">↗</span>
                    <span>Preview only — not clickable during tutorial</span>
                  </div>
                  <h2 className="tutorial-title">Create Invoices</h2>
                  <p className="tutorial-text">
                    The <strong>+ button</strong> lets you manually create an invoice by choosing a student, selecting a date range, and picking the lessons you want to include.
                  </p>
                  <div className="tutorial-dots">
                    {[0, 1, 2, 3, 4].map((step) => (
                      <span key={step} className={`tutorial-dot${tutorialStep === step ? " tutorial-dot-active" : ""}`} />
                    ))}
                  </div>
                  <button className="tutorial-btn-primary" onClick={advanceTutorial}>
                    Next
                  </button>
                  <button className="tutorial-btn-skip" onClick={dismissTutorial}>
                    Skip tutorial
                  </button>
                </>
              )}

              {tutorialStep === 2 && (
                <>
                  <div className="tutorial-icon-wrap">📊</div>
                  <h2 className="tutorial-title">Invoice Overview</h2>
                  <p className="tutorial-text">
                    The cards at the top summarize your billing: unpaid totals, paid invoices this month, unbilled invoices, and invoices that have already been billed.
                  </p>
                  <div className="tutorial-dots">
                    {[0, 1, 2, 3, 4].map((step) => (
                      <span key={step} className={`tutorial-dot${tutorialStep === step ? " tutorial-dot-active" : ""}`} />
                    ))}
                  </div>
                  <button className="tutorial-btn-primary" onClick={advanceTutorial}>
                    Next
                  </button>
                  <button className="tutorial-btn-skip" onClick={dismissTutorial}>
                    Skip tutorial
                  </button>
                </>
              )}

              {tutorialStep === 3 && (
                <>
                  <div className="tutorial-icon-wrap">✅</div>
                  <h2 className="tutorial-title">Track Invoice Status</h2>
                  <p className="tutorial-text">
                    Invoices are grouped into current, billed, and past invoices. You can update status, edit invoice details, and send invoices from this page.
                  </p>
                  <ul className="tutorial-list">
                    <li><strong>Unbilled</strong> means the invoice is still being prepared.</li>
                    <li><strong>Billed</strong> means it has been sent or is waiting for payment.</li>
                    <li><strong>Paid</strong> moves it into your past invoice history.</li>
                  </ul>
                  <div className="tutorial-dots">
                    {[0, 1, 2, 3, 4].map((step) => (
                      <span key={step} className={`tutorial-dot${tutorialStep === step ? " tutorial-dot-active" : ""}`} />
                    ))}
                  </div>
                  <button className="tutorial-btn-primary" onClick={advanceTutorial}>
                    Next
                  </button>
                  <button className="tutorial-btn-skip" onClick={dismissTutorial}>
                    Skip tutorial
                  </button>
                </>
              )}

              {tutorialStep === 4 && (
                <>
                  <div className="tutorial-arrow-label">
                    <span className="tutorial-arrow-up">↗</span>
                    <span>Preview only — not clickable during tutorial</span>
                  </div>
                  <h2 className="tutorial-title">Invoice Settings</h2>
                  <p className="tutorial-text">
                    The <strong>⚙️ Settings icon</strong> is where invoice automation lives. Free users can still view the page, while automation controls are available for Pro users.
                  </p>
                  <ul className="tutorial-list">
                    <li>Auto-generate invoices on a schedule</li>
                    <li>Get reminders before sending</li>
                    <li>Enable automatic invoice delivery</li>
                  </ul>
                  <div className="tutorial-dots">
                    {[0, 1, 2, 3, 4].map((step) => (
                      <span key={step} className={`tutorial-dot${tutorialStep === step ? " tutorial-dot-active" : ""}`} />
                    ))}
                  </div>
                  <button className="tutorial-btn-primary" onClick={advanceTutorial}>
                    Finish
                  </button>
                  <button className="tutorial-btn-skip" onClick={dismissTutorial}>
                    Close
                  </button>
                </>
              )}
            </div>
          </>
        )}
    </div>
  );
}

export default Invoices;