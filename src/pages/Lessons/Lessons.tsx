import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FaHome,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaUsers,
  FaPlus,
  FaChevronLeft,
  FaChevronRight,
  FaCalendarAlt,
  FaList,
  FaClock,
  FaEdit,
  FaTrash,
  FaLock,
  FaRedoAlt,
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import { usePlan } from "../../hooks/usePlan";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import { useSettings } from "../../hooks/useSettings";
import "./Lessons.css"
import "../RecurringLessons/RecurringLessons.css"

const RECURRING_DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const RECURRING_DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const RECURRING_MAX_MONTHS = 12;

function generateOccurrences(
  startDate: string,
  endDate: string,
  frequency: "weekly" | "biweekly",
  daysOfWeek: string[]
): string[] {
  const dates: string[] = [];
  const end = new Date(endDate + "T00:00:00");
  const maxEnd = new Date(startDate + "T00:00:00");
  maxEnd.setMonth(maxEnd.getMonth() + RECURRING_MAX_MONTHS);
  const cap = end < maxEnd ? end : maxEnd;
  const dayIndexes = daysOfWeek.map((d) => RECURRING_DAYS.indexOf(d)).filter((i) => i >= 0);
  const jsToMon = (jsDay: number) => (jsDay === 0 ? 6 : jsDay - 1);
  let cur = new Date(startDate + "T00:00:00");
  const startWeekMs = new Date(startDate + "T00:00:00").getTime();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  while (cur <= cap) {
    const monDay = jsToMon(cur.getDay());
    if (dayIndexes.includes(monDay)) {
      if (frequency === "weekly") {
        dates.push(cur.toLocaleDateString("en-CA"));
      } else {
        const weekDiff = Math.floor((cur.getTime() - startWeekMs) / msPerWeek);
        if (weekDiff % 2 === 0) dates.push(cur.toLocaleDateString("en-CA"));
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function Lessons() {
  const { isPro } = usePlan();
  const { coachId, identityLoading } = useCoachIdentity();
  const { settings } = useSettings();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [lessons, setLessons] = useState<any[]>([]);

  // Form States
  const [studentName, setStudentName] = useState("");
  const [lessonDate, setLessonDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [lessonType, setLessonType] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");

  // Lesson specific states
  const [showEditLesson, setShowEditLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [coachStudents, setCoachStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [billingStatus, setBillingStatus] = useState("unbilled");
  const [rateOptions, setRateOptions] = useState<any[]>([]);
  const visibleRates = rateOptions.slice(0, 3);
  const hiddenRates = rateOptions.slice(3);
  const [showRateSheet, setShowRateSheet] = useState(false);

  // Recurring lesson states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<"weekly" | "biweekly">("weekly");
  const [recurringDays, setRecurringDays] = useState<string[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState("");

  const [viewingLesson, setViewingLesson] = useState<any>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [lessonsLoading, setLessonsLoading] = useState(false);

  // Lessons tutorial
  const [showLessonsTutorial, setShowLessonsTutorial] = useState(false);
  const [lessonTutorialStep, setLessonTutorialStep] = useState(0);
  const [lessonSpotlightRect, setLessonSpotlightRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [lessonTutorialCardPosition, setLessonTutorialCardPosition] =
    useState<"top" | "bottom">("bottom");

  const lessonsViewToggleRef = useRef<HTMLDivElement>(null);
  const calendarDetailRef = useRef<HTMLElement>(null);
  const listViewRef = useRef<HTMLDivElement>(null);


  // Calendar 
  function getLocalDateString(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const [selectedCalendarDate, setSelectedCalendarDate] = useState(getLocalDateString(new Date()));

  const navigate = useNavigate();

  const { data: lessonsData, isLoading: lessonsQueryLoading } = useQuery({
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

  useEffect(() => { if (lessonsData) { setLessons(lessonsData); setLessonsLoading(false); } }, [lessonsData]);
  useEffect(() => { if (!coachId && !identityLoading) window.location.href = "/login"; }, [coachId, identityLoading]);

  const loading = identityLoading || lessonsQueryLoading;

  useEffect(() => {
    if (!loading) {
      const seen = localStorage.getItem("billio_lessons_tutorial_seen");

      if (!seen) {
        setTimeout(() => setShowLessonsTutorial(true), 500);
      }
    }
  }, [loading]);

  useEffect(() => {
    if (!showLessonsTutorial) return;

    if (lessonTutorialStep >= 1 && lessonTutorialStep <= 3 && viewMode !== "calendar") {
      setViewMode("calendar");
    }

    if (lessonTutorialStep === 4 && viewMode !== "list") {
      setViewMode("list");
    }
  }, [showLessonsTutorial, lessonTutorialStep, viewMode]);

  useEffect(() => {
    if (!showLessonsTutorial) {
      setLessonSpotlightRect(null);
      return;
    }

    function getTargetElement() {
      if (lessonTutorialStep === 1) return lessonsViewToggleRef.current;
      if (lessonTutorialStep === 2) return null;
      if (lessonTutorialStep === 3) return calendarDetailRef.current;
      if (lessonTutorialStep === 4) return lessonsViewToggleRef.current;
      return null;
    }

    const timeout = window.setTimeout(() => {
      const element = getTargetElement();

      if (!element) {
        setLessonSpotlightRect(null);
        setLessonTutorialCardPosition("bottom");
        return;
      }

      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

      window.setTimeout(() => {
        const rect = element.getBoundingClientRect();

        setLessonSpotlightRect({
          top: Math.max(10, rect.top - 10),
          left: Math.max(10, rect.left - 10),
          width: Math.min(window.innerWidth - 20, rect.width + 20),
          height: rect.height + 20,
        });

        setLessonTutorialCardPosition(
          rect.top < window.innerHeight / 2 ? "bottom" : "top"
        );
      }, 260);
    }, 80);

    function handleResize() {
      const element = getTargetElement();

      if (!element) return;

      const rect = element.getBoundingClientRect();

      setLessonSpotlightRect({
        top: Math.max(10, rect.top - 10),
        left: Math.max(10, rect.left - 10),
        width: Math.min(window.innerWidth - 20, rect.width + 20),
        height: rect.height + 20,
      });

      setLessonTutorialCardPosition(
        rect.top < window.innerHeight / 2 ? "bottom" : "top"
      );
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
    };
  }, [showLessonsTutorial, lessonTutorialStep, viewMode, lessons.length]);

  const recurringPreviewCount =
    isRecurring && lessonDate && recurringEndDate && recurringDays.length > 0
      ? generateOccurrences(lessonDate, recurringEndDate, recurringFrequency, recurringDays).length
      : 0;

  function toggleRecurringDay(day: string) {
    setRecurringDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function handleToggleRecurring() {
    if (!isRecurring && lessonDate) {
      const jsDay = new Date(lessonDate + "T00:00:00").getDay();
      const monIdx = jsDay === 0 ? 6 : jsDay - 1;
      setRecurringDays([RECURRING_DAYS[monIdx]]);
    }
    setIsRecurring((prev) => !prev);
  }

  async function handleCreateLesson(e: any) {
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

      const { data: existingLinks, error: existingStudentError } = await supabase
        .from("coach_students")
        .select(`
          student_id,
          students (
            id,
            student_name
          )
        `)
        .eq("coach_id", coachId);

      if (existingStudentError) {
        console.log("Student lookup error:", existingStudentError);
        return;
      }

      const existingLink = existingLinks?.find((link: any) => {
        return (
          link.students?.student_name?.trim().toLowerCase() ===
          cleanStudentName.toLowerCase()
        );
      });

      let finalStudentId = existingLink?.student_id;
      if (selectedStudentId) {
        finalStudentId = selectedStudentId;
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

      if (isRecurring) {
        if (recurringDays.length === 0) { alert("Please select at least one day."); return; }
        if (!recurringEndDate) { alert("Please select an end date."); return; }
        if (recurringEndDate <= lessonDate) { alert("End date must be after start date."); return; }

        const seriesPayload = {
          coach_id: coachId,
          student_id: finalStudentId,
          title: lessonType || null,
          start_time: startTime,
          duration_minutes: Number(durationMinutes),
          hourly_rate: hourlyRate ? Number(hourlyRate) : null,
          frequency: recurringFrequency,
          days_of_week: recurringDays,
          start_date: lessonDate,
          end_date: recurringEndDate,
          notes: notes || null,
          active: true,
          updated_at: new Date().toISOString(),
        };

        const { data: newSeries, error: seriesError } = await supabase
          .from("recurring_lessons")
          .insert(seriesPayload)
          .select()
          .single();

        if (seriesError || !newSeries) {
          console.log("Series create error:", seriesError);
          return;
        }

        const occurrences = generateOccurrences(lessonDate, recurringEndDate, recurringFrequency, recurringDays);
        if (occurrences.length > 0) {
          const calculatedRate = Number(hourlyRate) * (Number(durationMinutes) / 60);
          const lessonRows = occurrences.map((date) => ({
            coach_id: coachId,
            student_id: finalStudentId,
            lesson_date: date,
            start_time: startTime,
            duration_minutes: Number(durationMinutes),
            lesson_type: lessonType || null,
            hourly_rate: Number(hourlyRate),
            rate: calculatedRate,
            billing_status: "unbilled",
            notes: notes || null,
            is_recurring: true,
            recurring_series_id: newSeries.id,
            recurring_occurrence_date: date,
          }));
          const { error: lessonError } = await supabase.from("lessons").insert(lessonRows);
          if (lessonError) console.log("Recurring lesson insert error:", lessonError);
        }

        queryClient.invalidateQueries({ queryKey: ["recurring-lessons", coachId] });
        queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
      } else {
        const calculatedRate =
          Number(hourlyRate) * (Number(durationMinutes) / 60);

        const { data: lessonData, error: lessonError } = await supabase
          .from("lessons")
          .insert({
            coach_id: coachId,
            student_id: finalStudentId,
            lesson_date: lessonDate,
            start_time: startTime,
            duration_minutes: Number(durationMinutes),
            lesson_type: lessonType || null,
            hourly_rate: Number(hourlyRate),
            rate: calculatedRate,
            notes: notes || null,
            billing_status: "unbilled"
          })
          .select(`
            *,
            students (
              student_name
            )
          `)
          .single();

        if (lessonError) {
          console.log("Lesson create error:", lessonError);
          return;
        }

        setLessons((prev) => [...prev, lessonData]);
        queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
      }

      setStudentName("");
      setSelectedStudentId(null);
      setLessonDate("");
      setStartTime("");
      setDurationMinutes(String(settings.defaultLessonDuration));
      setLessonType("");
      setHourlyRate("");
      setNotes("");
      setIsRecurring(false);
      setRecurringFrequency("weekly");
      setRecurringDays([]);
      setRecurringEndDate("");
      setShowAddLesson(false);

    } finally {
      setIsSaving(false)
    }

  }

  const groupedLessons = lessons.reduce((groups: any, lesson) => {
    if (!groups[lesson.dateLabel]) {
      groups[lesson.dateLabel] = [];
    }

    groups[lesson.dateLabel].push(lesson);
    return groups;
  }, {});

  function formatMoney(amount: any) {
    return Number(amount || 0).toLocaleString("en-US", {
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
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

  function openEditLesson(lesson: any) {
  setEditingLesson(lesson);

  setStudentName(lesson.students?.student_name || "");
  setLessonDate(lesson.lesson_date || "");
  setStartTime(lesson.start_time?.slice(0, 5) || "");
  setDurationMinutes(String(lesson.duration_minutes || "30"));
  setLessonType(lesson.lesson_type || "");
  setHourlyRate(String(lesson.hourly_rate || ""));
  setNotes(lesson.notes || "");
  setBillingStatus(lesson.billing_status || "unbilled");

  setShowEditLesson(true);
  }

  function closeEditLesson() {
    setShowEditLesson(false);
    setEditingLesson(null);

    setStudentName("");
    setLessonDate("");
    setStartTime("");
    setDurationMinutes(String(settings.defaultLessonDuration));
    setLessonType("");
    setHourlyRate("");
    setNotes("");
    setBillingStatus("unbilled");
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
          notes: notes || null,
          billing_status: billingStatus,
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
        console.log("Update lesson error:", error);
        return;
      }

      setLessons((prev) =>
        prev.map((lesson) => (lesson.id === editingLesson.id ? data : lesson))
      );
      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });

      await syncInvoiceStatusFromLesson(editingLesson.id);

      closeEditLesson();

    } finally {
      setIsSaving(false);
    }


  }

  async function handleDeleteLesson(lessonId: string) {

    if (isDeleting) return; 
    setIsDeleting(true);

    try {

      await cleanupInvoicesAfterLessonDelete(lessonId);

      const { error } = await supabase
        .from("lessons")
        .delete()
        .eq("id", lessonId)
        .eq("coach_id", coachId);

      if (error) {
        console.log("Delete lesson error:", error);
        return;
      }

      setLessons((prev) => prev.filter((lesson) => lesson.id !== lessonId));
      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
      setShowEditLesson(false);

    } finally {
      setIsDeleting(false)
    }

  }

  async function quickUpdateStatus(lesson: any) {
    if (statusUpdatingId === lesson.id) return;
    const cycle: Record<string, string> = {
      unbilled: "billed",
      billed: "paid",
      paid: "unbilled",
    };
    const next = cycle[lesson.billing_status || "unbilled"] || "unbilled";
    setStatusUpdatingId(lesson.id);
    const { data, error } = await supabase
      .from("lessons")
      .update({ billing_status: next })
      .eq("id", lesson.id)
      .eq("coach_id", coachId)
      .select("*, students(student_name)")
      .single();
    if (!error && data) {
      setLessons((prev) => prev.map((l) => (l.id === lesson.id ? data : l)));
      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
      await syncInvoiceStatusFromLesson(lesson.id);
    }
    setStatusUpdatingId(null);
  }

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
  async function pullDefaultRate() {
    if (!coachId) return;

    const { data, error } = await supabase
      .from("coaches")
      .select("default_hourly_rate, custom_rates")
      .eq("id", coachId)
      .single();

    if (error) {
      console.log("Default rate fetch error:", error);
      setHourlyRate("");
    } else {
      setHourlyRate(
        data?.default_hourly_rate
          ? String(data.default_hourly_rate)
          : ""
      );
    }

    const options = [];

    if (data?.default_hourly_rate) {
      options.push({
        name: "Default",
        amount: Number(data.default_hourly_rate),
      });
    }

    if (Array.isArray(data?.custom_rates)) {
      options.push(...data.custom_rates);
    }

    setRateOptions(options);

    setDurationMinutes(String(settings.defaultLessonDuration));
    setShowAddLesson(true);
  }

  const sortedLessons = [...lessons].sort((a, b) => {
    const dateA = new Date(`${a.lesson_date}T${a.start_time}`);
    const dateB = new Date(`${b.lesson_date}T${b.start_time}`);

    return dateB.getTime() - dateA.getTime();
  });

  const currentLessons = sortedLessons.filter(
    (lesson) => getLessonStatus(lesson) === "current"
  );

  const upcomingLessons = sortedLessons.filter(
    (lesson) => getLessonStatus(lesson) === "upcoming"
  );

  const pastLessons = sortedLessons.filter(
    (lesson) => getLessonStatus(lesson) === "past"
  );

  const studentMatches =
    studentName.trim().length > 0
      ? coachStudents.filter((link: any) =>
          link.students?.student_name
            ?.toLowerCase()
            .includes(studentName.trim().toLowerCase())
        )
      : [];

  async function loadCoachStudents() {
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
      console.log("Load students error:", error);
      return;
    }

    setCoachStudents(data || []);
  }

  async function openAddLesson() {
    await pullDefaultRate();
    await loadCoachStudents();
    setShowAddLesson(true);
  }

  async function syncInvoiceStatusFromLesson(lessonId: string) {
    const { data: invoiceLinks, error: linkError } = await supabase
      .from("invoice_lessons")
      .select(`
        invoice_id,
        invoices (
          id,
          coach_id
        )
      `)
      .eq("lesson_id", lessonId);

    if (linkError || !invoiceLinks || invoiceLinks.length === 0) {
      return;
    }

    for (const link of invoiceLinks as any[]) {
      const invoiceId = link.invoice_id;

      const { data: attachedLessons, error: lessonsError } = await supabase
        .from("invoice_lessons")
        .select(`
          lessons (
            id,
            billing_status
          )
        `)
        .eq("invoice_id", invoiceId);

      if (lessonsError || !attachedLessons) {
        console.log("Invoice attached lessons error:", lessonsError);
        continue;
      }

      const lessons = attachedLessons.map((row: any) => row.lessons);

      const statuses = lessons.map(
        (lesson: any) => lesson.billing_status || "unbilled"
      );

      let invoiceStatus = "unbilled";

      if (statuses.length > 0 && statuses.every((status) => status === "paid")) {
        invoiceStatus = "paid";
      } else if (
        statuses.length > 0 &&
        statuses.every((status) => status === "billed")
      ) {
        invoiceStatus = "billed";
      } else if (statuses.some((status) => status === "unbilled")) {
        invoiceStatus = "unbilled";
      } else {
        invoiceStatus = "billed";
      }

      await supabase
        .from("invoices")
        .update({
          status: invoiceStatus,
        })
        .eq("id", invoiceId);
    }
  }

  function getInvoiceStatusFromLessons(lessons: any[]) {
    if (lessons.length === 0) return "unbilled";

    const statuses = lessons.map(
      (lesson) => lesson.billing_status || "unbilled"
    );

    if (statuses.every((status) => status === "paid")) {
      return "paid";
    }

    if (statuses.every((status) => status === "billed")) {
      return "billed";
    }

    if (statuses.some((status) => status === "unbilled")) {
      return "unbilled";
    }

    return "billed";
  }

  async function cleanupInvoicesAfterLessonDelete(lessonId: string) {
    if (!coachId) return;

    const { data: invoiceLinks, error: linkError } = await supabase
      .from("invoice_lessons")
      .select("invoice_id")
      .eq("lesson_id", lessonId);

    if (linkError) {
      console.log("Find invoice links error:", linkError);
      return;
    }

    if (!invoiceLinks || invoiceLinks.length === 0) return;

    for (const link of invoiceLinks) {
      const invoiceId = link.invoice_id;

      const { data: remainingLinks, error: remainingError } = await supabase
        .from("invoice_lessons")
        .select(`
          lesson_id,
          lessons (
            id,
            rate,
            billing_status
          )
        `)
        .eq("invoice_id", invoiceId)
        .neq("lesson_id", lessonId);

      if (remainingError) {
        console.log("Remaining invoice lessons error:", remainingError);
        continue;
      }

      if (!remainingLinks || remainingLinks.length === 0) {
        const { error: deleteInvoiceError } = await supabase
          .from("invoices")
          .delete()
          .eq("id", invoiceId)
          .eq("coach_id", coachId);

        if (deleteInvoiceError) {
          console.log("Delete empty invoice error:", deleteInvoiceError);
        }

        continue;
      }

      const remainingLessons = remainingLinks.map((row: any) => row.lessons);

      const newTotal = remainingLessons.reduce(
        (sum: number, lesson: any) => sum + Number(lesson.rate || 0),
        0
      );

      const newStatus = getInvoiceStatusFromLessons(remainingLessons);

      const { error: updateInvoiceError } = await supabase
        .from("invoices")
        .update({
          subtotal: newTotal,
          total: newTotal,
          status: newStatus,
        })
        .eq("id", invoiceId)
        .eq("coach_id", coachId);

      if (updateInvoiceError) {
        console.log("Update invoice after lesson delete error:", updateInvoiceError);
      }
    }
  }

  function resetLessonForm() {
    setStudentName("");
    setSelectedStudentId(null);
    setLessonDate("");
    setStartTime("");
    setDurationMinutes(String(settings.defaultLessonDuration));
    setLessonType("");
    setHourlyRate("");
    setNotes("");
    setBillingStatus("unbilled");
    setEditingLesson(null);
    setIsRecurring(false);
    setRecurringFrequency("weekly");
    setRecurringDays([]);
    setRecurringEndDate("");
  }

  function closeAddLesson() {
    setShowAddLesson(false);
    resetLessonForm();
  }

  function getCalendarMonthDays() {
    const selected = new Date(`${selectedCalendarDate}T00:00:00`);

    const year = selected.getFullYear();
    const month = selected.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startDay = firstDayOfMonth.getDay();

    const calendarStart = new Date(firstDayOfMonth);
    calendarStart.setDate(firstDayOfMonth.getDate() - startDay);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(calendarStart);
      date.setDate(calendarStart.getDate() + index);

      const full = getLocalDateString(date);

      return {
        full,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        lessons: lessons.filter((lesson) => lesson.lesson_date === full),
      };
    });
  }

  function changeCalendarMonth(direction: "prev" | "next") {
    const current = new Date(`${selectedCalendarDate}T00:00:00`);
    current.setDate(1);
    current.setMonth(current.getMonth() + (direction === "next" ? 1 : -1));

    setSelectedCalendarDate(getLocalDateString(current));
  }

  function changeCalendarYear(direction: "prev" | "next") {
    const current = new Date(`${selectedCalendarDate}T00:00:00`);
    current.setFullYear(current.getFullYear() + (direction === "next" ? 1 : -1));

    setSelectedCalendarDate(getLocalDateString(current));
  }

const calendarMonthDays = getCalendarMonthDays();

const calendarWeekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const selectedCalendarLessons = lessons.filter(
    (lesson) => lesson.lesson_date === selectedCalendarDate
  );

  const calendarMonthLabel = new Date(
    `${selectedCalendarDate}T00:00:00`
  ).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const today = new Date();
  const selectedDate = new Date(`${selectedCalendarDate}T00:00:00`);
  const isViewingCurrentMonth =
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getFullYear() === today.getFullYear();

  const lessonsTutorialSteps = [
    {
      icon: "📘",
      title: "Welcome to Lessons",
      text:
        "This page is where you manage every lesson you teach. You can add lessons, check your schedule, update billing status, and open lessons when you need to make changes.",
      bullets: [
        "Use Calendar mode for planning by date",
        "Use List view for a full timeline of lessons",
        "Tap a billing status to quickly move a lesson from unbilled to billed to paid",
      ],
    },
    {
      icon: "📅",
      title: "Calendar mode",
      text:
        "Calendar is the default view because it is the fastest way to see which days already have lessons scheduled.",
      bullets: [
        "Switch between Calendar and List from this control",
        "Calendar helps you plan around specific dates",
        "List is helpful when you want to review many lessons at once",
      ],
    },
    {
      icon: "🗓️",
      title: "Monthly calendar",
      text:
        "The calendar shows the selected month. Days with lessons have a small purple dot, and tapping a day updates the lesson details below.",
      bullets: [
        "Use the arrows to move by month or year",
        "Tap a day to select it",
        "Free users can use the current month; Pro unlocks unlimited calendar navigation",
      ],
    },
    {
      icon: "📌",
      title: "Selected day details",
      text:
        "This card shows the lessons for the day you selected on the calendar.",
      bullets: [
        "Tap + here to add a lesson for the selected date",
        "Tap a lesson status to update billing quickly",
        "Tap the edit icon to open the full lesson editor",
      ],
    },
    {
      icon: "📋",
      title: "List view",
      text:
        "List view groups your lessons into Current, Upcoming, and Past sections so you can review everything in order.",
      bullets: [
        "Great for checking older lessons",
        "Quickly see each lesson's rate and billing status",
        "Use the edit icon when a lesson needs changes",
      ],
    },
  ];

  const currentLessonsTutorial = lessonsTutorialSteps[lessonTutorialStep];

  function dismissLessonsTutorial() {
    localStorage.setItem("billio_lessons_tutorial_seen", "1");
    setShowLessonsTutorial(false);
    setLessonTutorialStep(0);
    setLessonSpotlightRect(null);
  }

  function advanceLessonsTutorial() {
    if (lessonTutorialStep < lessonsTutorialSteps.length - 1) {
      setLessonTutorialStep((prev) => prev + 1);
    } else {
      dismissLessonsTutorial();
    }
  }

  return (
    <div className="lessons-page">
      <div className="lessons-wrapper">
        <div className="lessons-body">
            <div className="lessons-header">
                <div className="lessons-header-add">
                    <h1>Lessons</h1>
                    <button
                        type="button"
                        className="lessons-add-btn"
                        onClick={() => openAddLesson()}
                    >
                        <FaPlus />
                    </button>
                </div>
            </div>
            <div
              ref={lessonsViewToggleRef}
              className={`lessons-view-toggle ${
                showLessonsTutorial &&
                (lessonTutorialStep === 1 || lessonTutorialStep === 4)
                  ? "lessons-tutorial-highlighted"
                  : ""
              }`}
            >
            <div
                className={`lessons-toggle-slider ${
                viewMode === "list" ? "lessons-toggle-slider-right" : ""
                }`}
            />

            <button
                type="button"
                className={`lessons-toggle-option ${viewMode === "calendar" ? "active" : ""}`}
                onClick={() => setViewMode("calendar")}
            >
                <FaCalendarAlt />
                Calendar
            </button>

            <button
                type="button"
                className={`lessons-toggle-option ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
            >
                <FaList />
                List
            </button>
            </div>
            {lessonsLoading ? (
              <div className="lessons-loading-card">
                <div className="billio-mini-spinner"></div>
                <p>Loading lessons...</p>
              </div>
            ) : (<>
                {viewMode === "calendar" && (
                <div className="calendar-view">
                  <div className="calendar-top">
                    <button type="button" onClick={() => changeCalendarYear("prev")}>
                      «
                    </button>

                    <button type="button" onClick={() => changeCalendarMonth("prev")}>
                      <FaChevronLeft />
                    </button>

                    <h2>{calendarMonthLabel}</h2>

                    <button type="button" onClick={() => changeCalendarMonth("next")}>
                      <FaChevronRight />
                    </button>

                    <button type="button" onClick={() => changeCalendarYear("next")}>
                      »
                    </button>
                  </div>

                  <div className="calendar-days">
                    {calendarWeekLabels.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>

                  <div className="calendar-grid-wrapper">
                    <div className="calendar-grid">
                      {calendarMonthDays.map((day) => (
                        <button
                          key={day.full}
                          type="button"
                          className={`calendar-day-card ${
                            selectedCalendarDate === day.full ? "active" : ""
                          } ${!day.isCurrentMonth ? "muted" : ""}`}
                          onClick={() => setSelectedCalendarDate(day.full)}
                        >
                          <strong>{day.dayNumber}</strong>

                          {day.lessons.length > 0 && (
                            <>
                              <div className="calendar-lesson-dot purple-dot" />
                            </>
                          )}
                        </button>
                      ))}
                    </div>

                    {!isPro && !isViewingCurrentMonth && (
                      <div className="calendar-pro-overlay">
                        <div className="calendar-pro-overlay-card">
                          <div className="calendar-pro-overlay-icon">
                            <FaLock />
                          </div>
                          <strong>Pro Feature</strong>
                          <p>Unlimited calendar available only for Pro users.</p>
                          <button
                            type="button"
                            className="calendar-pro-overlay-btn"
                            onClick={() => navigate("/upgrade")}
                          >
                            Upgrade to Pro
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <section
                    ref={calendarDetailRef}
                    className={`calendar-detail-card ${
                      showLessonsTutorial && lessonTutorialStep === 3
                        ? "lessons-tutorial-highlighted"
                        : ""
                    }`}
                  >
                  <div className="calendar-detail-header">
                    <div>
                      <h3>
                        {new Date(`${selectedCalendarDate}T00:00:00`).toLocaleDateString(
                          "en-US",
                          {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </h3>

                      <span className="calendar-detail-count">
                        {selectedCalendarLessons.length}{" "}
                        {selectedCalendarLessons.length === 1
                          ? "lesson"
                          : "lessons"}
                      </span>
                    </div>

                    {(isPro || isViewingCurrentMonth) && (
                      <button
                        type="button"
                        className="calendar-add-lesson-btn"
                        onClick={()=> {setLessonDate(selectedCalendarDate);
                        openAddLesson();}}
                      >
                        <FaPlus />
                      </button>
                    )}
                  </div>
                  {selectedCalendarLessons.length === 0 ? (
                      <p className="empty-lessons">No lessons for this day.</p>
                    ) : (
                      selectedCalendarLessons.map((lesson) => (
                        <div key={lesson.id} className="calendar-detail-row" style={{ cursor: "pointer" }} onClick={() => setViewingLesson(lesson)}>
                          <div
                            className={`calendar-time-icon ${
                              lesson.billing_status || "unbilled"
                            }`}
                          >
                            <FaClock />
                          </div>

                          <div>
                            <strong>
                              {lesson.students?.student_name || "Student"} •{" "}
                              {formatTime(lesson.start_time)}
                            </strong>
                            <span>
                              {lesson.duration_minutes} min
                              {lesson.lesson_type
                                ? ` • ${lesson.lesson_type}`
                                : ""}
                              {" • $"}
                              {formatMoney(lesson.rate)}
                              {" • "}
                              <button
                                type="button"
                                className={`calendar-billing-label clickable-status ${lesson.billing_status || "unbilled"}`}
                                disabled={statusUpdatingId === lesson.id}
                                onClick={(e) => { e.stopPropagation(); quickUpdateStatus(lesson); }}
                              >
                                {statusUpdatingId === lesson.id ? "..." : (lesson.billing_status || "unbilled").charAt(0).toUpperCase() + (lesson.billing_status || "unbilled").slice(1)}
                              </button>
                            </span>
                          </div>

                          <button
                            type="button"
                            className="lesson-edit-btn"
                            onClick={(e) => { e.stopPropagation(); openEditLesson(lesson); }}
                          >
                            <FaEdit />
                          </button>
                        </div>
                      ))
                    )}
                  </section>
                </div>
              )}
              {viewMode === "list" && (
                <div
                  ref={listViewRef}
                  className="lessons-list-view"
                >
                  {lessons.length === 0 ? (
                    <p className="empty-lessons">No lessons yet. Tap + to add one.</p>
                  ) : (
                    <>
                      {[
                        { title: "Current Lessons", items: currentLessons },
                        { title: "Upcoming Lessons", items: upcomingLessons },
                        { title: "Past Lessons", items: pastLessons },
                      ].map(
                        (group) =>
                          group.items.length > 0 && (
                            <section className="lesson-group" key={group.title}>
                              <div className="lesson-group-title">
                                <h2>{group.title}</h2>
                                <span>
                                  {group.items.length}{" "}
                                  {group.items.length === 1 ? "lesson" : "lessons"}
                                </span>
                              </div>

                              <div className="lesson-group-card">
                                {group.items.map((lesson) => (
                                  <div key={lesson.id} className="lesson-page-row" style={{ cursor: "pointer" }} onClick={() => setViewingLesson(lesson)}>
                                    <div className="lesson-page-time">
                                      <strong>{formatTime(lesson.start_time)}</strong>
                                      <span>{new Date(`${lesson.lesson_date}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                                    </div>

                                    <div className="lesson-page-info">
                                      <strong>
                                        {lesson.students?.student_name || "Student"}
                                      </strong>
                                      <span>
                                        {lesson.duration_minutes} min •{" "}$
                                        {formatMoney(lesson.rate)}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      className={`lesson-billing-pill ${lesson.billing_status || "unbilled"}`}
                                      onClick={(e) => { e.stopPropagation(); quickUpdateStatus(lesson); }}
                                      disabled={statusUpdatingId === lesson.id}
                                    >
                                      {statusUpdatingId === lesson.id ? "..." : (lesson.billing_status || "unbilled").charAt(0).toUpperCase() + (lesson.billing_status || "unbilled").slice(1)}
                                    </button>

                                    <button
                                      type="button"
                                      className="lesson-edit-btn"
                                      onClick={(e) => { e.stopPropagation(); openEditLesson(lesson); }}
                                    >
                                      <FaEdit />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )
                      )}
                    </>
                  )}
                </div>
              )}
            </>)}
        </div>

        <nav className="bottom-nav">
            <div className="nav-item" onClick={() => navigate("/dashboard")}>
                <FaHome />
                <span>Dashboard</span>
            </div>
    
            <div className="nav-item active" onClick={() => navigate("/lessons")}>
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
      </div>

      {showAddLesson && (
        <div className="add-lesson-overlay" onClick={
          closeAddLesson}>
          <div className="add-lesson-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="add-lesson-header">
              <h2>Add Lesson</h2>
              <button type="button" onClick={closeAddLesson}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateLesson} autoComplete="off" className="add-lesson-form">
              <div className="input-block student-search-block">
                <label htmlFor="studentName">Student Name</label>

                <input
                  id="studentName"
                  type="text"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                    setSelectedStudentId(null);
                  }}
                  placeholder="Enter student name"
                  required
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="words"
                  spellCheck={false}
                />

                {studentMatches.length > 0 && !selectedStudentId && (
                  <div className="student-suggestions">
                    {studentMatches.map((link: any) => (
                      <button
                        key={link.student_id}
                        type="button"
                        className="student-suggestion"
                        onClick={() => {
                          setStudentName(link.students.student_name);
                          setSelectedStudentId(link.student_id);
                        }}
                      >
                        {link.students.student_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="input-block">
                <label htmlFor="lessonDate">Lesson Date</label>
                <input
                  id="lessonDate"
                  type="date"
                  placeholder="Lesson Date"
                  value={lessonDate}
                  onChange={(e) => setLessonDate(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="startTime">Start Time</label>
                <input
                  id="startTime"
                  type="time"
                  placeholder="Lesson Time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="durationMinutes">Duration</label>
                <input
                  id="durationMinutes"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="lessonType">Lesson Type</label>
                <input
                  id="lessonType"
                  type="text"
                  placeholder="Freestyle, jumps, choreography..."
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                />
              </div>

              <div className="input-block">
                <label htmlFor="hourlyRate">Hourly Rate</label>
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
                  id="hourlyRate"
                  type="text"
                  inputMode="decimal"
                  value={hourlyRate ? `$${hourlyRate}` : ""}
                  onChange={(e) =>
                    setHourlyRate(
                      e.target.value.replace(/[^0-9.]/g, "")
                    )
                  }
                  placeholder="$100"
                />
              </div>

              <div className="input-block">
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  placeholder="Optional lesson notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="lesson-recurring-toggle-row">
                <div className="lesson-recurring-toggle-label">
                  <FaRedoAlt className="lesson-recurring-icon" />
                  <span>Make Recurring</span>
                </div>
                <button
                  type="button"
                  className={`lesson-recurring-toggle-btn ${isRecurring ? "active" : ""}`}
                  onClick={handleToggleRecurring}
                >
                  <span className="lesson-recurring-toggle-knob" />
                </button>
              </div>

              {isRecurring && (
                <>
                  <div className="input-block">
                    <label>Frequency</label>
                    <div className="rl-chip-group">
                      {(["weekly", "biweekly"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          className={`rl-chip${recurringFrequency === f ? " active" : ""}`}
                          onClick={() => setRecurringFrequency(f)}
                        >
                          {f === "weekly" ? "Weekly" : "Every 2 weeks"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="input-block">
                    <label>Repeat on</label>
                    <div className="rl-days-row">
                      {RECURRING_DAYS.map((day, i) => (
                        <button
                          key={day}
                          type="button"
                          className={`rl-day-btn${recurringDays.includes(day) ? " active" : ""}`}
                          onClick={() => toggleRecurringDay(day)}
                        >
                          {RECURRING_DAY_LABELS[i]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="input-block">
                    <label htmlFor="recurringEndDate">End Date</label>
                    <input
                      id="recurringEndDate"
                      type="date"
                      value={recurringEndDate}
                      onChange={(e) => setRecurringEndDate(e.target.value)}
                      min={lessonDate || undefined}
                    />
                  </div>

                  {recurringPreviewCount > 0 && (
                    <div className="rl-preview">
                      <FaRedoAlt style={{ fontSize: 12, marginRight: 8 }} />
                      This will create <strong>&nbsp;{recurringPreviewCount} lessons</strong>.
                    </div>
                  )}
                </>
              )}

              <button type="submit" className="save-lesson-btn" disabled={isSaving}>
                {isSaving ? "Saving..." : isRecurring ? "Create Recurring Lesson" : "Save Lesson"}
              </button>
            </form>
          </div>
        </div>
      )}
      {showEditLesson && editingLesson && (
        <div className="add-lesson-overlay" onClick={closeEditLesson}>
          <div className="add-lesson-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="add-lesson-header">
              <h2>Edit Lesson</h2>
              <button type="button" onClick={closeEditLesson}>
                ×
              </button>
            </div>

            <form autoComplete="off" onSubmit={handleUpdateLesson} className="add-lesson-form">
              <div className="input-block">
                <label htmlFor="editStudentName">Student Name</label>
                <input
                  id="editStudentName"
                  type="text"
                  value={studentName}
                  disabled
                />
              </div>

              <div className="input-block">
                <label htmlFor="editLessonDate">Lesson Date</label>
                <input
                  id="editLessonDate"
                  type="date"
                  placeholder="Lesson Date"
                  value={lessonDate}
                  onChange={(e) => setLessonDate(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="editStartTime">Start Time</label>
                <input
                  id="editStartTime"
                  type="time"
                  placeholder="Lesson Time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="editDurationMinutes">Duration</label>
                <input
                  id="editDurationMinutes"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>

              <div className="input-block">
                <label>Billing Status</label>

                <select
                  value={billingStatus}
                  onChange={(e) => setBillingStatus(e.target.value)}
                >
                  <option value="unbilled">Unbilled</option>
                  <option value="billed">Billed</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              <div className="input-block">
                <label htmlFor="editLessonType">Lesson Type</label>
                <input
                  id="editLessonType"
                  type="text"
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                />
              </div>

              <div className="input-block">
                <label htmlFor="editHourlyRate">Hourly Rate</label>
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
                  id="hourlyRate"
                  type="text"
                  inputMode="decimal"
                  value={hourlyRate ? `$${hourlyRate}` : ""}
                  onChange={(e) =>
                    setHourlyRate(
                      e.target.value.replace(/[^0-9.]/g, "")
                    )
                  }
                  placeholder="$100"
                />
              </div>

              <div className="input-block">
                <label htmlFor="editNotes">Notes</label>
                <textarea
                  id="editNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="save-lesson-btn" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                className="delete-lesson-btn"
                onClick={() => handleDeleteLesson(editingLesson.id)}
                disabled={isDeleting}
                >
                
                <FaTrash />
                {isDeleting ? "Deleting..." : "Delete Lesson"}
              </button>
            </form>
          </div>
        </div>
      )}
      {viewingLesson && (
        <div className="add-lesson-overlay" onClick={() => setViewingLesson(null)}>
          <div className="add-lesson-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="add-lesson-header">
              <div>
                <h2>{viewingLesson.students?.student_name || "Lesson"}</h2>
                <span className="lesson-view-date">
                  {new Date(`${viewingLesson.lesson_date}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <button type="button" onClick={() => setViewingLesson(null)}>×</button>
            </div>

            <div className="lesson-view-body">
              <div className="lesson-view-card">
                <div className="lesson-view-row">
                  <span>Time</span>
                  <strong>{formatTime(viewingLesson.start_time)}</strong>
                </div>
                <div className="lesson-view-row">
                  <span>Duration</span>
                  <strong>{viewingLesson.duration_minutes} min</strong>
                </div>
                {viewingLesson.lesson_type && (
                  <div className="lesson-view-row">
                    <span>Type</span>
                    <strong>{viewingLesson.lesson_type}</strong>
                  </div>
                )}
                <div className="lesson-view-row">
                  <span>Rate</span>
                  <strong>${formatMoney(viewingLesson.rate)}</strong>
                </div>
                <div className="lesson-view-row">
                  <span>Status</span>
                  <button
                    type="button"
                    className={`lesson-billing-pill ${viewingLesson.billing_status || "unbilled"}`}
                    disabled={statusUpdatingId === viewingLesson.id}
                    onClick={() => { quickUpdateStatus(viewingLesson); setViewingLesson(null); }}
                  >
                    {statusUpdatingId === viewingLesson.id ? "..." : (viewingLesson.billing_status || "unbilled").charAt(0).toUpperCase() + (viewingLesson.billing_status || "unbilled").slice(1)}
                  </button>
                </div>
              </div>
              {viewingLesson.notes && (
                <div className="lesson-view-notes">
                  <span>Notes</span>
                  <span>{viewingLesson.notes}</span>
                </div>
              )}
            </div>

            <div className="lesson-view-actions">
              <button
                type="button"
                className="save-lesson-btn"
                onClick={() => { setViewingLesson(null); openEditLesson(viewingLesson); }}
              >
                Edit Lesson
              </button>
            </div>
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

      {showLessonsTutorial && currentLessonsTutorial && (
        <>
          <div
            className={`lessons-tutorial-overlay ${
              lessonSpotlightRect ? "lessons-tutorial-overlay-clear" : ""
            }`}
          />

          {lessonSpotlightRect && (
            <div
              className="lessons-tutorial-spotlight"
              style={{
                top: lessonSpotlightRect.top,
                left: lessonSpotlightRect.left,
                width: lessonSpotlightRect.width,
                height: lessonSpotlightRect.height,
              }}
            />
          )}

          <div
            className={`lessons-tutorial-card lessons-tutorial-card-${lessonTutorialCardPosition}`}
          >
            <div className="lessons-tutorial-icon-wrap">
              {currentLessonsTutorial.icon}
            </div>

            <h2 className="lessons-tutorial-title">
              {currentLessonsTutorial.title}
            </h2>

            <p className="lessons-tutorial-text">
              {currentLessonsTutorial.text}
            </p>

            <ul className="lessons-tutorial-list">
              {currentLessonsTutorial.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>

            <div className="lessons-tutorial-dots">
              {lessonsTutorialSteps.map((_, index) => (
                <span
                  key={index}
                  className={`lessons-tutorial-dot ${
                    index === lessonTutorialStep
                      ? "lessons-tutorial-dot-active"
                      : ""
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              className="lessons-tutorial-btn-primary"
              onClick={advanceLessonsTutorial}
            >
              {lessonTutorialStep === lessonsTutorialSteps.length - 1
                ? "Finish"
                : "Next →"}
            </button>

            <button
              type="button"
              className="lessons-tutorial-btn-skip"
              onClick={dismissLessonsTutorial}
            >
              Skip tutorial
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Lessons;