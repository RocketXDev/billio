import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
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
  FaTrash,
  FaLock,
  FaRedoAlt,
} from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import { usePlan } from "../../hooks/usePlan";
import { useSettings } from "../../hooks/useSettings";
import { InstallBanner, InstallGuide } from "../../components/InstallGuide/InstallGuide";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { createInstallNotification } from "../../lib/installNotification";
import './Dashboard.css';
import "../RecurringLessons/RecurringLessons.css";

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

function Dashboard() {
  const [fullName, setFullName] = useState("");
  const [profileId, setProfileId] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [coachId, setCoachId] = useState("");
  const [visibleName, setVisibleName] = useState("");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [bio, setBio] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Onboarding specific
  const [preferredCommunication, setPreferredCommunication] = useState("email");
  const [preferredInvoiceDelivery, setPreferredInvoiceDelivery] = useState("email");

  //Lessons and other functions
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [lessonDate, setLessonDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [lessonType, setLessonType] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [notes, setNotes] = useState("");
  const [showRateSheet, setShowRateSheet] = useState(false);
  const [showEditLesson, setShowEditLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);

  // Recurring lesson states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<"weekly" | "biweekly">("weekly");
  const [recurringDays, setRecurringDays] = useState<string[]>([]);
  const [recurringEndDate, setRecurringEndDate] = useState("");

  // Coaches info
  const [coachSmsConsent, setCoachSmsConsent] = useState(false);

  // Invoices
  const [editingInvoiceStatusId, setEditingInvoiceStatusId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false); 
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { isPro } = usePlan();
  const { settings } = useSettings();
  const { shouldShow, remindLater } = useInstallPrompt();
  const [showUpgradeToast, setShowUpgradeToast] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  const queryClient = useQueryClient();

  const { data: lessons = [] } = useQuery({
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

  const { data: coachStudents = [] } = useQuery({
    queryKey: ["coach-students", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_students")
        .select("student_id, students(id, student_name)")
        .eq("coach_id", coachId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!coachId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, students(student_name)")
        .eq("coach_id", coachId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!coachId,
  });

  const { data: coachRatesData } = useQuery({
    queryKey: ["coach-rates", coachId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaches")
        .select("default_hourly_rate, custom_rates")
        .eq("id", coachId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!coachId,
  });

  const rateOptions: any[] = [];
  if (coachRatesData?.default_hourly_rate) {
    rateOptions.push({ name: "Default", amount: Number(coachRatesData.default_hourly_rate) });
  }
  if (Array.isArray(coachRatesData?.custom_rates)) {
    rateOptions.push(...coachRatesData.custom_rates);
  }
  const visibleRates = rateOptions.slice(0, 3);
  const hiddenRates = rateOptions.slice(3);

  // Dashboard tutorial - shows once for every user
  const [showDashboardTutorial, setShowDashboardTutorial] = useState(false);
  const [dashboardTutorialStep, setDashboardTutorialStep] = useState(0);
  const addLessonCardRef = useRef<HTMLButtonElement>(null);
  const [addLessonSpotlightRect, setAddLessonSpotlightRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const dashboardTutorialSteps = [
    {
      icon: "👋",
      title: "Welcome to your Dashboard",
      text: "This is your home base in Billio. It gives you a quick snapshot of lessons, earnings, invoices, and anything that needs your attention.",
      items: [
        "Use this page when you want a fast overview",
        "Jump into lessons, students, invoices, or settings",
        "Check notifications from the bell icon",
      ],
    },
    {
      icon: "➕",
      title: "Add lessons quickly",
      text: "The Add Lesson card lets you log a lesson without going to another page. Billio uses those lessons to calculate earnings and prepare billing later.",
      items: [
        "Choose or create a student",
        "Set date, time, duration, and rate",
        "Save notes for your records",
        "Highlighted areas are preview only during the tutorial",
      ],
    },
    {
      icon: "📊",
      title: "Understand your stats",
      text: "The Today and This Week cards summarize what is happening right now, so you do not have to manually count lessons or totals.",
      items: [
        "Today shows lessons, earned amount, and upcoming lessons",
        "This Week shows earnings, lesson count, unbilled lessons, and pending invoices",
        "Use View lessons when you need the full schedule",
      ],
    },
    {
      icon: "🧾",
      title: "Track upcoming lessons and invoices",
      text: "The lower sections show what is coming up today and your most recent invoices, so you can follow up faster.",
      items: [
        "Upcoming shows today’s remaining lessons",
        "Tap the arrow to edit a dashboard lesson",
        "Recent Invoices gives a quick billing preview",
      ],
    },
  ];

  const tutorialStorageKeys = [
    "billio_dashboard_tutorial_seen",
    "billio_lessons_tutorial_seen",
    "billio_students_tutorial_seen",
    "billio_invoices_tutorial_seen",
    "billio_more_tutorial_seen",
  ];

  function resetAllTutorials() {
    tutorialStorageKeys.forEach((key) => localStorage.removeItem(key));
    setNotificationsOpen(false);
    setDashboardTutorialStep(0);
    setAddLessonSpotlightRect(null);
    setShowDashboardTutorial(true);
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("upgraded") === "1") {
      setShowUpgradeToast(true);
      setTimeout(() => setShowUpgradeToast(false), 4000);
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [location.search]);

  useEffect(() => {
    if (loading || showOnboarding) return;

    const seen = localStorage.getItem("billio_dashboard_tutorial_seen");

    if (!seen) {
      const timer = setTimeout(() => {
        setShowDashboardTutorial(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [loading, showOnboarding]);

  useEffect(() => {
    if (showDashboardTutorial && dashboardTutorialStep === 1 && addLessonCardRef.current) {
      const rect = addLessonCardRef.current.getBoundingClientRect();

      setAddLessonSpotlightRect({
        top: rect.top - 10,
        left: rect.left - 10,
        width: rect.width + 20,
        height: rect.height + 20,
      });
    } else {
      setAddLessonSpotlightRect(null);
    }
  }, [showDashboardTutorial, dashboardTutorialStep]);

  function dismissDashboardTutorial() {
    localStorage.setItem("billio_dashboard_tutorial_seen", "1");
    setShowDashboardTutorial(false);
    setDashboardTutorialStep(0);
    setAddLessonSpotlightRect(null);
  }

  function advanceDashboardTutorial() {
    if (dashboardTutorialStep < dashboardTutorialSteps.length - 1) {
      setDashboardTutorialStep((prev) => prev + 1);
      return;
    }

    dismissDashboardTutorial();
  }

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
      setProfileId(profileData.id);

      // Create install prompt notification once
      await createInstallNotification(profileData.id);

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

      let loadedNotifications = notificationData || [];

      const tutorialResetNotificationDeleted =
        localStorage.getItem("billio_tutorial_reset_notification_deleted") === "1";

      const hasTutorialResetNotification = loadedNotifications.some(
        (notification) => notification.type === "tutorial_reset"
      );

      if (!tutorialResetNotificationDeleted && !hasTutorialResetNotification) {
        const { data: tutorialResetNotification, error: tutorialResetNotificationError } =
          await supabase
            .from("notifications")
            .insert({
              profile_id: profileData.id,
              title: "Complete tutorials again",
              message:
                "Tap here to reset the walkthroughs for Dashboard, Lessons, Students, Invoices, and More.",
              type: "tutorial_reset",
              is_read: false,
            })
            .select()
            .single();

        if (tutorialResetNotificationError) {
          console.log(
            "Tutorial reset notification error:",
            tutorialResetNotificationError
          );
        }

        if (tutorialResetNotification) {
          loadedNotifications = [tutorialResetNotification, ...loadedNotifications];
        }
      }

      setNotifications(loadedNotifications);

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
        const { data: newCoach, error: coachInsertError } = await supabase
          .from("coaches")
          .insert({
            profile_id: profileData.id,
            active: true,
            setup_completed: false,
          })
          .select()
          .single();

        if (coachInsertError) {
          console.log("Coach insert error:", coachInsertError);
        }

        if (newCoach) {
          setCoachId(newCoach.id);
          setShowOnboarding(true);
          setAvatarUrl("");
        }
        } else {
          setCoachId(coachData.id);
          setAvatarUrl(coachData.avatar_url || "");

          if (!coachData.setup_completed) {
            setShowOnboarding(true);
          } else {
            // cleanup onboarding notification if setup already completed
            await supabase
              .from("notifications")
              .delete()
              .eq("profile_id", profileData.id)
              .eq("type", "onboarding");

            // remove locally too
            setNotifications((prev) =>
              prev.filter(
                (notification) => notification.type !== "onboarding"
              )
            );
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

  async function markNotificationAsRead(notification: any) {
    if (notification.type === "onboarding") {
      setShowOnboarding(true);
    }

    if (notification.type === "install_prompt") {
      setShowInstallGuide(true);
      setNotificationsOpen(false);
    }

    if (notification.type === "tutorial_reset") {
      resetAllTutorials();
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notification.id);

    if (error) {
      console.log("Mark notification read error:", error);
      return;
    }

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notification.id
          ? { ...item, is_read: true }
          : item
      )
    );
  }

  async function deleteNotification(notificationId: string, notificationType?: string) {
    if (notificationType === "tutorial_reset") {
      localStorage.setItem("billio_tutorial_reset_notification_deleted", "1");
    }

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

  async function handleSaveOnboarding(e: any) {
    e.preventDefault();

    if (!defaultHourlyRate || Number(defaultHourlyRate) <= 0) {
    alert("Please enter your hourly rate before finishing setup.");
    return;
    }

    if (!coachId) return;

    const { data, error } = await supabase
      .from("coaches")
      .update({
        visible_name: visibleName,
        default_hourly_rate: Number(defaultHourlyRate),
        bio: bio || null,
        phone_number: phoneNumber,
        preferred_invoice_delivery: preferredInvoiceDelivery,
        preferred_communication: preferredCommunication,
        setup_completed: true,
        sms_consent: coachSmsConsent,
        sms_consent_at: coachSmsConsent ? new Date().toISOString() : null,
        sms_consent_source: coachSmsConsent ? "coach_onboarding" : null,
      })
      .eq("id", coachId)
      .select();

    if (error) {
      console.log("Onboarding save error:", error);
      return;
    }

    await supabase
      .from("notifications")
      .delete()
      .eq("profile_id", profileId)
      .eq("type", "onboarding");

    // remove onboarding notification locally
    setNotifications((prev) =>
      prev.filter(
        (notification) => notification.type !== "onboarding"
      )
    );

    queryClient.invalidateQueries({ queryKey: ["coach-rates", coachId] });
    setShowOnboarding(false);
  }

  async function handleSkipOnboarding() {
    setShowOnboarding(false);
  }

  function openAddLesson() {
    if (coachRatesData?.default_hourly_rate) {
      setHourlyRate(String(coachRatesData.default_hourly_rate));
    }
    setDurationMinutes(String(settings.defaultLessonDuration));
    setShowAddLesson(true);
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

  function formatMoney(amount: any) {
    return Number(amount || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
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

    if (isSubmitting) return;
    setIsSubmitting(true);

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
      } else {
        const calculatedRate = Number(hourlyRate) * (Number(durationMinutes) / 60);

        const { error: lessonError } = await supabase.from("lessons").insert({
          coach_id: coachId,
          student_id: finalStudentId,
          lesson_date: lessonDate,
          start_time: startTime,
          duration_minutes: Number(durationMinutes),
          lesson_type: lessonType || null,
          hourly_rate: Number(hourlyRate),
          rate: calculatedRate,
          notes: notes || null,
        });

        if (lessonError) {
          console.log("Lesson create error:", lessonError);
          return;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
      queryClient.invalidateQueries({ queryKey: ["coach-students", coachId] });

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
      setIsSubmitting(false)
    }
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

    setShowEditLesson(true);
  }

  function closeEditLesson() {
    setShowEditLesson(false);
    setEditingLesson(null);

    setStudentName("");
    setSelectedStudentId(null);
    setLessonDate("");
    setStartTime("");
    setDurationMinutes(String(settings.defaultLessonDuration));
    setLessonType("");
    setHourlyRate("");
    setNotes("");
  }

  async function handleUpdateLesson(e: any) {
    e.preventDefault();

    if (isSaving) return;
    setIsSaving(true);

    try {

      if (!editingLesson || !coachId) return;

      const calculatedRate =
        Number(hourlyRate) * (Number(durationMinutes) / 60);

      const { error } = await supabase
        .from("lessons")
        .update({
          lesson_date: lessonDate,
          start_time: startTime,
          duration_minutes: Number(durationMinutes),
          lesson_type: lessonType || null,
          hourly_rate: Number(hourlyRate),
          rate: calculatedRate,
          notes: notes || null,
        })
        .eq("id", editingLesson.id)
        .eq("coach_id", coachId);

      if (error) {
        console.log("Update dashboard lesson error:", error);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
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
        console.log("Delete dashboard lesson error:", error);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["lessons", coachId] });
      queryClient.invalidateQueries({ queryKey: ["invoices", coachId] });
      closeEditLesson();

    } finally {
      setIsDeleting(false)
    }

    
  }

  function getLocalToday() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const today = getLocalToday();

  const todayLessons = lessons.filter(
    (lesson) => lesson.lesson_date === today
  );

  const upcomingTodayLessons = todayLessons
  .filter((lesson) => getLessonStatus(lesson) === "upcoming")
  .sort((a, b) => {
    const dateA = new Date(`${a.lesson_date}T${a.start_time}`);
    const dateB = new Date(`${b.lesson_date}T${b.start_time}`);

    return dateA.getTime() - dateB.getTime();
  });

  const todayEarnings = todayLessons.reduce(
    (total, lesson) => total + Number(lesson.rate || 0),
    0
  );

  const todayDate = new Date();

  const day = todayDate.getDay();

  const diffToMonday = day === 0 ? -6 : 1 - day;

  const weekStart = new Date(todayDate);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(todayDate.getDate() + diffToMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setHours(23, 59, 59, 999);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekLessons = lessons.filter((lesson) => {
    const lessonDate = new Date(`${lesson.lesson_date}T00:00:00`);
    return lessonDate >= weekStart && lessonDate <= weekEnd;
  });

  const weekEarnings = weekLessons.reduce(
    (total, lesson) => total + Number(lesson.rate || 0),
    0
  );
  const weekUnbilledLessons = weekLessons.filter(
    (lesson) => lesson.billing_status === "unbilled" || !lesson.billing_status
  );

  const weekPendingInvoices = invoices.filter(
    (invoice) => invoice.status === "unbilled"
  );
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

  const studentMatches =
  studentName.trim().length > 0
    ? coachStudents.filter((link: any) =>
        link.students?.student_name
          ?.toLowerCase()
          .includes(studentName.trim().toLowerCase())
      )
    : [];

    const recentInvoices = [...invoices]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )
      .slice(0, 3);

    const unpaidInvoices = invoices.filter(
      (invoice) => invoice.status === "unbilled" || invoice.status === "billed"
    );

    const paidInvoices = invoices.filter(
      (invoice) => invoice.status === "paid"
    );

    const totalUnpaid = unpaidInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0
    );

    const totalPaid = paidInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0
    );

    function formatStatus(status: string | null) {
      if (!status) return "No status";

      return status.charAt(0).toUpperCase() + status.slice(1);
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

  function formatUSPhoneInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);

    if (digits.length <= 3) return digits;
    if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    }

    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
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

          {shouldShow && (
            <InstallBanner
              onOpenGuide={() => setShowInstallGuide(true)}
              onDismiss={remindLater}
            />
          )}

          <button
            ref={addLessonCardRef}
            className={`add-lesson-card ${
              showDashboardTutorial && dashboardTutorialStep === 1
                ? "dashboard-tutorial-highlighted"
                : ""
            }`}
            aria-disabled={showDashboardTutorial}
            onClick={(e) => {
              if (showDashboardTutorial) {
                e.preventDefault();
                return;
              }

              openAddLesson();
            }}
          >
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
              <button onClick={() => navigate("/lessons")}>View lessons</button>
            </div>

            <div className="today-stats">
              <div>
                <strong>{todayLessons.length}</strong>
                <p>Lessons<br />Today</p>
              </div>

              <span className="divider" />

              <div>
                <strong>{formatMoney(todayEarnings)}</strong>
                <p>Earned</p>
              </div>

              <span className="divider" />

              <div>
                <strong>  {
                  upcomingTodayLessons.length
                }</strong>
                <p>Upcoming</p>
              </div>
            </div>
          </section>

          <section className="stat-card">
            <h3>This Week</h3>

            <div className="week-stats">
              <div>
                <strong className="purple">{formatMoney(weekEarnings)}</strong>
                <p>Earnings</p>
              </div>

              <span className="divider" />

              <div>
                <strong>{weekLessons.length}</strong>
                <p>Lessons</p>
              </div>

              <span className="divider" />

              <div>
                <strong className="orange">{weekUnbilledLessons.length}</strong>
                <p>Unbilled</p>
              </div>

              <span className="divider" />

              <div>
                <strong className="red">{weekPendingInvoices.length}</strong>
                <p>Invoices<br />Pending</p>
              </div>
            </div>
          </section>

          <section className="dashboard-section">
            <h3>Upcoming</h3>

            {todayLessons
              .filter((lesson) => getLessonStatus(lesson) === "upcoming")
              .sort((a, b) => {
                const dateA = new Date(
                  `${a.lesson_date}T${a.start_time}`
                );

                const dateB = new Date(
                  `${b.lesson_date}T${b.start_time}`
                );

                return dateA.getTime() - dateB.getTime();
              }).length === 0 ? (
              <p className="empty-lessons">
                No upcoming lessons for today.
              </p>
            ) : (
              <div className="lesson-list">
                {todayLessons
                  .filter(
                    (lesson) => getLessonStatus(lesson) === "upcoming"
                  )
                  .sort((a, b) => {
                    const dateA = new Date(
                      `${a.lesson_date}T${a.start_time}`
                    );

                    const dateB = new Date(
                      `${b.lesson_date}T${b.start_time}`
                    );

                    return dateA.getTime() - dateB.getTime();
                  })
                  .map((lesson, index, array) => {
                    const lessonStart = new Date(
                      `${lesson.lesson_date}T${lesson.start_time}`
                    );

                    const now = new Date();

                    const diffMs =
                      lessonStart.getTime() - now.getTime();

                    const totalMinutes = Math.max(
                      0,
                      Math.floor(diffMs / 60000)
                    );

                    const hours = Math.floor(totalMinutes / 60);
                    const minutes = totalMinutes % 60;

                    let timeUntil = "";

                    if (hours > 0) {
                      timeUntil = `In ${hours}h ${minutes}m`;
                    } else {
                      timeUntil = `In ${minutes} min`;
                    }

                    return (
                      <div
                        key={lesson.id}
                        className={`lesson-row ${
                          index === array.length - 1 ? "last" : ""
                        }`}
                      >
                        <div className="lesson-time">
                          <strong>
                            {formatTime(lesson.start_time)}
                          </strong>

                          <span>Today</span>
                        </div>

                        <div className="lesson-info">
                          <strong>
                            {lesson.students?.student_name ||
                              "Student"}
                          </strong>

                          <span>
                            {lesson.duration_minutes} min • {formatMoney(lesson.rate)}
                          </span>
                        </div>

                        <div className="lesson-status purple-bg">
                          {timeUntil}
                        </div>
                        <button
                          type="button"
                          className="dashboard-row-edit-btn"
                          onClick={() => openEditLesson(lesson)}
                        >
                          <FaChevronRight />
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </section>

          <section className="dashboard-section">
            <div className="section-title-row">
              <h3>Recent Invoices</h3>

              <button type="button" onClick={() => navigate("/invoices")}>
                View all
              </button>
            </div>

            {recentInvoices.length === 0 ? (
              <p className="empty-lessons">
                No invoices yet.
              </p>
            ) : (
              <>
                {recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="invoice-card">
                    <div className="invoice-avatar">
                      {invoice.students?.student_name
                        ? invoice.students.student_name.charAt(0).toUpperCase()
                        : "I"}
                    </div>

                    <div className="invoice-info">
                      <strong>{invoice.students?.student_name || "Student"}</strong>
                      <span className="invoice-info-number">{invoice.invoice_number || "Invoice"}</span>
                      <span className="invoice-info-price">{formatMoney(invoice.total)}</span>
                    </div>

                    <div className="invoice-price">
                      {formatMoney(invoice.total)}
                    </div>
                    <div className={`invoice-status ${invoice.status || "unbilled"}`}>
                      {formatStatus(invoice.status)}
                    </div>
                    <FaChevronRight
                      className="row-arrow"
                      onClick={() => navigate("/invoices")}
                    />
                  </div>
                ))}
              </>
            )}
          </section>

        </div>
      </div>

      <nav className="bottom-nav">
        <div className="nav-item active" onClick={() => navigate("/dashboard")}>
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

        <div className="nav-item" onClick={() => navigate("/invoices")}>
          <FaFileInvoiceDollar />
          <span>Invoices</span>
        </div>

        <div className="nav-item" onClick={() => navigate("/more")}>
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

            <div onClick={()=>{navigate("/profile")}} className="side-menu-user">
              <div className="side-menu-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Coach avatar" />
                ) : (
                  fullName ? fullName.charAt(0).toUpperCase() : "B"
                )}
              </div>

              <div>
                <strong>{fullName || "Billio User"}</strong>
                <span>Coach account</span>
              </div>
            </div>

            <nav className="side-menu-links">
              <a
                onClick={() => {
                  navigate("/dashboard");
                  setMenuOpen(false);
                }}
              >
                Dashboard
              </a>

              <a
                onClick={() => {
                  navigate("/lessons");
                  setMenuOpen(false);
                }}
              >
                Lessons
              </a>

              <a
                onClick={() => {
                  navigate("/students");
                  setMenuOpen(false);
                }}
              >
                Students
              </a>

              <a
                onClick={() => {
                  navigate("/invoices");
                  setMenuOpen(false);
                }}
              >
                Invoices
              </a>

              <a
                onClick={() => {
                  navigate("/settings");
                  setMenuOpen(false);
                }}
              >
                Settings
              </a>
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
                    onClick={() => markNotificationAsRead(notification)}
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
                          deleteNotification(notification.id, notification.type);
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

      {showOnboarding && (
        <div className="onboarding-overlay">
          <div className="onboarding-card">
            <img
              className="onboarding-logo"
              src="/logo.png"
              alt="Billio logo"
            />

            <img
              className="onboarding-image"
              src="/onboarding_logo.png"
              alt="Coach onboarding"
            />

            <h2>Set up your coaching profile</h2>

            <p>
              Add a few details so Billio can help calculate lessons and billing
              faster.
            </p>

            <form
              onSubmit={handleSaveOnboarding}
              className="onboarding-form"
            >
              <div className="input-block">
                <label htmlFor="visibleName">
                  Visible Coach Name
                </label>

                <input
                  id="visibleName"
                  type="text"
                  value={visibleName}
                  onChange={(e) => setVisibleName(e.target.value)}
                  placeholder="Example: John Cool"
                  required
                />
              </div>

              <div className="input-block">
                <label htmlFor="defaultHourlyRate">
                  Default Hourly Rate
                </label>

                <div className="currency-input">
                  <span>$</span>

                  <input
                    id="defaultHourlyRate"
                    type="number"
                    value={defaultHourlyRate}
                    onChange={(e) => setDefaultHourlyRate(e.target.value)}
                    placeholder="100"
                    required
                  />
                </div>
              </div>

              <div className="input-block">
                <label>Billio Notifications</label>
                <p className="onboarding-field-note">
                  How should Billio contact you?
                </p>

                <div className="onboarding-choice-group">
                  {["email", "text", "both"].map((choice) => {
                    const isLocked = !isPro && (choice === "text" || choice === "both");
                    return (
                      <div key={choice} className="lock-wrapper">
                        <button
                          type="button"
                          className={`onboarding-choice ${preferredCommunication === choice ? "active" : ""}${isLocked ? " pro-locked-choice" : ""}`}
                          onClick={() => !isLocked && setPreferredCommunication(choice)}
                          disabled={isLocked}
                        >
                          {choice === "email" ? "Email" : choice === "text" ? "Text Message" : "Email + Text"}
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
              </div>

              <div className="input-block">
                <label>Invoice Delivery</label>
                <p className="onboarding-field-note">
                  How should invoices be sent to students?
                </p>

                <div className="onboarding-choice-group">
                  {["email", "text", "both"].map((choice) => {
                    const isLocked = !isPro && (choice === "text" || choice === "both");
                    return (
                      <div key={choice} className="lock-wrapper">
                        <button
                          type="button"
                          className={`onboarding-choice ${preferredInvoiceDelivery === choice ? "active" : ""}${isLocked ? " pro-locked-choice" : ""}`}
                          onClick={() => !isLocked && setPreferredInvoiceDelivery(choice)}
                          disabled={isLocked}
                        >
                          {choice === "email" ? "Email" : choice === "text" ? "Text Message" : "Email + Text"}
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
              </div>

              <div className="input-block">
                <label htmlFor="phoneNumber">
                  Phone Number
                </label>

                <input
                  id="phoneNumber"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(formatUSPhoneInput(e.target.value))}
                  placeholder="(719) 123-4567"
                  required
                />
                <label className="sms-consent-checkbox">
                  <input
                    type="checkbox"
                    checked={coachSmsConsent}
                    onChange={(e) => setCoachSmsConsent(e.target.checked)}
                  />

                  <span>
                    I agree to receive transactional SMS messages from Billio about my account,
                    invoice review reminders, billing notifications, and coaching-related app
                    updates. Message frequency varies. Message and data rates may apply. Reply
                    STOP to opt out. Reply HELP for help.{" "}
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
                <label htmlFor="bio">
                  Bio (Optional)
                </label>

                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell students a little about yourself..."
                  rows={4}
                />
              </div>

              <button type="submit">
                Finish Setup
              </button>

              <button
                type="button"
                className="onboarding-skip"
                onClick={handleSkipOnboarding}
              >
                Skip for now
              </button>
            </form>
          </div>
        </div>
      )}

      {showAddLesson && (
        <div
          className="add-lesson-overlay"
          onClick={closeAddLesson}
        >
          <div
            className="add-lesson-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="add-lesson-header">
              <h2>Add Lesson</h2>
              <button type="button" onClick={closeAddLesson}>
                ×
              </button>
            </div>

            <form onSubmit={handleCreateLesson} autoComplete="off" className="add-lesson-form">
              <div className="input-block student-search-block">
                <label>Student Name</label>
                <input
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
                <label>Lesson Date</label>
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
                <label>Lesson Type</label>
                <input
                  type="text"
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                  placeholder="Optional"
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
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
                    <label>End Date</label>
                    <input
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

              <button type="submit" className="save-lesson-btn" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : isRecurring ? "Create Recurring Lesson" : "Save Lesson"}
              </button>
            </form>
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
              <h2>Edit Lesson</h2>
              <button type="button" onClick={closeEditLesson}>
                ×
              </button>
            </div>

            <form onSubmit={handleUpdateLesson} className="add-lesson-form">
              <div className="input-block">
                <label>Student Name</label>
                <input
                  type="text"
                  value={studentName}
                  disabled
                />
              </div>

              <div className="input-block">
                <label>Lesson Date</label>
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
                <label>Lesson Type</label>
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <button type="submit" className="save-lesson-btn" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Lesson"}
              </button>
              <button
                type="button"
                className="delete-lesson-btn"
                disabled={isDeleting}
                onClick={() => handleDeleteLesson(editingLesson.id)}
              >
                {isDeleting ? "Deleting..." : "Delete Lesson"}
              </button>
            </form>
          </div>
        </div>
      )}
      {showInstallGuide && (
        <InstallGuide onClose={() => setShowInstallGuide(false)} />
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

      {showDashboardTutorial && (
        <>
          <div
            className="dashboard-tutorial-overlay"
            style={dashboardTutorialStep === 1 ? { background: "transparent" } : undefined}
          />

          {dashboardTutorialStep === 1 && addLessonSpotlightRect && (
            <div
              className="dashboard-tutorial-spotlight"
              style={{
                top: addLessonSpotlightRect.top,
                left: addLessonSpotlightRect.left,
                width: addLessonSpotlightRect.width,
                height: addLessonSpotlightRect.height,
              }}
            />
          )}

          <div className="dashboard-tutorial-card">
            <div className="dashboard-tutorial-icon-wrap">
              {dashboardTutorialSteps[dashboardTutorialStep].icon}
            </div>

            <h2 className="dashboard-tutorial-title">
              {dashboardTutorialSteps[dashboardTutorialStep].title}
            </h2>

            <p className="dashboard-tutorial-text">
              {dashboardTutorialSteps[dashboardTutorialStep].text}
            </p>

            <ul className="dashboard-tutorial-list">
              {dashboardTutorialSteps[dashboardTutorialStep].items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>

            <div className="dashboard-tutorial-dots">
              {dashboardTutorialSteps.map((_, index) => (
                <span
                  key={index}
                  className={`dashboard-tutorial-dot ${
                    index === dashboardTutorialStep
                      ? "dashboard-tutorial-dot-active"
                      : ""
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              className="dashboard-tutorial-btn-primary"
              onClick={advanceDashboardTutorial}
            >
              {dashboardTutorialStep === dashboardTutorialSteps.length - 1
                ? "Finish"
                : "Next →"}
            </button>

            <button
              type="button"
              className="dashboard-tutorial-btn-skip"
              onClick={dismissDashboardTutorial}
            >
              Skip tutorial
            </button>
          </div>
        </>
      )}

    </div>
  );
}

export default Dashboard;