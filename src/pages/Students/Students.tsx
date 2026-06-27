import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaPlus,
  FaEdit,
  FaFilter,
  FaLock,
  FaSearch,
  FaSortAmountDown,
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { usePlan } from "../../hooks/usePlan";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import { useLessonTerm } from "../../hooks/useLessonTerm";
import "./Students.css"

function Students() {
  const navigate = useNavigate();
  const { isPro } = usePlan();
  const { coachId, identityLoading } = useCoachIdentity();
  const term = useLessonTerm();
  const queryClient = useQueryClient();

  const [students, setStudents] = useState<any[]>([]);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);

  // Students list search/sort
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSort, setStudentSort] = useState<"name_asc" | "name_desc" | "date_new" | "date_old">("name_asc");
  const [showStudentSortMenu, setShowStudentSortMenu] = useState(false);

//   Add Student Block
  const [studentName, setStudentName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [studentToDelete, setStudentToDelete] = useState<any>(null);
  const [smsConsent, setSmsConsent] = useState(false);

  // Student - lessons+invoices popup
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentLessons, setStudentLessons] = useState<any[]>([]);
  const [studentInvoices, setStudentInvoices] = useState<any[]>([]);

  // Edit lessons
  const [selectedLessonActionId, setSelectedLessonActionId] = useState<string | null>(null);
  const [showEditLesson, setShowEditLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [lessonDate, setLessonDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [lessonType, setLessonType] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [lessonNotes, setLessonNotes] = useState("");
  const [rateOptions, setRateOptions] = useState<any[]>([]);
  const visibleRates = rateOptions.slice(0, 3);
  const hiddenRates = rateOptions.slice(3);
  const [showRateSheet, setShowRateSheet] = useState(false);

  const [invoiceContactTarget, setInvoiceContactTarget] = useState("auto");
  const [invoiceDeliveryMethod, setInvoiceDeliveryMethod] = useState("auto");
  const [autoGeneratePdf, setAutoGeneratePdf] = useState(false);

  // Loading
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [showStudentLimitModal, setShowStudentLimitModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Tutorial
  const [showStudentsTutorial, setShowStudentsTutorial] = useState(false);
  const [studentsTutorialStep, setStudentsTutorialStep] = useState(0);
  const addStudentBtnRef = useRef<HTMLButtonElement>(null);
  const [studentsSpotlightRect, setStudentsSpotlightRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // Lesson filter states
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRange, setFilterRange] = useState<string>("all");
  const [filterSort, setFilterSort] = useState<string>("newest");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  // Invoice filter states
  const [invoiceFilterStatus, setInvoiceFilterStatus] = useState<string>("all");
  const [invoiceFilterSort, setInvoiceFilterSort] = useState<string>("newest");
  const [showInvoiceFilterSheet, setShowInvoiceFilterSheet] = useState(false);

  // Invoice detail popup
  const [selectedStudentInvoice, setSelectedStudentInvoice] = useState<any>(null);
  const [invoiceDetailLessons, setInvoiceDetailLessons] = useState<any[]>([]);
  const [invoiceDetailLoading, setInvoiceDetailLoading] = useState(false);

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ["students", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_students")
        .select(`student_id, invoice_contact_target, invoice_delivery_method, auto_generate_pdf,
          students(id, student_name, email, phone_number, parent_name, parent_email,
                   parent_phone, active, notes, created_at, sms_consent)`)
        .eq("coach_id", coachId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!coachId,
  });

  useEffect(() => { if (studentsData) setStudents(studentsData); }, [studentsData]);
  useEffect(() => { if (!coachId && !identityLoading) navigate("/login"); }, [coachId, identityLoading]);

  const loading = identityLoading || studentsLoading;

  useEffect(() => {
    if (!loading) {
      const seen = localStorage.getItem("billio_students_tutorial_seen");

      if (!seen) {
        setTimeout(() => setShowStudentsTutorial(true), 500);
      }
    }
  }, [loading]);

  useEffect(() => {
    function updateStudentsSpotlight() {
      if (
        showStudentsTutorial &&
        studentsTutorialStep === 1 &&
        addStudentBtnRef.current
      ) {
        const rect = addStudentBtnRef.current.getBoundingClientRect();

        setStudentsSpotlightRect({
          top: rect.top - 9,
          left: rect.left - 9,
          width: rect.width + 18,
          height: rect.height + 18,
        });
      } else {
        setStudentsSpotlightRect(null);
      }
    }

    updateStudentsSpotlight();

    window.addEventListener("resize", updateStudentsSpotlight);
    window.addEventListener("scroll", updateStudentsSpotlight, true);

    return () => {
      window.removeEventListener("resize", updateStudentsSpotlight);
      window.removeEventListener("scroll", updateStudentsSpotlight, true);
    };
  }, [showStudentsTutorial, studentsTutorialStep]);

  function dismissStudentsTutorial() {
    localStorage.setItem("billio_students_tutorial_seen", "1");
    setShowStudentsTutorial(false);
    setStudentsTutorialStep(0);
    setStudentsSpotlightRect(null);
  }

  function advanceStudentsTutorial() {
    if (studentsTutorialStep < 3) {
      setStudentsTutorialStep((prev) => prev + 1);
    } else {
      dismissStudentsTutorial();
    }
  }

  async function handleCreateStudent(e: any) {
    e.preventDefault();

    if (isSaving) return; 
    setIsSaving(true);

    try {

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
          active,
          notes: notes || null,
          sms_consent: smsConsent,
        })
        .select()
        .single();

      if (studentError) {
        alert("Error saving student: " + studentError.message);
        return;
      }

      const { error: linkError } = await supabase
        .from("coach_students")
        .insert({
          coach_id: coachId,
          student_id: newStudent.id,
          invoice_contact_target: invoiceContactTarget,
          invoice_delivery_method: invoiceDeliveryMethod,
          auto_generate_pdf: isPro && (invoiceDeliveryMethod === "email" || invoiceDeliveryMethod === "both") ? autoGeneratePdf : false,
        });

      if (linkError) {
        alert("Error linking student: " + linkError.message);
        return;
      }

      setStudents((prev) => [
        ...prev,
        {
          student_id: newStudent.id,
          invoice_contact_target: invoiceContactTarget,
          invoice_delivery_method: invoiceDeliveryMethod,
          auto_generate_pdf: isPro && (invoiceDeliveryMethod === "email" || invoiceDeliveryMethod === "both") ? autoGeneratePdf : false,
          students: newStudent,
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ["students", coachId] });

    } finally {
      setIsSaving(false)
    }

    resetStudentForm();
    setShowAddStudent(false);
  }

  function openEditStudent(link: any) {
    const student = link.students;

    setEditingStudent(student);

    setStudentName(student?.student_name || "");
    setEmail(student?.email || "");
    setPhoneNumber(student?.phone_number || "");
    setParentName(student?.parent_name || "");
    setParentEmail(student?.parent_email || "");
    setParentPhone(student?.parent_phone || "");
    setActive(student?.active ?? true);
    setNotes(student?.notes || "");
    setInvoiceContactTarget(link.invoice_contact_target || "auto");
    setInvoiceDeliveryMethod(link.invoice_delivery_method || "auto");
    setAutoGeneratePdf(link.auto_generate_pdf || false);
    setSmsConsent(link.students?.sms_consent || false);

    setShowEditStudent(true);
  }

  function closeEditStudent() {
    setShowEditStudent(false);
    resetStudentForm();
  }

  function openEditLesson(lesson: any) {
    setEditingLesson(lesson);

    setLessonDate(lesson.lesson_date || "");
    setStartTime(lesson.start_time?.slice(0, 5) || "");
    setDurationMinutes(String(lesson.duration_minutes || "30"));
    setLessonType(lesson.lesson_type || "");
    setHourlyRate(String(lesson.hourly_rate || ""));
    setLessonNotes(lesson.notes || "");

    if (coachId) {
      loadRateOptions(coachId);
    }

    setShowEditLesson(true);
    setSelectedLessonActionId(null);
  }

  async function loadRateOptions(coachId: string) {
    const { data, error } = await supabase
      .from("coaches")
      .select("default_hourly_rate, custom_rates")
      .eq("id", coachId)
      .single();

    if (error || !data) {
      console.log("Rate load error:", error);
      return;
    }

    const options = [];

    if (data.default_hourly_rate) {
      options.push({
        name: "Default",
        amount: Number(data.default_hourly_rate),
      });
    }

    if (Array.isArray(data.custom_rates)) {
      options.push(...data.custom_rates);
    }

    setRateOptions(options);
  }

  function resetStudentForm() {
    setStudentName("");
    setEmail("");
    setPhoneNumber("");
    setParentName("");
    setParentPhone("");
    setParentEmail("");
    setActive(true);
    setNotes("");
    setEditingStudent(null);
    setInvoiceContactTarget("auto");
    setInvoiceDeliveryMethod("auto");
    setAutoGeneratePdf(false);
    setSmsConsent(false);
  }

  function closeAddStudent() {
    setShowAddStudent(false);
    resetStudentForm();
  }

  function closeEditLesson() {
    setShowEditLesson(false);
    resetStudentForm();
  }

  async function handleUpdateLesson(e: any) {
    e.preventDefault();

    if (isSaving) return; 
    setIsSaving(true);

    try {

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
          notes: lessonNotes || null,
        })
        .eq("id", editingLesson.id)
        .eq("coach_id", coachId)
        .select()
        .single();

      if (error) {
        alert("Error saving lesson: " + error.message);
        return;
      }

      setStudentLessons((prev) =>
        prev.map((lesson) =>
          lesson.id === editingLesson.id ? data : lesson
        )
      );

    } finally {
      setIsSaving (false);
    }

    closeEditLesson();
  }

  async function handleDeleteStudentLesson(lessonId: string) {

    if (isDeleting) return; 
    setIsDeleting(true);

    try {

      const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lessonId)
      .eq("coach_id", coachId);

      if (error) {
        console.log("Delete student lesson error:", error);
        return;
      }

      setStudentLessons((prev) =>
        prev.filter((lesson) => lesson.id !== lessonId)
      );

    } finally {
      setIsDeleting(false);
    }

    setSelectedLessonActionId(null);
  }

  async function handleUpdateStudent(e: any) {
    e.preventDefault();

    if (isSaving) return; 
    setIsSaving(true);

    try {

      if (!coachId || !editingStudent) return;

      const cleanStudentName = studentName.trim();

      if (!cleanStudentName) {
        alert("Please enter a student name.");
        return;
      }

      const existingStudent = students.find(
        (link: any) =>
          link.student_id !== editingStudent.id &&
          link.students?.student_name?.trim().toLowerCase() ===
            cleanStudentName.toLowerCase()
      );

      if (existingStudent) {
        alert("This student already exists.");
        return;
      }

      const { data: updatedStudent, error: studentError } = await supabase
        .from("students")
        .update({
          student_name: cleanStudentName,
          email: email || null,
          phone_number: phoneNumber || null,
          parent_name: parentName || null,
          parent_email: parentEmail || null,
          parent_phone: parentPhone || null,
          active,
          notes: notes || null,
          sms_consent: smsConsent,
        })
        .eq("id", editingStudent.id)
        .select()
        .single();

      if (studentError) {
        alert("Error saving student: " + studentError.message);
        return;
      }

      const { error: linkError } = await supabase
        .from("coach_students")
        .update({
          invoice_contact_target: invoiceContactTarget,
          invoice_delivery_method: invoiceDeliveryMethod,
          auto_generate_pdf: isPro && (invoiceDeliveryMethod === "email" || invoiceDeliveryMethod === "both") ? autoGeneratePdf : false,
        })
        .eq("coach_id", coachId)
        .eq("student_id", editingStudent.id);

      if (linkError) {
        alert("Error saving preferences: " + linkError.message);
        return;
      }

      setStudents((prev) =>
        prev.map((link: any) =>
          link.student_id === editingStudent.id
            ? {
                ...link,
                invoice_contact_target: invoiceContactTarget,
                invoice_delivery_method: invoiceDeliveryMethod,
                auto_generate_pdf: isPro && (invoiceDeliveryMethod === "email" || invoiceDeliveryMethod === "both") ? autoGeneratePdf : false,
                students: updatedStudent,
              }
            : link
        )
      );
      queryClient.invalidateQueries({ queryKey: ["students", coachId] });

    } finally {
      setIsSaving(false);
    }

    closeEditStudent();
  }

  async function openStudentDetails(link: any) {
    setFilterStatus("all");
    setFilterRange("all");
    setFilterSort("newest");
    setFilterDateFrom("");
    setFilterDateTo("");
    setInvoiceFilterStatus("all");
    setInvoiceFilterSort("newest");

    const student = link.students;
    setSelectedStudent(student);
    setDetailLoading(true);
    setStudentLessons([]);
    setStudentInvoices([]);

    if (!coachId || !student?.id) {
      setDetailLoading(false);
      return;
    }

    const [lessonsResult, invoicesResult] = await Promise.all([
      supabase.from("lessons").select("*")
        .eq("coach_id", coachId).eq("student_id", student.id)
        .order("lesson_date", { ascending: false })
        .order("start_time", { ascending: false }),
      supabase.from("invoices").select("*, invoice_lessons(lessons(lesson_date))")
        .eq("coach_id", coachId).eq("student_id", student.id)
        .order("created_at", { ascending: false }),
    ]);

    if (lessonsResult.error) console.log("Student lessons error:", lessonsResult.error);
    else setStudentLessons(lessonsResult.data || []);

    if (invoicesResult.error) console.log("Student invoices error:", invoicesResult.error);
    else setStudentInvoices(invoicesResult.data || []);

    setDetailLoading(false);
  }

  async function openInvoiceDetail(invoice: any) {
    setSelectedStudentInvoice(invoice);
    setInvoiceDetailLoading(true);
    setInvoiceDetailLessons([]);

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
      setInvoiceDetailLessons(lessons);
    }

    setInvoiceDetailLoading(false);
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

  function formatUSPhoneInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);

    if (digits.length <= 3) return digits;
    if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  const activeStudents = students.filter(
    (link: any) => link.students?.active !== false
  );

  const archivedStudents = students.filter(
    (link: any) => link.students?.active === false
  );

  function filterAndSortStudents(list: any[]) {
    const query = studentSearch.trim().toLowerCase();
    const filtered = query
      ? list.filter((link: any) =>
          (link.students?.student_name || "").toLowerCase().includes(query)
        )
      : list;

    return [...filtered].sort((a: any, b: any) => {
      if (studentSort === "name_asc" || studentSort === "name_desc") {
        const nameA = (a.students?.student_name || "").toLowerCase();
        const nameB = (b.students?.student_name || "").toLowerCase();
        return studentSort === "name_asc"
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }

      const dateA = new Date(a.students?.created_at || 0).getTime();
      const dateB = new Date(b.students?.created_at || 0).getTime();
      return studentSort === "date_new" ? dateB - dateA : dateA - dateB;
    });
  }

  const visibleActiveStudents = filterAndSortStudents(activeStudents);
  const visibleArchivedStudents = filterAndSortStudents(archivedStudents);

  const studentSortLabels: Record<typeof studentSort, string> = {
    name_asc: "Name (A-Z)",
    name_desc: "Name (Z-A)",
    date_new: "Date added (newest)",
    date_old: "Date added (oldest)",
  };

  async function handleArchiveStudent(studentId: string) {

    if (isMoving) return; 
    setIsMoving(true);

    try {

      const { data, error } = await supabase
      .from("students")
      .update({ active: false })
      .eq("id", studentId)
      .select()
      .single();

      if (error) {
        console.log("Archive student error:", error);
        return;
      }

      setStudents((prev) =>
        prev.map((link: any) =>
          link.student_id === studentId
            ? { ...link, students: data }
            : link
        )
      );
      queryClient.invalidateQueries({ queryKey: ["students", coachId] });

    } finally {
      setIsMoving(false);
    }

    closeEditStudent();
  }

  async function handleRestoreStudent(studentId: string) {

    if (!isPro && activeStudents.length >= 5) {
      setShowStudentLimitModal(true);
      closeEditStudent();
      return;
    }

    if (isMoving) return;
    setIsMoving(true);

    try {

      const { data, error } = await supabase
      .from("students")
      .update({ active: true })
      .eq("id", studentId)
      .select()
      .single();

      if (error) {
        console.log("Restore student error:", error);
        return;
      }

      setStudents((prev) =>
        prev.map((link: any) =>
          link.student_id === studentId
            ? { ...link, students: data }
            : link
        )
      );
      queryClient.invalidateQueries({ queryKey: ["students", coachId] });

    } finally {
      setIsMoving(false);
    }

    closeEditStudent();
  }

  async function handlePermanentDeleteStudent(studentId: string, studentName: string) {

    if (!coachId) return;

    if (isDeleting) return;
    setIsDeleting(true);

    try {

      // Snapshot the name onto their existing lessons/invoices before the
      // students row is gone, so historical records stay readable without
      // needing to keep a "ghost" student row alive just for the join.
      const { error: lessonsNameError } = await supabase
        .from("lessons")
        .update({ student_name: studentName })
        .eq("coach_id", coachId)
        .eq("student_id", studentId);

      if (lessonsNameError) {
        console.log("Snapshot student name onto lessons error:", lessonsNameError);
        return;
      }

      const { error: invoicesNameError } = await supabase
        .from("invoices")
        .update({ student_name: studentName })
        .eq("coach_id", coachId)
        .eq("student_id", studentId);

      if (invoicesNameError) {
        console.log("Snapshot student name onto invoices error:", invoicesNameError);
        return;
      }

      const { error: linkError } = await supabase
        .from("coach_students")
        .delete()
        .eq("coach_id", coachId)
        .eq("student_id", studentId);

      if (linkError) {
        console.log("Delete coach student link error:", linkError);
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
      queryClient.invalidateQueries({ queryKey: ["students", coachId] });
      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
      queryClient.invalidateQueries({ queryKey: ["invoices", coachId] });
      queryClient.invalidateQueries({ queryKey: ["coach-students", coachId] });

    } finally {
      setIsDeleting(false);
    }

    closeEditStudent();
  }

  // Filtered and sorted lessons
  const filteredStudentLessons = studentLessons
    .filter((lesson) => {
      if (filterStatus !== "all" && lesson.billing_status !== filterStatus) return false;
      const lessonDate = new Date(lesson.lesson_date + "T00:00:00");
      const now = new Date();
      if (filterRange === "30days") {
        const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (lessonDate < cutoff) return false;
      } else if (filterRange === "90days") {
        const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        if (lessonDate < cutoff) return false;
      } else if (filterRange === "year") {
        if (lessonDate.getFullYear() !== now.getFullYear()) return false;
      } else if (filterRange === "custom") {
        if (filterDateFrom && lesson.lesson_date < filterDateFrom) return false;
        if (filterDateTo && lesson.lesson_date > filterDateTo) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.lesson_date}T${a.start_time || "00:00"}`).getTime();
      const dateB = new Date(`${b.lesson_date}T${b.start_time || "00:00"}`).getTime();
      return filterSort === "newest" ? dateB - dateA : dateA - dateB;
    });

  const activeFilterCount = [
    filterStatus !== "all",
    filterRange !== "all",
  ].filter(Boolean).length;

  // Filtered and sorted invoices
  const filteredStudentInvoices = studentInvoices
    .filter((invoice) => {
      if (invoiceFilterStatus !== "all" && invoice.status !== invoiceFilterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return invoiceFilterSort === "newest" ? dateB - dateA : dateA - dateB;
    });

  const activeInvoiceFilterCount = [invoiceFilterStatus !== "all"].filter(Boolean).length;

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
                ref={addStudentBtnRef}
                type="button"
                aria-disabled={showStudentsTutorial}
                className={`students-add-btn${!isPro && activeStudents.length >= 5 ? " students-add-btn-dimmed" : ""}${showStudentsTutorial && studentsTutorialStep === 1 ? " students-tutorial-highlighted" : ""}`}
                onClick={() => {
                  if (showStudentsTutorial) return;

                  if (!isPro && activeStudents.length >= 5) {
                    setShowStudentLimitModal(true);
                  } else {
                    setShowAddStudent(true);
                  }
                }}
              >
                <FaPlus />
              </button>
            </div>
          </div>

          {!isPro && (
            <div className="student-limit-bar">
              <div className="student-limit-bar-header">
                <span>Free Plan</span>
                <span>{activeStudents.length} / 5 students</span>
              </div>
              <div className="student-limit-progress-track">
                <div
                  className={`student-limit-progress-fill${activeStudents.length > 5 ? " student-limit-progress-over" : ""}`}
                  style={{ width: `${Math.min((activeStudents.length / 5) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="students-search-bar">
            <div className="students-search-input">
              <FaSearch />
              <input
                type="text"
                placeholder="Search students by name"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>

            <div className="students-sort-wrapper">
              <button
                type="button"
                className="students-sort-btn"
                onClick={() => setShowStudentSortMenu((prev) => !prev)}
              >
                <FaSortAmountDown />
              </button>

              {showStudentSortMenu && (
                <>
                  <div
                    className="students-sort-backdrop"
                    onClick={() => setShowStudentSortMenu(false)}
                  />
                  <div className="students-sort-menu">
                    {(Object.keys(studentSortLabels) as Array<keyof typeof studentSortLabels>).map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`students-sort-option${studentSort === key ? " active" : ""}`}
                        onClick={() => {
                          setStudentSort(key);
                          setShowStudentSortMenu(false);
                        }}
                      >
                        {studentSortLabels[key]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="students-list-view">
            <section className="students-group">
              <div className="students-group-title">
                <h2>Your Students</h2>
                <span>
                  {visibleActiveStudents.length}{" "}
                  {visibleActiveStudents.length === 1 ? "student" : "students"}
                </span>
              </div>

              {visibleActiveStudents.length === 0 ? (
                <p className="students-empty">
                  {activeStudents.length === 0
                    ? "No students yet. Tap + to add one."
                    : "No students match your search."}
                </p>
              ) : (
                <div className="students-group-card">
                  {visibleActiveStudents.map((link: any) => {
                    const student = link.students;

                    return (
                      <div key={link.student_id} className="students-row" onClick={() => openStudentDetails(link)}>
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
                        onClick={(e) => {e.stopPropagation(), openEditStudent(link)}}
                        >
                        <FaEdit />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            <section className="students-group archived-students-group">
              <div className="students-group-title">
                <h2>Archived Students</h2>
                <span>
                  {visibleArchivedStudents.length}{" "}
                  {visibleArchivedStudents.length === 1 ? "student" : "students"}
                </span>
              </div>

              {visibleArchivedStudents.length === 0 ? (
                <p className="students-empty">
                  {archivedStudents.length === 0
                    ? "No archived students."
                    : "No archived students match your search."}
                </p>
              ) : (
                <div className="students-group-card">
                  {visibleArchivedStudents.map((link: any) => {
                    const student = link.students;

                    return (
                      <div
                        key={link.student_id}
                        className="students-row archived-student-row"
                        onClick={() => openEditStudent(link)}
                      >
                        <div className="students-avatar archived">
                          {student?.student_name
                            ? student.student_name.charAt(0).toUpperCase()
                            : "S"}
                        </div>

                        <div className="students-info">
                          <strong>{student?.student_name || "Student"}</strong>
                          <span>Archived</span>
                        </div>

                        <button
                          type="button"
                          className="students-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditStudent(link);
                          }}
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
            <span>{term.plural}</span>
          </div>

          <div className="nav-item active" onClick={() => navigate("/students")}>
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
      </div>

      {showStudentLimitModal && (
        <div
          className="student-limit-overlay"
          onClick={() => setShowStudentLimitModal(false)}
        >
          <div
            className="student-limit-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="student-limit-close"
              onClick={() => setShowStudentLimitModal(false)}
            >
              ×
            </button>
            <div className="student-limit-modal-icon">
              <FaLock />
            </div>
            <strong>Unlimited students available for Pro users only</strong>
            <p>You've reached the 5-student limit on the free plan. Upgrade to Pro to add unlimited students.</p>
            <button
              type="button"
              className="student-limit-upgrade-btn"
              onClick={() => navigate("/upgrade")}
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      )}

      {showAddStudent && (
        <div
          className="students-add-overlay"
          onClick={closeAddStudent}
        >
          <div
            className="students-add-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="students-add-header">
              <h2>Add Student</h2>
              <button type="button" onClick={closeAddStudent}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateStudent} autoComplete="off" className="students-add-form">
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
                    onChange={(e) => setPhoneNumber(formatUSPhoneInput(e.target.value))}
                    placeholder="(719) 555-1234"
                    autoComplete="off"
                    />
                    <label className="sms-consent-checkbox">
                      <input
                        type="checkbox"
                        checked={smsConsent}
                        onChange={(e) => setSmsConsent(e.target.checked)}
                      />

                      <span>
                        I confirm that the student or parent agreed to receive transactional SMS
                        messages from Billio for lesson reminders, invoice notifications, payment
                        reminders, and account-related updates. Message frequency varies. Message
                        and data rates may apply. Reply STOP to opt out. Reply HELP for help.{" "}
                        <a href="/terms" target="_blank" rel="noreferrer">
                          Terms
                        </a>{" "}
                        and{" "}
                        <a href="/privacy" target="_blank" rel="noreferrer">
                          Privacy Policy
                        </a>
                        .
                      </span>
                    </label>
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
                    onChange={(e) => setParentPhone(formatUSPhoneInput(e.target.value))}
                    placeholder="(719) 555-1234"
                    autoComplete="off"
                    />
                    <label className="sms-consent-checkbox">
                      <input
                        type="checkbox"
                        checked={smsConsent}
                        onChange={(e) => setSmsConsent(e.target.checked)}
                      />

                      <span>
                        I confirm that the student or parent agreed to receive transactional SMS
                        messages from Billio for lesson reminders, invoice notifications, payment
                        reminders, and account-related updates. Message frequency varies. Message
                        and data rates may apply. Reply STOP to opt out. Reply HELP for help.{" "}
                        <a href="/terms" target="_blank" rel="noreferrer">
                          Terms
                        </a>{" "}
                        and{" "}
                        <a href="/privacy" target="_blank" rel="noreferrer">
                          Privacy Policy
                        </a>
                        .
                      </span>
                    </label>
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

                <div className="student-preference-section">
                  <h3>Invoice Preferences</h3>

                  <div className="input-block">
                    <label>Invoice Contact</label>
                    <span className="student-field-note">
                      Choose who should receive invoices for this student.
                    </span>

                    <div className="student-choice-group">
                      {["auto", "student", "parent"].map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          className={`student-choice ${
                            invoiceContactTarget === choice ? "active" : ""
                          }`}
                          onClick={() => setInvoiceContactTarget(choice)}
                        >
                          {choice === "auto"
                            ? "Auto"
                            : choice === "student"
                            ? "Student"
                            : "Parent"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="input-block">
                    <label>Invoice Delivery</label>
                    <span className="student-field-note">
                      Auto uses your default invoice delivery setting.
                    </span>

                    <div className="student-choice-group">
                      {["auto", "email", "text", "both"].map((choice) => {
                        const isLocked = !isPro && (choice === "text" || choice === "both");
                        return (
                          <div key={choice} className="lock-wrapper">
                            <button
                              type="button"
                              className={`student-choice ${invoiceDeliveryMethod === choice ? "active" : ""}${isLocked ? " pro-locked-choice" : ""}`}
                              onClick={() => !isLocked && setInvoiceDeliveryMethod(choice)}
                              disabled={isLocked}
                            >
                              {choice === "auto" ? "Auto" : choice === "email" ? "Email" : choice === "text" ? "Text" : "Both"}
                            </button>
                            {isLocked && (
                              <span className="pro-only-bubble">
                                <FaLock style={{ fontSize: 8 }} /> Pro only
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {(invoiceDeliveryMethod === "email" || invoiceDeliveryMethod === "both") && (
                      <div className="lesson-recurring-toggle-row" style={{ marginTop: 20 }}>
                        <div className="lesson-recurring-toggle-label">
                          <span>Auto-generate PDF invoice</span>
                        </div>
                        {isPro ? (
                          <button
                            type="button"
                            className={`lesson-recurring-toggle-btn ${autoGeneratePdf ? "active" : ""}`}
                            onClick={() => setAutoGeneratePdf((prev) => !prev)}
                          >
                            <span className="lesson-recurring-toggle-knob" />
                          </button>
                        ) : (
                          <span className="pro-only-bubble" style={{ position: "static", transform: "none" }}>
                            <FaLock style={{ fontSize: 8 }} /> Pro only
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                type="button"
                className={`student-active-button ${active ? "active" : "inactive"}`}
                // onClick={() => setActive((prev) => !prev)}
                >
                <div>
                    <strong>Student Activity</strong>
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

                <button type="submit" className="students-save-btn" disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Student"}
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
                      placeholder="(719) 555-1234"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(formatUSPhoneInput(e.target.value))}
                      autoComplete="off"
                  />
                  <label className="sms-consent-checkbox">
                      <input
                        type="checkbox"
                        checked={smsConsent}
                        onChange={(e) => setSmsConsent(e.target.checked)}
                      />

                      <span>
                        I confirm that the student or parent agreed to receive transactional SMS
                        messages from Billio for lesson reminders, invoice notifications, payment
                        reminders, and account-related updates. Message frequency varies. Message
                        and data rates may apply. Reply STOP to opt out. Reply HELP for help.{" "}
                        <a href="/terms" target="_blank" rel="noreferrer">
                          Terms
                        </a>{" "}
                        and{" "}
                        <a href="/privacy" target="_blank" rel="noreferrer">
                          Privacy Policy
                        </a>
                        .
                      </span>
                    </label>
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
                  <label htmlFor="editParentEmail">Parent Email</label>
                  <input
                  id="editParentEmail"
                  type="text"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  autoComplete="off"
                  />
                </div>

                <div className="input-block">
                  <label htmlFor="editParentPhone">Parent Phone</label>
                  <input
                      id="editParentPhone"
                      type="tel"
                      value={parentPhone}
                      placeholder="(719) 555-1234"
                      onChange={(e) => setParentPhone(formatUSPhoneInput(e.target.value))}
                      autoComplete="off"
                  />
                  <label className="sms-consent-checkbox">
                      <input
                        type="checkbox"
                        checked={smsConsent}
                        onChange={(e) => setSmsConsent(e.target.checked)}
                      />

                      <span>
                        I confirm that the student or parent agreed to receive transactional SMS
                        messages from Billio for lesson reminders, invoice notifications, payment
                        reminders, and account-related updates. Message frequency varies. Message
                        and data rates may apply. Reply STOP to opt out. Reply HELP for help.{" "}
                        <a href="/terms" target="_blank" rel="noreferrer">
                          Terms
                        </a>{" "}
                        and{" "}
                        <a href="/privacy" target="_blank" rel="noreferrer">
                          Privacy Policy
                        </a>
                        .
                      </span>
                    </label>
                </div>

                <div className="input-block">
                <label htmlFor="editStudentNotes">Notes</label>
                <textarea
                    id="editStudentNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                />
                </div>

                <div className="student-preference-section">
                  <h3>Invoice Preferences</h3>

                  <div className="input-block">
                    <label>Invoice Contact</label>
                    <span className="student-field-note">
                      Choose who should receive invoices for this student.
                    </span>

                    <div className="student-choice-group">
                      {["auto", "student", "parent"].map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          className={`student-choice ${
                            invoiceContactTarget === choice ? "active" : ""
                          }`}
                          onClick={() => setInvoiceContactTarget(choice)}
                        >
                          {choice === "auto"
                            ? "Auto"
                            : choice === "student"
                            ? "Student"
                            : "Parent"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="input-block">
                    <label>Invoice Delivery</label>
                    <span className="student-field-note">
                      Auto uses your default invoice delivery setting.
                    </span>

                    <div className="student-choice-group">
                      {["auto", "email", "text", "both"].map((choice) => {
                        const isLocked = !isPro && (choice === "text" || choice === "both");
                        return (
                          <div key={choice} className="lock-wrapper">
                            <button
                              type="button"
                              className={`student-choice ${invoiceDeliveryMethod === choice ? "active" : ""}${isLocked ? " pro-locked-choice" : ""}`}
                              onClick={() => !isLocked && setInvoiceDeliveryMethod(choice)}
                              disabled={isLocked}
                            >
                              {choice === "auto" ? "Auto" : choice === "email" ? "Email" : choice === "text" ? "Text" : "Both"}
                            </button>
                            {isLocked && (
                              <span className="pro-only-bubble">
                                <FaLock style={{ fontSize: 8 }} /> Pro only
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {(invoiceDeliveryMethod === "email" || invoiceDeliveryMethod === "both") && (
                      <div className="lesson-recurring-toggle-row" style={{ marginTop: 20 }}>
                        <div className="lesson-recurring-toggle-label">
                          <span>Auto-generate PDF invoice</span>
                        </div>
                        {isPro ? (
                          <button
                            type="button"
                            className={`lesson-recurring-toggle-btn ${autoGeneratePdf ? "active" : ""}`}
                            onClick={() => setAutoGeneratePdf((prev) => !prev)}
                          >
                            <span className="lesson-recurring-toggle-knob" />
                          </button>
                        ) : (
                          <span className="pro-only-bubble" style={{ position: "static", transform: "none" }}>
                            <FaLock style={{ fontSize: 8 }} /> Pro only
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <button
                type="button"
                className={`student-active-button ${active ? "active" : "inactive"}`}
                // onClick={() => setActive((prev) => !prev)}
                >
                <div>
                    <strong>Student Activity</strong>
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

                <button type="submit" className="students-save-btn" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
                </button>

                {!active && (
                  <button
                    type="button"
                    className="students-restore-btn"
                    onClick={() => handleRestoreStudent(editingStudent.id)}
                    disabled={isMoving}
                  >
                    {isMoving ? "Restoring..." : "Restore Student"}
                  </button>
                )}

                <button
                  type="button"
                  className={active ? "students-delete-btn" : "students-permanent-delete-btn"}
                  disabled={isMoving || isDeleting}
                  onClick={() => {
                    if (active) {
                      handleArchiveStudent(editingStudent.id);
                    } else {
                      setStudentToDelete(editingStudent);
                    }
                  }}
                >
                  {active
                  ? isMoving
                    ? "Archiving..."
                    : "Archive Student"
                  : isDeleting
                  ? "Deleting..."
                  : "Permanently Delete Student"}
                </button>
            </form>
            </div>
        </div>
      )}
      {selectedStudent && (
        <div
          className="students-detail-overlay"
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="students-detail-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="students-detail-header">
              <div>
                <h2>{selectedStudent.student_name}</h2>
                <span>Student details</span>
              </div>
 
              <button
                type="button"
                className="students-close-btn"
                onClick={() => setSelectedStudent(null)}
              >
                ×
              </button>
            </div>
 
            {detailLoading ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "48px 0" }}>
                <div className="billio-mini-spinner" />
              </div>
            ) : (
              <>
            <section className="students-detail-section">
              <div className="students-detail-title">
                <h3>{term.plural}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>
                    {filteredStudentLessons.length === studentLessons.length
                      ? `${filteredStudentLessons.length} ${filteredStudentLessons.length === 1 ? term.lower : term.lowerPlural}`
                      : `${filteredStudentLessons.length} of ${studentLessons.length} ${term.lowerPlural}`}
                  </span>
                  <button
                    type="button"
                    className="students-filter-btn"
                    style={activeFilterCount > 0
                      ? { background: "#eef2ff", color: "var(--primary-purple)", position: "relative", width: 32, height: 32, fontSize: 13 }
                      : { position: "relative", width: 32, height: 32, fontSize: 13 }}
                    onClick={() => setShowFilterSheet(true)}
                  >
                    <FaFilter />
                    {activeFilterCount > 0 && (
                      <span style={{
                        position: "absolute", top: -4, right: -4,
                        width: 14, height: 14, borderRadius: "50%",
                        background: "var(--primary-purple)", color: "#fff",
                        fontSize: 9, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>{activeFilterCount}</span>
                    )}
                  </button>
                </div>
              </div>
 
              {filteredStudentLessons.length === 0 ? (
                <p className="students-empty">
                  {studentLessons.length === 0 ? `No ${term.lowerPlural} for this student yet.` : `No ${term.lowerPlural} match your filters.`}
                </p>
              ) : (
                <div className="students-detail-card">
                  {filteredStudentLessons.map((lesson) => (
                    <div
                    key={lesson.id}
                    className={`students-detail-row ${
                      selectedLessonActionId === lesson.id ? "action-mode" : ""
                    }`}
                    onClick={() =>
                      setSelectedLessonActionId(
                        selectedLessonActionId === lesson.id ? null : lesson.id
                      )
                    }
                  >
                    {selectedLessonActionId === lesson.id ? (
                      <div className="students-lesson-actions">
                        <button
                          type="button"
                          className="students-lesson-edit-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            openStudentDetails(false)
                            openEditLesson(lesson);
                          }}
                        >
                          Edit
                        </button>
 
                        <button
                          type="button"
                          className="students-lesson-delete-action"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteStudentLesson(lesson.id);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <strong>{new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>
                          <span>
                            {lesson.start_time?.slice(0, 5)} • {lesson.duration_minutes} min •{" "}
                            <div className={`sd-status-badge sd-status-${lesson.billing_status || "unbilled"}`}>
                              {(lesson.billing_status || "unbilled").charAt(0).toUpperCase() + (lesson.billing_status || "unbilled").slice(1)}
                            </div>
                          </span>
 
                        </div>
                        <strong>${Number(lesson.rate || 0).toFixed(2)}</strong>
                      </>
                    )}
                  </div>
                  ))}
                </div>
              )}
            </section>
 
            <section className="students-detail-section">
              <div className="students-detail-title">
                <h3>Invoices</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span>
                    {filteredStudentInvoices.length}
                    {filteredStudentInvoices.length !== studentInvoices.length && ` of ${studentInvoices.length}`}
                  </span>
                  <button
                    type="button"
                    className="students-filter-btn"
                    style={activeInvoiceFilterCount > 0
                      ? { background: "#eef2ff", color: "var(--primary-purple)", position: "relative", width: 32, height: 32, fontSize: 13 }
                      : { position: "relative", width: 32, height: 32, fontSize: 13 }}
                    onClick={() => setShowInvoiceFilterSheet(true)}
                  >
                    <FaFilter />
                    {activeInvoiceFilterCount > 0 && (
                      <span style={{
                        position: "absolute", top: -4, right: -4,
                        width: 14, height: 14, borderRadius: "50%",
                        background: "var(--primary-purple)", color: "#fff",
                        fontSize: 9, fontWeight: 700,
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>{activeInvoiceFilterCount}</span>
                    )}
                  </button>
                </div>
              </div>
 
              {filteredStudentInvoices.length === 0 ? (
                <p className="students-empty">
                  {studentInvoices.length === 0 ? "No invoices for this student yet." : "No invoices match your filters."}
                </p>
              ) : (
                <div className="students-detail-card">
                  {filteredStudentInvoices.map((invoice) => {
                    const invoiceLessonDates = (invoice.invoice_lessons || [])
                      .map((il: any) => il.lessons).filter(Boolean);
                    const weekLabel = getInvoiceWeekLabel(invoiceLessonDates);
                    return (
                    <div key={invoice.id} className="students-detail-row" style={{ cursor: "pointer" }} onClick={() => openInvoiceDetail(invoice)}>
                      <div>
                        <strong>{invoice.invoice_number || "Invoice"}</strong>
                        {weekLabel && (
                          <span style={{ fontSize: 12, color: "var(--secondary-text)", fontWeight: 500, display: "block", marginTop: 2 }}>
                            {weekLabel}
                          </span>
                        )}
                        <div className={`sd-status-badge sd-status-${invoice.status || "unbilled"}`} style={{ marginTop: 4, display: "block" }}>
                          {(invoice.status || "unbilled").charAt(0).toUpperCase() + (invoice.status || "unbilled").slice(1)}
                        </div>
                        {invoice.due_date && (
                          <span style={{
                            fontSize: 11,
                            color: invoice.status !== "paid" && new Date(invoice.due_date + "T00:00:00") < new Date() ? "#ef4444" : "var(--secondary-text)",
                            marginTop: 2, display: "block"
                          }}>
                            Due {new Date(invoice.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                      <strong>${Number(invoice.total || 0).toFixed(2)}</strong>
                    </div>
                  ); })}
                </div>
              )}
            </section>
              </>
            )}
          </div>
        </div>
      )}

      {studentToDelete && (
        <div
          className="billio-confirm-overlay"
          onClick={() => setStudentToDelete(null)}
        >
          <div
            className="billio-confirm-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="billio-confirm-icon">!</div>

            <h2>Permanently Delete?</h2>

            <p>
              This will permanently delete{" "}
              <strong>{studentToDelete.student_name}</strong>'s profile and contact info.
              Their existing lessons and invoices are kept for your records. This cannot be undone.
            </p>

            <div className="billio-confirm-actions">
              <button
                type="button"
                className="billio-cancel-btn"
                onClick={() => setStudentToDelete(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="billio-danger-btn"
                disabled={isDeleting}
                onClick={() => {
                  handlePermanentDeleteStudent(studentToDelete.id, studentToDelete.student_name);
                  setStudentToDelete(null);
                }}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
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
              <h2>Edit {term.singular}</h2>
              <button type="button" onClick={closeEditLesson}>
                ×
              </button>
            </div>

            <form onSubmit={handleUpdateLesson} className="add-lesson-form">
              <div className="input-block">
                <label>{term.singular} Date</label>
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
                <label>{term.singular} Type</label>
                <input
                  type="text"
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                />
              </div>

              <div className="input-block">
                <label>Hourly Rate</label>
                {rateOptions.length > 0 && (
                  <div className="rate-options-row">
                    {visibleRates.map((rate, index) => (
                      <button
                        key={`${rate.name}-${index}`}
                        type="button"
                        className={`rate-option-chip ${
                          Number(hourlyRate) === Number(rate.amount) ? "active" : ""
                        }`}
                        onClick={() => setHourlyRate(String(rate.amount))}
                      >
                        {rate.name} ${Number(rate.amount).toFixed(0)}
                      </button>
                    ))}

                    {hiddenRates.length > 0 && (
                      <button
                        type="button"
                        className="rate-option-chip more-rate-chip"
                        onClick={() => setShowRateSheet(true)}
                      >
                        More +{hiddenRates.length}
                      </button>
                    )}
                  </div>
                )}
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
                  value={lessonNotes}
                  onChange={(e) => setLessonNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="save-lesson-btn" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                className="delete-lesson-btn"
                onClick={() => handleDeleteStudentLesson(editingLesson.id)}
              >
                {isDeleting ? "Deleting..." : `Delete ${term.singular}`}
              </button>
            </form>
          </div>
        </div>
      )}
      {showFilterSheet && (
        <div className="invoice-settings-overlay" onClick={() => setShowFilterSheet(false)}>
          <div className="invoice-settings-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="invoice-settings-header">
              <h2>Filter {term.plural}</h2>
              <button type="button" onClick={() => setShowFilterSheet(false)}>×</button>
            </div>

            <section className="invoice-settings-section">
              <h3>Billing Status</h3>
              <div className="isf-freq-group" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
                {["all","unbilled","billed","paid"].map((s) => (
                  <button key={s} type="button"
                    className={`isf-freq-btn${filterStatus === s ? " active" : ""}`}
                    onClick={() => setFilterStatus(s)}>
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </section>

            <section className="invoice-settings-section under-divider">
              <h3>Date Range</h3>
              <div className="isf-freq-group" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
                {[
                  { value: "all", label: "All time" },
                  { value: "30days", label: "Last 30 days" },
                  { value: "90days", label: "Last 90 days" },
                  { value: "year", label: "This year" },
                  { value: "custom", label: "Custom" },
                ].map(({ value, label }) => (
                  <button key={value} type="button"
                    className={`isf-freq-btn${filterRange === value ? " active" : ""}`}
                    onClick={() => setFilterRange(value)}>
                    {label}
                  </button>
                ))}
              </div>
              {filterRange === "custom" && (
                <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                  <div className="input-block" style={{ flex: 1, margin: 0 }}>
                    <label>From</label>
                    <input type="date" value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      style={{ height: 48, borderRadius: 12, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--main-text)", fontSize: 15, padding: "0 14px", width: "100%", boxSizing: "border-box" as any }} />
                  </div>
                  <div className="input-block" style={{ flex: 1, margin: 0 }}>
                    <label>To</label>
                    <input type="date" value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      style={{ height: 48, borderRadius: 12, border: "1px solid var(--border)", background: "var(--input-bg)", color: "var(--main-text)", fontSize: 15, padding: "0 14px", width: "100%", boxSizing: "border-box" as any }} />
                  </div>
                </div>
              )}
            </section>

            <section className="invoice-settings-section under-divider">
              <h3>Sort</h3>
              <div className="isf-freq-group">
                <button type="button" className={`isf-freq-btn${filterSort === "newest" ? " active" : ""}`} onClick={() => setFilterSort("newest")}>Newest first</button>
                <button type="button" className={`isf-freq-btn${filterSort === "oldest" ? " active" : ""}`} onClick={() => setFilterSort("oldest")}>Oldest first</button>
              </div>
            </section>

            <button type="button" className="invoice-settings-save-btn" onClick={() => setShowFilterSheet(false)}>Apply Filters</button>

            {activeFilterCount > 0 && (
              <button type="button" className="up-cancel-btn" style={{ marginTop: 8 }}
                onClick={() => { setFilterStatus("all"); setFilterRange("all"); setFilterSort("newest"); setFilterDateFrom(""); setFilterDateTo(""); }}>
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {showInvoiceFilterSheet && (
        <div className="invoice-settings-overlay" onClick={() => setShowInvoiceFilterSheet(false)}>
          <div className="invoice-settings-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="invoice-settings-header">
              <h2>Filter Invoices</h2>
              <button type="button" onClick={() => setShowInvoiceFilterSheet(false)}>×</button>
            </div>

            <section className="invoice-settings-section">
              <h3>Status</h3>
              <div className="isf-freq-group" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
                {["all","unbilled","billed","paid"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`isf-freq-btn${invoiceFilterStatus === s ? " active" : ""}`}
                    onClick={() => setInvoiceFilterStatus(s)}
                  >
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </section>

            <section className="invoice-settings-section under-divider">
              <h3>Sort</h3>
              <div className="isf-freq-group">
                <button
                  type="button"
                  className={`isf-freq-btn${invoiceFilterSort === "newest" ? " active" : ""}`}
                  onClick={() => setInvoiceFilterSort("newest")}
                >
                  Newest first
                </button>
                <button
                  type="button"
                  className={`isf-freq-btn${invoiceFilterSort === "oldest" ? " active" : ""}`}
                  onClick={() => setInvoiceFilterSort("oldest")}
                >
                  Oldest first
                </button>
              </div>
            </section>

            <button
              type="button"
              className="invoice-settings-save-btn"
              onClick={() => setShowInvoiceFilterSheet(false)}
            >
              Apply Filters
            </button>

            {activeInvoiceFilterCount > 0 && (
              <button
                type="button"
                className="up-cancel-btn"
                style={{ marginTop: 8 }}
                onClick={() => {
                  setInvoiceFilterStatus("all");
                  setInvoiceFilterSort("newest");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {selectedStudentInvoice && (
        <div
          className="students-add-overlay"
          style={{ zIndex: 400 }}
          onClick={() => setSelectedStudentInvoice(null)}
        >
          <div
            className="students-add-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="students-add-header">
              <div>
                <h2>{selectedStudentInvoice.invoice_number || "Invoice"}</h2>
                {!invoiceDetailLoading && invoiceDetailLessons.length > 0 && (
                  <span style={{ fontSize: 13, color: "var(--secondary-text)", fontWeight: 500 }}>
                    {getInvoiceWeekLabel(invoiceDetailLessons)}
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setSelectedStudentInvoice(null)}>×</button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px 16px" }}>
              <span className={`sd-status-badge sd-status-${selectedStudentInvoice.status || "unbilled"}`}>
                {(selectedStudentInvoice.status || "unbilled").charAt(0).toUpperCase() + (selectedStudentInvoice.status || "unbilled").slice(1)}
              </span>
              <strong style={{ marginLeft: "auto", fontSize: 16 }}>
                ${Number(selectedStudentInvoice.total || 0).toFixed(2)}
              </strong>
            </div>

            {invoiceDetailLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
                <div className="billio-mini-spinner" />
              </div>
            ) : invoiceDetailLessons.length === 0 ? (
              <p className="students-empty" style={{ padding: "0 16px 24px" }}>No {term.lowerPlural} attached to this invoice.</p>
            ) : (
              <div className="students-detail-card" style={{ margin: "0 16px 24px" }}>
                {invoiceDetailLessons.map((lesson: any) => (
                  <div key={lesson.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
                    <div>
                      <strong style={{ fontSize: 14, display: "block" }}>
                        {new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </strong>
                      <span style={{ fontSize: 13, color: "var(--secondary-text)" }}>{lesson.start_time?.slice(0, 5)} • {lesson.duration_minutes} min</span>
                    </div>
                    <strong style={{ fontSize: 14, whiteSpace: "nowrap" }}>${Number(lesson.rate || 0).toFixed(2)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showRateSheet && (
        <div
          className="rate-sheet-overlay"
          onClick={() => setShowRateSheet(false)}
        >
          <div
            className="rate-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Select Rate</h3>

            {rateOptions.map((rate, index) => (
              <button
                key={`${rate.name}-${index}`}
                type="button"
                className="rate-sheet-item"
                onClick={() => {
                  setHourlyRate(String(rate.amount));
                  setShowRateSheet(false);
                }}
              >
                {rate.name} ${Number(rate.amount).toFixed(0)}
              </button>
            ))}
          </div>
        </div>
      )}


      {showStudentsTutorial && (
        <>
          <div
            className="students-tutorial-overlay"
            style={studentsTutorialStep === 1 ? { background: "transparent" } : undefined}
            onClick={studentsTutorialStep === 1 ? dismissStudentsTutorial : undefined}
          />

          {studentsTutorialStep === 1 && studentsSpotlightRect && (
            <div
              className="students-tutorial-spotlight"
              style={{
                top: studentsSpotlightRect.top,
                left: studentsSpotlightRect.left,
                width: studentsSpotlightRect.width,
                height: studentsSpotlightRect.height,
              }}
            />
          )}

          <div className={`students-tutorial-card${studentsTutorialStep === 1 ? " students-tutorial-card-bottom" : ""}`}>
            {studentsTutorialStep === 0 && (
              <>
                <div className="students-tutorial-icon-wrap">👥</div>
                <h2 className="students-tutorial-title">Welcome to Students</h2>
                <p className="students-tutorial-text">
                  This page keeps your active and archived students organized in one place.
                  Open a student to view their lesson history, invoice history, and saved details.
                </p>
                <ul className="students-tutorial-list">
                  <li>Track each student you coach or teach</li>
                  <li>Keep contact and parent information ready for billing</li>
                  <li>Archive students without losing their history</li>
                </ul>
                <div className="students-tutorial-dots">
                  <span className="students-tutorial-dot students-tutorial-dot-active" />
                  <span className="students-tutorial-dot" />
                  <span className="students-tutorial-dot" />
                  <span className="students-tutorial-dot" />
                </div>
                <button className="students-tutorial-btn-primary" onClick={advanceStudentsTutorial}>
                  Next →
                </button>
                <button className="students-tutorial-btn-skip" onClick={dismissStudentsTutorial}>
                  Skip tutorial
                </button>
              </>
            )}

            {studentsTutorialStep === 1 && (
              <>
                <div className="students-tutorial-arrow-label">
                  <span className="students-tutorial-arrow-up">↗</span>
                  <span>Tap this icon later</span>
                </div>
                <h2 className="students-tutorial-title">Add a student</h2>
                <p className="students-tutorial-text">
                  Use the <strong>+ button</strong> to add a new student profile.
                  You can save contact info, parent info, notes, SMS consent, and invoice preferences.
                </p>
                <ul className="students-tutorial-list">
                  <li>Free users can keep up to 5 active students</li>
                  <li>Pro users can add unlimited active students</li>
                  <li>Highlighted areas are preview only during the tutorial</li>
                </ul>
                <div className="students-tutorial-dots">
                  <span className="students-tutorial-dot" />
                  <span className="students-tutorial-dot students-tutorial-dot-active" />
                  <span className="students-tutorial-dot" />
                  <span className="students-tutorial-dot" />
                </div>
                <button className="students-tutorial-btn-primary" onClick={advanceStudentsTutorial}>
                  Next →
                </button>
                <button className="students-tutorial-btn-skip" onClick={dismissStudentsTutorial}>
                  Skip tutorial
                </button>
              </>
            )}

            {studentsTutorialStep === 2 && (
              <>
                <div className="students-tutorial-icon-wrap">📋</div>
                <h2 className="students-tutorial-title">Student list</h2>
                <p className="students-tutorial-text">
                  Your active students appear at the top. Tap a student row to open their detail sheet,
                  or tap the edit icon to update their profile.
                </p>
                <ul className="students-tutorial-list">
                  <li>Student details show saved lessons and invoices</li>
                  <li>Use filters inside the detail sheet to review history faster</li>
                  <li>Edit student info when contact or billing preferences change</li>
                </ul>
                <div className="students-tutorial-dots">
                  <span className="students-tutorial-dot" />
                  <span className="students-tutorial-dot" />
                  <span className="students-tutorial-dot students-tutorial-dot-active" />
                  <span className="students-tutorial-dot" />
                </div>
                <button className="students-tutorial-btn-primary" onClick={advanceStudentsTutorial}>
                  Next →
                </button>
                <button className="students-tutorial-btn-skip" onClick={dismissStudentsTutorial}>
                  Skip tutorial
                </button>
              </>
            )}

            {studentsTutorialStep === 3 && (
              <>
                <div className="students-tutorial-icon-wrap">🗂️</div>
                <h2 className="students-tutorial-title">Archived students</h2>
                <p className="students-tutorial-text">
                  Archive students when you no longer teach them. This keeps your active list clean
                  while preserving their lesson and invoice history.
                </p>
                <ul className="students-tutorial-list">
                  <li>Archived students move to the Archived Students section</li>
                  <li>You can restore an archived student later</li>
                  <li>Permanent delete is available only after a student is archived</li>
                </ul>
                <div className="students-tutorial-dots">
                  <span className="students-tutorial-dot" />
                  <span className="students-tutorial-dot" />
                  <span className="students-tutorial-dot" />
                  <span className="students-tutorial-dot students-tutorial-dot-active" />
                </div>
                <button className="students-tutorial-btn-primary" onClick={advanceStudentsTutorial}>
                  Finish
                </button>
                <button className="students-tutorial-btn-skip" onClick={dismissStudentsTutorial}>
                  Skip tutorial
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Students;