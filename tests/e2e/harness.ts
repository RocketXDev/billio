// Runs the real Billio app (Vite dev server) in Chromium against
// FakeSupabase. VITE_SUPABASE_URL points at an unresolvable host, so even a
// request the interceptor missed can never reach the real project.

import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { FakeSupabase, sessionFor, type Row } from "./fakeSupabase.ts";

const SUPABASE_HOST = "supabase.e2e.invalid";
const PORT = 5199;
export const BASE_URL = `http://localhost:${PORT}`;

// Frozen "now" for the browser: Wednesday, Oct 14 2026, 10:00 Denver time.
export const TODAY = "2026-10-14";
const NOW = new Date("2026-10-14T10:00:00-06:00");

let server: ViteDevServer | null = null;
let browser: Browser | null = null;

export async function startHarness() {
  process.env.VITE_SUPABASE_URL = `http://${SUPABASE_HOST}`;
  process.env.VITE_SUPABASE_ANON_KEY = "e2e-anon-key";
  server = await createServer({
    root: new URL("../..", import.meta.url).pathname,
    logLevel: "error",
    server: { port: PORT, strictPort: true },
  });
  await server.listen();
  browser = await chromium.launch();
}

export async function stopHarness() {
  await browser?.close();
  await server?.close();
}

export type AppSession = {
  page: Page;
  fake: FakeSupabase;
  browserDialogs: string[];
  pageErrors: string[];
  goto: (path: string) => Promise<void>;
  // Client-side navigation (keeps the React Query cache, like clicking a link).
  navigate: (path: string) => Promise<void>;
  close: () => Promise<void>;
};

// `storage` overrides the default localStorage flags (null = leave unset).
export async function openApp(
  fake: FakeSupabase,
  path: string,
  options: { storage?: Record<string, string | null> } = {}
): Promise<AppSession> {
  const context = await browser!.newContext({
    viewport: { width: 1280, height: 900 },
    timezoneId: "America/Denver",
  });
  await context.clock.setFixedTime(NOW);

  const session = sessionFor(fake.user);
  await context.addInitScript(
    ({ session, overrides }) => {
      // Only on the tab's first load, so a test can reload and see what the
      // app itself persisted.
      if (sessionStorage.getItem("e2e-initialised")) return;
      sessionStorage.setItem("e2e-initialised", "1");
      const flags: Record<string, string | null> = {
        "sb-supabase-auth-token": JSON.stringify(session),
        billio_dashboard_tutorial_seen: "1",
        billio_lessons_tutorial_seen: "1",
        billio_students_tutorial_seen: "1",
        billio_invoices_tutorial_seen: "1",
        billio_more_tutorial_seen: "1",
        billio_tutorial_reset_notification_deleted: "1",
        billio_install_dismissed: JSON.stringify({ until: Date.now() + 1e12 }),
        ...overrides,
      };
      for (const [key, value] of Object.entries(flags)) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    },
    { session, overrides: options.storage ?? {} }
  );

  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === SUPABASE_HOST) return fake.handle(route);
    if (url.hostname === "localhost") return route.continue();
    return route.abort(); // fonts, analytics — keep the run hermetic
  });

  const page = await context.newPage();
  const browserDialogs: string[] = [];
  const pageErrors: string[] = [];
  page.on("dialog", (dialog) => {
    browserDialogs.push(`${dialog.type()}: ${dialog.message()}`);
    dialog.dismiss().catch(() => {});
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const goto = async (p: string) => {
    await page.goto(BASE_URL + p);
  };
  const navigate = async (p: string) => {
    await page.evaluate((target) => {
      window.history.pushState({}, "", target);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, p);
  };

  await goto(path);
  return { page, fake, browserDialogs, pageErrors, goto, navigate, close: () => context.close() };
}

// ── Seed data ───────────────────────────────────────────────────────────────

export const USER = {
  id: "user-1",
  aud: "authenticated",
  role: "authenticated",
  email: "coach@example.com",
  user_metadata: { full_name: "Signup Name", role: "coach", profession: "coach" },
  app_metadata: { provider: "email" },
  created_at: "2026-01-01T00:00:00Z",
};

const student = (id: string, name: string, extra: Row = {}) => ({
  id, student_name: name, active: true, email: null, phone_number: null,
  parent_name: null, parent_email: null, parent_phone: null, notes: null, ...extra,
});

const lesson = (id: string, studentId: string, date: string, time: string, extra: Row = {}) => ({
  id, coach_id: "coach-1", student_id: studentId, lesson_date: date, start_time: `${time}:00`,
  duration_minutes: 60, lesson_type: null, hourly_rate: 60, rate: 60, billing_status: "unbilled",
  notes: null, is_recurring: false, recurring_series_id: null, recurring_occurrence_date: null,
  group_lesson_id: null, ...extra,
});

// Mon/Wed 16:00 group class, Oct 1 – Nov 30, roster s4 + s5.
export const GROUP_CLASS = {
  id: "group-1", coach_id: "coach-1", title: "Teen Squad", lesson_type: "Teen Squad",
  start_time: "16:00:00", duration_minutes: 60, billing_mode: "per_student", rate_amount: 40,
  frequency: "weekly", days_of_week: ["monday", "wednesday"], start_date: "2026-10-01",
  end_date: "2026-11-30", notes: null, active: true,
};

function groupScheduleRows() {
  const rows: Row[] = [];
  for (let d = new Date("2026-10-01T00:00:00"); d <= new Date("2026-11-30T00:00:00"); d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 1 && d.getDay() !== 3) continue;
    const date = d.toLocaleDateString("en-CA");
    for (const sid of ["student-4", "student-5"]) {
      // A coach moved Oct 21 for student-5 to 18:00 — a one-off change.
      if (date === "2026-10-21" && sid === "student-5") continue;
      rows.push(lesson(`gl-${date}-${sid}`, sid, date, "16:00", {
        group_lesson_id: "group-1", is_recurring: true, hourly_rate: 40, rate: 40,
        // Oct 19 for student-4 is already invoiced.
        billing_status: date === "2026-10-19" && sid === "student-4" ? "billed" : "unbilled",
      }));
    }
  }
  rows.push(lesson("gl-moved", "student-5", "2026-10-21", "18:00", { group_lesson_id: "group-1", is_recurring: true, rate: 40 }));
  // Friday session attached to the class from the Lessons page ("Make Group").
  rows.push(lesson("gl-oneoff-4", "student-4", "2026-10-23", "17:00", { group_lesson_id: "group-1", rate: 40 }));
  rows.push(lesson("gl-oneoff-5", "student-5", "2026-10-23", "17:00", { group_lesson_id: "group-1", rate: 40 }));
  return rows;
}

export function seedWorld(options: { withProfile?: boolean } = {}) {
  const withProfile = options.withProfile ?? true;
  const students = [
    student("student-1", "Ava Parker"),
    student("student-2", "Liam Chen", { parent_name: "Grace Chen", parent_phone: "(555) 010-2000", parent_email: "grace@example.com" }),
    student("student-3", "Mia Chen", { parent_name: "Grace Chen", parent_phone: "555-010-2000", parent_email: "grace@example.com" }),
    student("student-4", "Noah Diaz"),
    student("student-5", "Zoe Diaz"),
  ];
  const lessons = [
    lesson("lesson-today", "student-1", TODAY, "15:00"),
    lesson("lesson-oct20", "student-1", "2026-10-20", "15:00"),
    lesson("lesson-nov10", "student-1", "2026-11-10", "15:00"),
    lesson("lesson-dec01", "student-1", "2026-12-01", "15:00"),
    lesson("lesson-liam", "student-2", "2026-10-05", "14:00"),
    lesson("lesson-mia", "student-3", "2026-10-05", "15:00"),
    lesson("lesson-mia-2", "student-3", "2026-10-06", "15:00"),
    ...groupScheduleRows(),
  ];

  return new FakeSupabase(USER, {
    profiles: withProfile
      ? [{ id: "profile-1", user_id: USER.id, full_name: "Edited Name", email: "edited@example.com", role: "coach", avatar_url: null }]
      : [],
    coaches: withProfile
      ? [{
          id: "coach-1", profile_id: "profile-1", active: true, setup_completed: true, plan: "pro",
          profession: "coach", lesson_term_singular: "Lesson", lesson_term_plural: "Lessons",
          default_hourly_rate: 60, custom_rates: [], invoice_timezone: "America/Denver", avatar_url: null,
          visible_name: "Coach Edited", bio: null, phone_number: null, preferred_communication: "email",
          stripe_subscription_id: "sub_e2e", subscription_period_end: null, referral_code: "E2ECODE",
          dashboard_widgets: null, default_lesson_duration: 60, default_due_date_days: 7, invoice_prefix: "INV",
          time_format: "12h", lesson_reminders_enabled: false, lesson_reminder_offsets: [],
          invoice_generation_frequency: "weekly", invoice_generation_day: 1, invoice_generation_day_of_month: 1,
          invoice_generation_time: "15:00", invoice_review_day: 0, invoice_review_time: "15:05",
          auto_invoice_enabled: false, auto_invoice_frequency: "weekly", auto_invoice_day: 1,
          auto_invoice_day_of_month: 1, auto_invoice_time: "09:00", invoice_delivery_method: "email",
          auto_generate_pdf: false,
        }]
      : [],
    students,
    coach_students: students.map((s, i) => ({
      id: `cs-${i + 1}`, coach_id: "coach-1", student_id: s.id, lesson_reminders_enabled: false,
      invoice_contact_target: "parent", invoice_delivery_method: "email", auto_generate_pdf: false,
    })),
    lessons,
    invoices: [
      { id: "invoice-liam", coach_id: "coach-1", student_id: "student-2", invoice_number: "INV-1001", status: "unbilled",
        total: 60, issue_date: "2026-10-06", due_date: "2026-10-13", period_start: "2026-10-05", period_end: "2026-10-05",
        invoice_group_id: null, pdf_path: null, notes: null },
      { id: "invoice-mia", coach_id: "coach-1", student_id: "student-3", invoice_number: "INV-1002", status: "unbilled",
        total: 120, subtotal: 120, issue_date: "2026-10-06", due_date: "2026-10-13", period_start: "2026-10-05", period_end: "2026-10-05",
        invoice_group_id: null, pdf_path: null, notes: null },
    ],
    invoice_lessons: [
      { id: "il-1", invoice_id: "invoice-liam", lesson_id: "lesson-liam" },
      { id: "il-2", invoice_id: "invoice-mia", lesson_id: "lesson-mia" },
      { id: "il-3", invoice_id: "invoice-mia", lesson_id: "lesson-mia-2" },
    ],
    notifications: [],
    group_lessons: [GROUP_CLASS],
    group_lesson_students: [
      { id: "gls-1", group_lesson_id: "group-1", student_id: "student-4" },
      { id: "gls-2", group_lesson_id: "group-1", student_id: "student-5" },
    ],
    recurring_lessons: [],
    events: [],
    event_invoices: [
      { id: "draft-1", user_id: USER.id, invoice_number: "EV-1", event_name: "Spring Show", client_name: "City Rink",
        total: 250, status: "draft", created_at: "2026-10-01T12:00:00Z" },
    ],
    invoice_brand_settings: [],
    google_calendar_pending_imports: [],
    payment_reminder_tokens: [],
  });
}
