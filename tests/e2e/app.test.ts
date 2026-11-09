// End-to-end regression tests: the real app in Chromium against FakeSupabase.
// Run with `npm run test:e2e` (see package.json).

import { after, afterEach, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { openApp, seedWorld, startHarness, stopHarness, TODAY, type AppSession } from "./harness.ts";

let app: AppSession | null = null;

before(startHarness);
after(stopHarness);
afterEach(async () => {
  if (!app) return;
  const { fake, browserDialogs, pageErrors } = app;
  await app.close();
  app = null;
  assert.deepEqual(fake.internalErrors, [], "the fake backend saw a request it could not serve");
  assert.deepEqual(browserDialogs, [], "a native browser alert/confirm was shown");
  assert.deepEqual(pageErrors, [], "uncaught page errors");
});

const popup = (page: Page) => page.getByRole("alertdialog");

async function waitFor(check: () => boolean, message: string, timeout = 8000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) assert.fail(`timed out: ${message}`);
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function openAddLessonForm(page: Page) {
  await page.locator(".lessons-add-btn").click();
  await page.locator("#studentName").waitFor();
}

// ── Profile ─────────────────────────────────────────────────────────────────

test("Dashboard does not overwrite the coach's edited name and email", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/dashboard");
  await app.page.getByText("Welcome back, Edited").waitFor();
  await app.page.waitForTimeout(500);

  assert.equal(fake.requests("POST", "profiles").length, 0, "no profile upsert on load");
  assert.equal(fake.requests("PATCH", "profiles").length, 0);
  const profile = fake.rows("profiles")[0];
  assert.equal(profile.full_name, "Edited Name");
  assert.equal(profile.email, "edited@example.com");
});

test("A name changed on the Profile page survives returning to the Dashboard", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/profile");
  const nameInput = app.page.locator(".profile-form input[type=text]").first();
  await nameInput.waitFor();
  await app.page.waitForFunction(() => {
    const input = document.querySelector<HTMLInputElement>(".profile-form input[type=text]");
    return input?.value === "Edited Name";
  });
  await nameInput.fill("Renamed Coach");
  await app.page.locator(".profile-save-btn").click();
  await waitFor(() => fake.rows("profiles")[0].full_name === "Renamed Coach", "profile saved");

  await app.goto("/dashboard");
  await app.page.getByText("Welcome back, Renamed").waitFor();
  await app.page.waitForTimeout(500);
  assert.equal(fake.rows("profiles")[0].full_name, "Renamed Coach");
});

test("A brand-new account still gets its profile created from the sign-up details", async () => {
  const fake = seedWorld({ withProfile: false });
  app = await openApp(fake, "/dashboard");
  await waitFor(() => fake.rows("profiles").length > 0 && fake.rows("coaches").length > 0, "profile + coach created");
  await app.page.waitForTimeout(500);

  assert.equal(fake.rows("profiles").length, 1, "exactly one profile, even with React StrictMode double-running effects");
  const profile = fake.rows("profiles")[0];
  assert.equal(profile.full_name, "Signup Name");
  assert.equal(profile.email, "coach@example.com");
  assert.equal(profile.role, "coach");
  assert.equal(fake.rows("coaches").length, 1, "exactly one coach row");
  // The first visit used to sit on the loading screen forever (the identity
  // lookup had cached "no coach yet"), so onboarding never appeared.
  await app.page.locator("#visibleName").waitFor({ timeout: 5000 });
});

// ── Invoices ────────────────────────────────────────────────────────────────

test("Invoices opened right after the Dashboard still offers Combine for siblings", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/dashboard");
  await app.page.getByText("Mia Chen").first().waitFor(); // Dashboard's invoice list has loaded
  await app.page.waitForTimeout(300);

  await app.navigate("/invoices");
  await app.page.locator(".invoice-send-btn").first().waitFor();
  await app.page.locator(".invoice-send-btn").first().click();

  await app.page.getByRole("heading", { name: "Combine Invoices?" }).waitFor({ timeout: 3000 });
  assert.equal(fake.requests("POST", "fn:send-single-invoice").length, 0, "did not send a lone invoice");
});

// ── Group classes ───────────────────────────────────────────────────────────

test("Editing a group class keeps sessions added from the Lessons page", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/group-lessons");
  await app.page.locator(".rl-edit-btn").first().click();
  const title = app.page.getByPlaceholder("e.g. Saturday Group Class");
  await title.fill("Teen Squad Plus");
  await app.page.locator(".invoices-save-btn").click();
  await waitFor(() => fake.rows("group_lessons")[0].title === "Teen Squad Plus", "class saved");
  await waitFor(() => fake.requests("POST", "lessons").length > 0, "sessions regenerated");
  await app.page.waitForTimeout(300);

  const rows = fake.rows("lessons").filter((l) => l.group_lesson_id === "group-1");
  const byId = (id: string) => rows.find((r) => r.id === id);
  const on = (date: string, sid: string) => rows.filter((r) => r.lesson_date === date && r.student_id === sid);

  assert.ok(byId("gl-oneoff-4") && byId("gl-oneoff-5"), "Friday session attached from the Lessons page survives");
  assert.ok(byId("gl-moved"), "an occurrence moved to another time survives");
  assert.equal(on("2026-10-21", "student-5").length, 1, "no extra 16:00 copy next to the moved one");
  assert.equal(on("2026-10-19", "student-4").length, 1, "billed occurrence kept, not duplicated");
  assert.equal(on("2026-10-19", "student-4")[0].billing_status, "billed");
  assert.equal(on("2026-10-07", "student-4").length, 1, "past occurrences untouched");

  // Every remaining Mon/Wed from today has exactly one session per student.
  for (let d = new Date(`${TODAY}T00:00:00`); d <= new Date("2026-11-30T00:00:00"); d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 1 && d.getDay() !== 3) continue;
    const date = d.toLocaleDateString("en-CA");
    for (const sid of ["student-4", "student-5"]) {
      assert.equal(on(date, sid).length, 1, `${date} ${sid}`);
    }
  }
  assert.equal(on("2026-11-02", "student-4")[0].lesson_type, "Teen Squad Plus", "regenerated with the new details");
});

// ── Error popup ─────────────────────────────────────────────────────────────

test("A lesson that fails to save shows a Billio popup and keeps the form filled in", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/lessons");
  const { page } = app;
  await openAddLessonForm(page);
  await page.locator("#studentName").fill("Ava Parker");
  await page.locator("#lessonDate").fill("2026-10-22");
  await page.locator("#startTime").fill("13:00");
  await page.locator("#hourlyRate").fill("60");

  fake.failNext("POST", "lessons");
  await page.locator(".save-lesson-btn").click();

  await popup(page).waitFor();
  assert.equal(await page.locator("#notice-title").innerText(), "Couldn't save the lesson");
  assert.match(await popup(page).innerText(), /E2E simulated failure/);
  assert.equal(await page.locator("#studentName").inputValue(), "Ava Parker", "form kept the coach's input");

  await popup(page).getByRole("button", { name: "OK" }).click();
  await popup(page).waitFor({ state: "detached" });

  // Retrying now succeeds and closes the form.
  await page.locator(".save-lesson-btn").click();
  await waitFor(() => fake.rows("lessons").some((l) => l.lesson_date === "2026-10-22"), "lesson saved on retry");
  await page.locator("#studentName").waitFor({ state: "detached" });
});

test("An empty required field shows the Billio popup, not the browser's bubble", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/lessons");
  const { page } = app;
  await openAddLessonForm(page);
  await page.locator(".save-lesson-btn").click();

  await popup(page).waitFor();
  assert.equal(await page.locator("#notice-title").innerText(), "Check your details");
  assert.match(await popup(page).innerText(), /Please fill in Student Name\./);
  await page.keyboard.press("Escape");
  await popup(page).waitFor({ state: "detached" });
  assert.equal(await page.evaluate(() => document.activeElement?.id), "studentName", "cursor put in the empty field");
  assert.equal(fake.requests("POST", "lessons").length, 0);
});

test("Missing details show the styled warning instead of a browser alert", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/lessons");
  const { page } = app;
  await openAddLessonForm(page);
  // Spaces pass the native `required` check, so the app's own validation runs.
  await page.locator("#studentName").fill("   ");
  await page.locator("#lessonDate").fill("2026-10-22");
  await page.locator("#startTime").fill("13:00");
  await page.locator("#hourlyRate").fill("60");
  await page.locator(".save-lesson-btn").click();

  await popup(page).waitFor();
  assert.equal(await page.locator("#notice-title").innerText(), "Check your details");
  assert.match(await popup(page).innerText(), /Please enter a student name/);
  await page.keyboard.press("Escape");
  await popup(page).waitFor({ state: "detached" });
  assert.equal(fake.requests("POST", "lessons").length, 0);
});

test("A group lesson that fails to save keeps the form open with its students", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/lessons");
  const { page } = app;
  await openAddLessonForm(page);
  await page.locator(".lesson-recurring-toggle-row").first().locator("button, [role=switch], .lesson-recurring-toggle").last().click();
  const studentInput = page.getByPlaceholder("Search or add a student");
  await studentInput.fill("Noah Diaz");
  await page.locator(".group-student-add-btn").click();
  await page.locator(".group-student-chip", { hasText: "Noah Diaz" }).waitFor();
  await page.locator("#lessonDate").fill("2026-10-22");
  await page.locator("#startTime").fill("13:00");
  await page.locator("#hourlyRate").fill("60");

  fake.failNext("POST", "group_lessons");
  await page.locator(".save-lesson-btn").click();

  await popup(page).waitFor();
  assert.equal(await page.locator("#notice-title").innerText(), "Couldn't save the group lesson");
  await popup(page).getByRole("button", { name: "OK" }).click();
  assert.ok(await page.locator(".group-student-chip", { hasText: "Noah Diaz" }).isVisible(), "form still open with the roster");
  assert.equal(fake.requests("POST", "lessons").length, 0, "no orphan lesson rows");
});

test("Unexpected errors in the app show a popup instead of failing silently", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/dashboard");
  await app.page.getByText("Welcome back").waitFor();
  await app.page.evaluate(() => {
    setTimeout(() => {
      Promise.reject(new Error("boom from test"));
    }, 0);
  });
  await popup(app.page).waitFor();
  assert.equal(await app.page.locator("#notice-title").innerText(), "Something went wrong");
  assert.match(await popup(app.page).innerText(), /boom from test/);
  // The test raised this error on purpose; don't fail the global check.
  app.pageErrors.length = 0;
});

test("Deleting a saved PDF invoice asks with Billio's confirm dialog", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/pdf-invoice");
  const { page } = app;
  await page.getByText("Saved invoices").click();
  const del = page.locator(".pdfinv-draft-del").first();
  await del.waitFor();

  await del.click();
  await popup(page).waitFor();
  assert.equal(await page.locator("#notice-title").innerText(), "Delete this saved invoice?");
  await popup(page).getByRole("button", { name: "Cancel" }).click();
  await popup(page).waitFor({ state: "detached" });
  assert.equal(fake.rows("event_invoices").length, 1, "cancel keeps it");

  await del.click();
  await popup(page).getByRole("button", { name: "Delete" }).click();
  await waitFor(() => fake.rows("event_invoices").length === 0, "draft deleted after confirming");
});

// ── Lessons date-range loading ──────────────────────────────────────────────

test("Lessons page loads by month and shows lessons after moving to the next month", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/lessons");
  const { page } = app;
  await page.getByText("Ava Parker • 3:00 PM").first().waitFor();

  const lessonGets = fake.requests("GET", "lessons");
  assert.ok(lessonGets.length > 0);
  for (const r of lessonGets) {
    assert.ok(r.params.getAll("lesson_date").some((v) => v.startsWith("gte.")), "every lessons query is date-bounded");
  }

  // .calendar-top buttons: « year, ‹ month, › month, » year
  await page.locator(".calendar-top button").nth(2).click();
  await page.getByText("November 2026").waitFor();
  await page.locator(".calendar-day-card:not(.muted)").filter({ hasText: /^\s*10\s*$/ }).click();
  await page.getByText("Ava Parker • 3:00 PM").first().waitFor();
  assert.ok(
    fake.requests("GET", "lessons").some((r) => r.params.getAll("lesson_date").includes("gte.2027-01-01")),
    "two months ahead is prefetched in the background"
  );
});

// ── Smoke: every main page renders ──────────────────────────────────────────

test("Every main page renders without crashing", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/dashboard");
  for (const path of [
    "/dashboard", "/lessons", "/students", "/invoices", "/group-lessons", "/recurring-lessons",
    "/profile", "/settings", "/more", "/pdf-invoice", "/earnings-dashboard", "/referrals", "/upgrade", "/timer",
  ]) {
    await app.goto(path);
    await app.page.waitForTimeout(700);
    assert.equal(await app.page.getByText("Billio hit an unexpected error").count(), 0, `${path} crashed`);
    assert.equal(await popup(app.page).count(), 0, `${path} showed an error popup on load`);
  }
});

// ── Shared helpers (student lookup, invoice cleanup, notifications) ─────────

test("A new student typed into the lesson form is created once and reused after", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/lessons");
  const { page } = app;
  const studentsBefore = fake.rows("students").length;

  for (const [name, date] of [["Ruby Stone", "2026-10-22"], ["  ruby STONE ", "2026-10-29"]]) {
    await openAddLessonForm(page);
    await page.locator("#studentName").fill(name);
    await page.locator("#lessonDate").fill(date);
    await page.locator("#startTime").fill("13:00");
    await page.locator("#hourlyRate").fill("60");
    await page.locator(".save-lesson-btn").click();
    await waitFor(() => fake.rows("lessons").some((l) => l.lesson_date === date), `lesson on ${date}`);
    await page.locator("#studentName").waitFor({ state: "detached" });
  }

  const ruby = fake.rows("students").filter((s) => s.student_name.toLowerCase() === "ruby stone");
  assert.equal(ruby.length, 1, "one student, not two");
  assert.equal(fake.rows("students").length, studentsBefore + 1);
  assert.ok(fake.rows("coach_students").some((l) => l.student_id === ruby[0].id && l.coach_id === "coach-1"), "linked to the coach");
  const rubyLessons = fake.rows("lessons").filter((l) => ["2026-10-22", "2026-10-29"].includes(l.lesson_date));
  assert.deepEqual(rubyLessons.map((l) => l.student_id), [ruby[0].id, ruby[0].id]);
});

test("A group lesson with a new and an existing student only creates the new one", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/lessons");
  const { page } = app;
  const studentsBefore = fake.rows("students").length;
  await openAddLessonForm(page);
  await page.locator(".lesson-recurring-toggle-row").first().locator("button, [role=switch], .lesson-recurring-toggle").last().click();
  for (const name of ["noah diaz", "New Kid"]) {
    await page.getByPlaceholder("Search or add a student").fill(name);
    await page.locator(".group-student-add-btn").click();
  }
  await page.locator("#lessonDate").fill("2026-10-22");
  await page.locator("#startTime").fill("13:00");
  await page.locator("#hourlyRate").fill("60");
  await page.locator(".save-lesson-btn").click();
  await waitFor(() => fake.rows("lessons").filter((l) => l.lesson_date === "2026-10-22").length === 2, "two group rows");

  assert.equal(fake.rows("students").length, studentsBefore + 1, "only New Kid was created");
  const ids = fake.rows("lessons").filter((l) => l.lesson_date === "2026-10-22").map((l) => l.student_id);
  assert.ok(ids.includes("student-4"), "existing Noah Diaz reused despite different case");
});

test("Deleting a lesson on the Lessons page re-totals its invoice", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/lessons");
  const { page } = app;
  await page.locator(".calendar-day-card:not(.muted)").filter({ hasText: /^\s*5\s*$/ }).click();
  await page.locator(".calendar-detail-row", { hasText: "Mia Chen" }).locator(".lesson-edit-btn").click();
  await page.locator(".delete-lesson-btn").click();
  await waitFor(() => !fake.rows("lessons").some((l) => l.id === "lesson-mia"), "lesson deleted");

  const invoice = fake.rows("invoices").find((i) => i.id === "invoice-mia")!;
  assert.equal(invoice.total, 60, "total drops from 120 to the remaining lesson");
  assert.equal(invoice.status, "unbilled");
});

test("Deleting a student's only invoiced lesson from the Students page removes the empty invoice", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/students");
  const { page } = app;
  await page.locator(".students-row", { hasText: "Liam Chen" }).first().click();
  const invoiceRow = page.locator(".students-detail-row", { hasText: "INV-1001" });
  await invoiceRow.waitFor();
  await page.locator(".students-detail-row", { hasText: "October 5, 2026" }).first().click();
  await page.locator(".students-lesson-delete-action").click();
  await waitFor(() => !fake.rows("lessons").some((l) => l.id === "lesson-liam"), "lesson deleted");

  assert.ok(!fake.rows("invoices").some((i) => i.id === "invoice-liam"), "invoice with no lessons left is deleted");
  await invoiceRow.waitFor({ state: "detached", timeout: 3000 }); // student's invoice list updates without a reload
  assert.ok(fake.rows("invoices").some((i) => i.id === "invoice-mia"), "other invoices untouched");
});

test("Deleting the 'complete tutorials' notification on desktop keeps it deleted", async () => {
  const fake = seedWorld();
  fake.rows("notifications").push({
    id: "notif-tutorial", profile_id: "profile-1", type: "tutorial_reset", title: "Complete tutorials again",
    message: "Tap here to reset the walkthroughs.", is_read: false, created_at: "2026-10-10T12:00:00Z",
  });
  app = await openApp(fake, "/lessons", { storage: { billio_tutorial_reset_notification_deleted: null } });
  const { page } = app;
  await page.locator(".desktop-bell-btn").click();
  await page.locator(".desktop-notif-item", { hasText: "Complete tutorials again" }).locator(".desktop-notif-delete").click();
  await waitFor(() => fake.rows("notifications").length === 0, "notification deleted");

  await app.goto("/dashboard");
  await page.getByText("Welcome back").waitFor();
  await page.waitForTimeout(500);
  assert.equal(
    fake.rows("notifications").filter((n) => n.type === "tutorial_reset").length, 0,
    "the Dashboard did not re-create it"
  );
});

test("A notification delete the database silently blocks shows an error instead of vanishing", async () => {
  const fake = seedWorld();
  fake.rows("notifications").push({
    id: "notif-blocked", profile_id: "profile-1", type: "tutorial_reset", title: "Complete tutorials again",
    message: "Tap here to reset the walkthroughs.", is_read: false, created_at: "2026-10-10T12:00:00Z",
  });
  fake.silentlyBlocked.add("DELETE notifications"); // RLS without a DELETE policy
  app = await openApp(fake, "/lessons");
  const { page } = app;
  await page.locator(".desktop-bell-btn").click();
  const item = page.locator(".desktop-notif-item", { hasText: "Complete tutorials again" });
  await item.locator(".desktop-notif-delete").click();

  await popup(page).waitFor();
  assert.equal(await page.locator("#notice-title").innerText(), "Couldn't delete the notification");
  assert.match(await popup(page).innerText(), /permission/);
  await popup(page).getByRole("button", { name: "OK" }).click();
  assert.ok(await item.isVisible(), "still listed, because it still exists");
});

// ── Export records ──────────────────────────────────────────────────────────

test("Earnings → Export downloads the lessons and monthly summary CSVs", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/earnings-dashboard");
  const { page } = app;
  await page.locator(".ed-export-entry").click();
  await page.getByRole("dialog", { name: "Export records" }).waitFor();
  assert.equal(await page.locator(".ed-export-period.active").innerText(), "2026", "defaults to this year in October");

  const read = async (buttonText: string) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".ed-export-option", { hasText: buttonText }).click(),
    ]);
    const { readFile } = await import("node:fs/promises");
    return { name: download.suggestedFilename(), text: await readFile((await download.path())!, "utf8") };
  };

  const lessonsCsv = await read("All lessons");
  assert.equal(lessonsCsv.name, "billio-lessons-2026.csv");
  const lines = lessonsCsv.text.replace(/^\uFEFF/, "").trim().split("\r\n");
  const expected = fake.rows("lessons").filter((l) => l.lesson_date.startsWith("2026-")).length;
  assert.equal(lines.length, expected + 1, "header + one row per 2026 lesson");
  assert.match(lines[0], /^Date,Start time,Student,Lesson type,/);
  assert.ok(lines.some((l) => l.startsWith("2026-10-05,14:00,Liam Chen,") && l.includes("INV-1001")), "invoice number included");
  assert.ok(lines.some((l) => l.includes("Teen Squad")), "group class title included");

  const summary = await read("Monthly summary");
  assert.equal(summary.name, "billio-monthly-summary-2026.csv");
  const sLines = summary.text.replace(/^\uFEFF/, "").trim().split("\r\n");
  assert.equal(sLines.length, 1 + 12 + 1, "header, 12 months, total");
  assert.match(sLines.at(-1)!, new RegExp(`^Total,${expected},`));

  // An empty period warns instead of downloading an empty file.
  await page.locator(".ed-export-period", { hasText: "2025" }).click();
  await page.locator(".ed-export-option", { hasText: "Monthly summary" }).click();
  await popup(page).waitFor();
  assert.equal(await page.locator("#notice-title").innerText(), "Nothing to export");
  await popup(page).getByRole("button", { name: "OK" }).click();

  // A backwards custom range is caught before any request.
  await page.locator(".ed-export-period", { hasText: "Custom" }).click();
  await page.locator(".ed-export-dates input").first().fill("2026-12-01");
  await page.locator(".ed-export-dates input").last().fill("2026-01-01");
  const before = fake.requests("GET", "lessons").length;
  await page.locator(".ed-export-option", { hasText: "All lessons" }).click();
  await popup(page).waitFor();
  assert.match(await popup(page).innerText(), /start date/);
  assert.equal(fake.requests("GET", "lessons").length, before);
});

// ── Announcements ───────────────────────────────────────────────────────────

const announcement = {
  id: "notif-announce", profile_id: "profile-1", type: "announcement:csv-export",
  title: "New: export to a spreadsheet", message: "Download your lessons and earnings as a CSV.",
  link: "/earnings-dashboard", is_read: false, created_at: "2026-10-14T09:00:00Z",
};

test("Tapping an announcement in the desktop bell opens its page and marks it read", async () => {
  const fake = seedWorld();
  fake.rows("notifications").push({ ...announcement });
  app = await openApp(fake, "/lessons");
  const { page } = app;
  await page.locator(".desktop-bell-btn").click();
  // Tap the title — the centre of a desktop item is its trash button.
  await page.locator(".desktop-notif-item strong", { hasText: "New: export to a spreadsheet" }).click();
  await page.waitForURL("**/earnings-dashboard");
  await waitFor(() => fake.rows("notifications")[0].is_read === true, "marked read");
});

test("Tapping an announcement in the phone notification panel opens its page", async () => {
  const fake = seedWorld();
  fake.rows("notifications").push({ ...announcement });
  app = await openApp(fake, "/dashboard");
  const { page } = app;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".dashboard-bell").click();
  await page.locator(".notification-item", { hasText: "New: export to a spreadsheet" }).click();
  await page.waitForURL("**/earnings-dashboard");
  await waitFor(() => fake.rows("notifications")[0].is_read === true, "marked read");
});

// ── Optional Venmo / Zelle ──────────────────────────────────────────────────

test("Settings: optional Venmo/Zelle are cleaned up, previewed and saved", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/settings");
  const { page } = app;
  const venmo = page.getByPlaceholder("your-username");
  await venmo.waitFor();
  assert.equal(await page.locator(".settings-pay-preview").count(), 0, "no preview while empty");

  // An invalid username warns and saves nothing.
  await venmo.fill("anna smith");
  await page.locator(".settings-save-btn").first().click();
  await popup(page).waitFor();
  assert.match(await popup(page).innerText(), /5–30 letters/);
  await popup(page).getByRole("button", { name: "OK" }).click();
  assert.equal(fake.requests("PATCH", "coaches").length, 0);

  await venmo.fill("https://venmo.com/u/Coach-Anna");
  await page.getByPlaceholder("you@email.com or (555) 123-4567").fill("+1 555 010 2000");
  await page.getByPlaceholder("So parents know they're paying the right person").fill("Anna Smith");
  const preview = page.locator(".settings-pay-preview");
  await preview.getByText("Pay $120.00 with Venmo").waitFor();
  assert.match(await preview.innerText(), /@Coach-Anna/);
  assert.match(await preview.innerText(), /\(555\) 010-2000/);

  await page.locator(".settings-save-btn").first().click();
  await waitFor(() => fake.rows("coaches")[0].venmo_handle === "Coach-Anna", "payment details saved");
  const coach = fake.rows("coaches")[0];
  assert.equal(coach.zelle_contact, "(555) 010-2000");
  assert.equal(coach.zelle_name, "Anna Smith");
});

test("Settings still works before the payment columns exist (SQL not run yet)", async () => {
  const fake = seedWorld();
  for (const col of ["venmo_handle", "zelle_contact", "zelle_name"]) fake.missingColumns.add(`coaches.${col}`);
  app = await openApp(fake, "/settings");
  const { page } = app;
  await page.getByText("Payment details aren't available yet.").waitFor();
  await page.locator(".settings-chip", { hasText: "24" }).first().click().catch(() => {});
  await page.locator(".settings-save-btn").first().click();
  await waitFor(() => fake.requests("PATCH", "coaches").length > 0, "other settings saved");
  await page.waitForTimeout(300);
  assert.equal(await popup(page).count(), 0, "no error popup");
});

const payLink = (fake: any, payment: Record<string, unknown> | null) => {
  fake.functionResponses["get-payment-reminder-invoice"] = () => ({
    success: true, already_paid: false, group: null, grandTotal: null, payment,
    invoice: { id: "invoice-liam", invoice_number: "INV-1001", total: 60, status: "unbilled", due_date: "2026-10-13",
      students: { student_name: "Liam Chen" } },
  });
  fake.functionResponses["mark-invoice-paid"] = () => ({
    success: true, invoice: { id: "invoice-liam", invoice_number: "INV-1001", total: 60, students: { student_name: "Liam Chen" } },
  });
};

test("Parent pay link shows Venmo and Zelle when the coach added them", async () => {
  const fake = seedWorld();
  payLink(fake, { coach_name: "Coach Anna", venmo_handle: "Coach-Anna", zelle_contact: "(555) 010-2000", zelle_name: "Anna Smith" });
  app = await openApp(fake, "/pay?token=tok-123");
  const { page } = app;
  await page.getByRole("heading", { name: "Pay Coach Anna" }).waitFor();

  const venmo = page.locator(".pay-option-venmo");
  assert.match(await venmo.innerText(), /Pay \$60\.00 with Venmo/);
  const href = new URL((await venmo.getAttribute("href"))!);
  assert.equal(href.origin + href.pathname, "https://venmo.com/Coach-Anna");
  assert.equal(href.searchParams.get("amount"), "60.00");
  assert.equal(href.searchParams.has("note"), false, "no pre-filled note");
  assert.equal(await venmo.getAttribute("target"), "_blank");

  const zelle = page.locator(".pay-option-zelle");
  assert.match(await zelle.innerText(), /\(555\) 010-2000/);
  assert.match(await zelle.innerText(), /Anna Smith/);
  assert.equal(await zelle.locator(".pay-copy-btn").count(), 2, "copy address + amount");
  assert.doesNotMatch(await page.locator(".pay-options").innerText(), /payment note/, "no note instruction");

  await page.getByRole("button", { name: "✓ I've sent the payment" }).click();
  await page.getByRole("heading", { name: "Invoice Marked as Paid" }).waitFor();
  assert.equal(fake.requests("POST", "fn:mark-invoice-paid").length, 1);
});

test("Parent pay link is unchanged for coaches without Venmo or Zelle", async () => {
  const fake = seedWorld();
  payLink(fake, null);
  app = await openApp(fake, "/pay?token=tok-123");
  const { page } = app;
  await page.getByRole("heading", { name: "Mark Invoice as Paid?" }).waitFor();
  assert.equal(await page.locator(".pay-options").count(), 0);
  await page.getByRole("button", { name: "✓ Yes, mark as paid" }).waitFor();
});

test("Settings: 'include in emails and texts' appears with Venmo/Zelle, is on by default, and can be turned off", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/settings");
  const { page } = app;
  const venmo = page.getByRole("switch", { name: /Venmo/ });
  const zelle = page.getByRole("switch", { name: /Zelle/ });
  await page.getByPlaceholder("your-username").waitFor();
  assert.equal(await venmo.count(), 0, "hidden while no payment details");

  await page.getByPlaceholder("your-username").fill("Coach-Anna");
  await page.getByPlaceholder("you@email.com or (555) 123-4567").fill("anna@example.com");
  await venmo.waitFor({ state: "attached" });
  assert.equal(await venmo.isChecked(), true, "on by default");
  assert.equal(await zelle.isChecked(), true, "on by default");
  assert.equal(await page.getByRole("switch", { name: /Pay online/ }).count(), 0, "no cards set up");

  await page.locator(".settings-pay-switch", { hasText: "Venmo" }).click();
  assert.equal(await page.locator(".settings-pay-preview .pay-option-venmo").count(), 0, "preview follows the switch");
  await page.locator(".settings-save-btn").first().click();
  await waitFor(() => fake.rows("coaches")[0].venmo_handle === "Coach-Anna", "saved");
  const coach = fake.rows("coaches")[0];
  assert.equal(coach.offer_venmo, false);
  assert.equal(coach.offer_zelle, true);
  assert.equal(coach.payment_in_messages, true, "Zelle is still sent");
});

test("Settings: fields are large enough that phones don't zoom in", async () => {
  const fake = seedWorld();
  fake.rows("coaches")[0].zelle_contact = "anna@example.com";
  app = await openApp(fake, "/settings");
  const { page } = app;
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByPlaceholder("your-username").waitFor();
  const sizes: number[] = await page.locator(".settings-page input:not([type=checkbox]):not([type=file]), .settings-page select")
    .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
  assert.ok(sizes.length >= 5, "found the fields");
  assert.deepEqual(sizes.filter((size) => size < 16), []);
});

test("Settings: PayPal can be added and switched off on its own", async () => {
  const fake = seedWorld();
  app = await openApp(fake, "/settings");
  const { page } = app;
  const name = page.getByPlaceholder("The part after paypal.me/");
  await name.waitFor();
  await name.fill("https://paypal.me/CoachAnna");
  const paypal = page.getByRole("switch", { name: /PayPal/ });
  await paypal.waitFor({ state: "attached" });
  assert.equal(await paypal.isChecked(), true, "on by default");
  await page.locator(".settings-pay-preview .pay-option-paypal").waitFor();

  await page.locator(".settings-pay-switch", { hasText: "PayPal" }).click();
  assert.equal(await page.locator(".settings-pay-preview .pay-option-paypal").count(), 0, "preview follows the switch");
  await page.locator(".settings-save-btn").first().click();
  await waitFor(() => fake.rows("coaches")[0].paypal_handle === "CoachAnna", "saved");
  assert.equal(fake.rows("coaches")[0].offer_paypal, false);
});

test("A parent can pay with PayPal from the pay link", async () => {
  const fake = seedWorld();
  payLink(fake, { coach_name: "Coach Anna", paypal_handle: "CoachAnna" });
  app = await openApp(fake, "/pay?token=tok-123");
  const { page } = app;
  const link = page.locator(".pay-option-paypal");
  await link.waitFor();
  assert.match(String(await link.getAttribute("href")), /^https:\/\/paypal\.me\/CoachAnna\/\d+\.\d\dUSD$/);
  await page.getByRole("button", { name: "✓ I've sent the payment" }).waitFor();
});

test("Settings: an active card coach can stop sending Pay online", async () => {
  const fake = seedWorld();
  fake.functionResponses["connect-account"] = (body: any) => ({
    available: true, state: "active", livemode: false, card_payments_on: body.action === "set-card-payments" ? body.on : true,
  });
  app = await openApp(fake, "/settings");
  const { page } = app;
  const card = page.getByRole("switch", { name: /Pay online/ });
  await card.waitFor({ state: "attached" });
  assert.equal(await card.isChecked(), true);
  await page.locator(".settings-pay-switch", { hasText: "Pay online" }).click();
  await page.locator(".settings-save-btn").first().click();
  await waitFor(
    () => fake.requests("POST", "fn:connect-account").some((r: any) => r.body?.action === "set-card-payments" && r.body?.on === false),
    "card choice saved",
  );
});

test("Settings: a coach who hasn't set up cards is pointed to setup", async () => {
  const fake = seedWorld();
  fake.functionResponses["connect-account"] = () => ({ available: true, state: "not_started", livemode: false, card_payments_on: true });
  app = await openApp(fake, "/settings");
  const { page } = app;
  await page.locator(".settings-pay-setup").waitFor();
  assert.equal(await page.getByRole("switch", { name: /Pay online/ }).count(), 0);
  await page.getByRole("button", { name: "Set up", exact: true }).click();
  await waitFor(() => page.url().endsWith("/payments"), "opened Accept Payments");
});

test("Settings: nothing about cards when payments aren't available to the coach", async () => {
  const fake = seedWorld();
  fake.functionResponses["connect-account"] = () => ({ available: false });
  app = await openApp(fake, "/settings");
  const { page } = app;
  await page.getByPlaceholder("your-username").waitFor();
  await waitFor(() => fake.requests("POST", "fn:connect-account").length > 0, "status checked");
  assert.equal(await page.locator(".settings-pay-setup").count(), 0);
  assert.equal(await page.locator(".settings-pay-methods").count(), 0);
});

// ── Onboarding: optional Venmo / Zelle ──────────────────────────────────────

async function fillOnboardingBasics(page: Page) {
  await page.locator("#visibleName").waitFor();
  await page.locator("#visibleName").fill("Coach Anna");
  await page.locator("#defaultHourlyRate").fill("60");
  await page.locator("#phoneNumber").fill("7195550100");
}
const paymentWrites = (fake: any) =>
  fake.requests("PATCH", "coaches").filter((r: any) => r.body && "venmo_handle" in r.body);

test("Onboarding: a new coach can add Venmo and Zelle and keep them in messages", async () => {
  const fake = seedWorld({ withProfile: false });
  app = await openApp(fake, "/dashboard");
  const { page } = app;
  await fillOnboardingBasics(page);
  assert.equal(await page.locator(".onboarding-pay-choices .onboarding-choice.active").innerText(), "Other", "Other is the default");
  assert.equal(await page.locator("#onboardingVenmo").count(), 0, "no fields for Other");

  await page.locator(".onboarding-pay-choices .onboarding-choice", { hasText: "Both" }).click();
  await page.locator("#onboardingVenmo").fill("@Coach-Anna");
  await page.locator("#onboardingZelle").fill("Anna@Example.com");
  await page.locator("#onboardingZelleName").fill("Anna Smith");
  assert.equal(await page.locator(".onboarding-pay-toggle input").isChecked(), true, "include in messages: on by default");
  await page.getByRole("button", { name: "Finish Setup" }).click();

  await waitFor(() => fake.rows("coaches").some((c) => c.venmo_handle === "Coach-Anna"), "payment details saved");
  const coach = fake.rows("coaches").find((c) => c.venmo_handle === "Coach-Anna")!;
  assert.equal(coach.zelle_contact, "anna@example.com");
  assert.equal(coach.zelle_name, "Anna Smith");
  assert.equal(coach.payment_in_messages, true);
  assert.equal(coach.setup_completed, true);
});

test("Onboarding: 'Other' (the default) saves no payment details", async () => {
  const fake = seedWorld({ withProfile: false });
  app = await openApp(fake, "/dashboard");
  const { page } = app;
  await fillOnboardingBasics(page);
  await page.getByRole("button", { name: "Finish Setup" }).click();
  await waitFor(() => fake.rows("coaches").some((c) => c.setup_completed === true), "setup completed");
  await page.waitForTimeout(300);
  assert.equal(paymentWrites(fake).length, 0);
});

test("Onboarding: picking Venmo but leaving it blank still finishes, without a warning", async () => {
  const fake = seedWorld({ withProfile: false });
  app = await openApp(fake, "/dashboard");
  const { page } = app;
  await fillOnboardingBasics(page);
  await page.locator(".onboarding-pay-choices .onboarding-choice", { hasText: "Venmo" }).click();
  await page.getByRole("button", { name: "Finish Setup" }).click();
  await waitFor(() => fake.rows("coaches").some((c) => c.setup_completed === true), "setup completed");
  await page.waitForTimeout(300);
  assert.equal(await popup(page).count(), 0, "no warning for an empty optional field");
  assert.equal(paymentWrites(fake).length, 0);
});

// ── Card payments (More → Payments) ─────────────────────────────────────────

const connectStatus = (state: string, extra: Record<string, unknown> = {}) => ({
  available: true, state, card_payments_on: true, livemode: false, ...extra,
});

// Stands in for Stripe's Connect.js: same custom elements, no network.
const CONNECT_JS_STUB = `
  const setters = ["setOnLoadError", "setOnLoaderStart", "setFullTermsOfServiceUrl", "setRecipientTermsOfServiceUrl",
    "setPrivacyPolicyUrl", "setSkipTermsOfServiceCollection", "setCollectionOptions", "setOnStepChange",
    "setOnSectionOpen", "setOnNotificationsChange", "setDefaultFilters"];
  for (const tag of ["account-onboarding", "account-management", "notification-banner", "balances", "payments", "payouts-list"]) {
    class Stub extends HTMLElement {
      connectedCallback() { this.textContent = "stub " + tag; }
      setConnector() {}
      setOnExitInternalOnly(listener) { window.__connectExit = listener; }
    }
    for (const name of setters) Stub.prototype[name + "InternalOnly"] = function () {};
    customElements.define("stripe-connect-" + tag, Stub);
  }
  window.StripeConnect = { init: (params) => {
    params.fetchClientSecret().then((secret) => { window.__connectSecret = secret; });
    return { connect: () => {}, update: () => {}, logout: async () => {} };
  } };
`;

const CONNECT_JS_URL = "https://connect-js.stripe.com/**";
const stubConnectJs = (page: Page) =>
  page.route(CONNECT_JS_URL, (route) => route.fulfill({ contentType: "text/javascript", body: CONNECT_JS_STUB }));

const connectCalls = (fake: any, action: string) =>
  fake.requests("POST", "fn:connect-account").filter((r: any) => r.body?.action === action);

const openPayments = async (fake: any) => {
  app = await openApp(fake, "/more");
  await stubConnectJs(app.page);
  const row = app.page.locator(".more-card", { hasText: "Accept Payments" });
  await row.waitFor();
  await row.click();
  await app.page.locator(".ref-title", { hasText: "Accept Payments" }).waitFor();
  return app;
};

test("Coaches not on the payments list make no extra requests and never see the page", async () => {
  const fake = seedWorld();
  fake.db.coaches[0].id = "some-other-coach";
  fake.functionResponses["connect-account"] = () => connectStatus("active"); // even if the server said yes
  app = await openApp(fake, "/more");
  const { page, navigate } = app;
  await page.locator(".more-list-item", { hasText: "Settings" }).waitFor();
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".more-card", { hasText: "Accept Payments" }).count(), 0);

  await page.evaluate(() => {
    new MutationObserver(() => {
      if (document.querySelector(".ref-title, .payments-primary-btn")) (window as any).__sawPayments = true;
    }).observe(document.body, { childList: true, subtree: true });
  });
  await navigate("/payments");
  await waitFor(() => page.url().endsWith("/more"), "sent back to More");
  await page.locator(".more-list-item", { hasText: "Settings" }).waitFor();

  assert.equal(await page.evaluate(() => (window as any).__sawPayments ?? false), false, "page never rendered");
  assert.equal(fake.requests("POST", "fn:connect-account").length, 0, "no payments requests");
  const loaded: string[] = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name));
  assert.equal(loaded.filter((url) => url.includes("stripe")).length, 0, "nothing from Stripe");
  assert.equal(await popup(page).count(), 0, "no error popup");
});

test("Payments stays hidden from coaches who aren't allowed, even by URL", async () => {
  const fake = seedWorld();
  fake.functionResponses["connect-account"] = () => ({ available: false });
  app = await openApp(fake, "/more");
  const { page, navigate } = app;
  await page.locator(".more-list-item", { hasText: "Settings" }).waitFor();
  await waitFor(() => connectCalls(fake, "status").length > 0, "status asked");
  await page.waitForTimeout(300);
  assert.equal(await page.locator(".more-card", { hasText: "Accept Payments" }).count(), 0);

  await navigate("/payments");
  await waitFor(() => page.url().endsWith("/more"), "sent back to More");
  assert.equal(await popup(page).count(), 0, "no error popup");
});

test("Payments stays hidden and quiet when the backend isn't deployed yet", async () => {
  const fake = seedWorld();
  // What the app gets today, before the function exists: no `available` field.
  app = await openApp(fake, "/more");
  const { page } = app;
  await page.locator(".more-list-item", { hasText: "Settings" }).waitFor();
  await page.waitForTimeout(400);
  assert.equal(await page.locator(".more-card", { hasText: "Accept Payments" }).count(), 0);
  assert.equal(await popup(page).count(), 0, "no error popup");
});

test("A coach enrolls, finishes with Stripe and can switch cards off", async () => {
  const fake = seedWorld();
  let current = connectStatus("not_started");
  fake.functionResponses["connect-account"] = (body: any) => {
    if (body.action === "enroll") current = connectStatus("onboarding");
    if (body.action === "session") return { client_secret: "cs_e2e" };
    if (body.action === "set-card-payments") current = connectStatus("active", { card_payments_on: body.on });
    return current;
  };
  const { page } = await openPayments(fake);

  const body = page.locator(".ref-body");
  await page.getByRole("button", { name: "Set up card payments" }).waitFor();
  const intro = await body.innerText();
  assert.match(intro, /\$57\.36/, "fee example");
  assert.match(intro, /Venmo and Zelle keep working/, "stays optional");
  assert.doesNotMatch(intro, /\btax/i, "no tax wording");
  assert.match(intro, /Test mode/);
  assert.equal(connectCalls(fake, "session").length, 0, "Stripe isn't loaded until enrolled");

  await page.getByRole("button", { name: "Set up card payments" }).click();
  await page.locator("stripe-connect-account-onboarding").waitFor();
  assert.equal(connectCalls(fake, "enroll").length, 1);
  assert.match(await body.innerText(), /customer support address/, "address tip during setup");
  await page.waitForFunction(() => (window as any).__connectSecret === "cs_e2e");

  // Stripe reports the coach finished; the page re-checks and moves on.
  current = connectStatus("active");
  await page.evaluate(() => (window as any).__connectExit());
  await page.getByText("You're ready to take cards").waitFor();
  await page.locator("stripe-connect-account-management").waitFor();
  await page.locator("stripe-connect-notification-banner").waitFor();
  assert.equal(await page.locator("stripe-connect-account-onboarding").count(), 0);

  const cards = page.getByRole("switch");
  assert.equal(await cards.isChecked(), true);
  await page.locator(".payments-switch").click();
  await waitFor(() => connectCalls(fake, "set-card-payments").length === 1, "saved");
  assert.equal(connectCalls(fake, "set-card-payments")[0].body.on, false);
  await page.locator(".payments-switch input:not(:checked)").waitFor({ state: "attached" });
  assert.equal(await popup(page).count(), 0, "no error popup");
});

test("An active coach sees their balance, payments, withdrawals and total received", async () => {
  const fake = seedWorld();
  const row = (id: string, amount_cents: number, status: string, extra: Record<string, unknown> = {}) => ({
    id, coach_id: "coach-1", amount_cents, refunded_cents: 0, status, needs_review: false, livemode: false,
    created_at: `2026-10-0${id}T12:00:00Z`, ...extra,
  });
  fake.db.invoice_payments = [
    row("1", 6000, "succeeded"),
    row("2", 4000, "partially_refunded", { refunded_cents: 1000 }),
    row("3", 2500, "refunded", { refunded_cents: 2500 }),
    row("4", 1000, "pending"),
    row("5", 5000, "succeeded", { needs_review: true }),
    row("6", 9900, "succeeded", { livemode: true }),
    row("7", 7700, "succeeded", { coach_id: "someone-else" }),
  ];
  fake.functionResponses["connect-account"] = (body: any) =>
    body.action === "session" ? { client_secret: "cs_e2e" } : connectStatus("active");
  const { page } = await openPayments(fake);

  for (const tag of ["balances", "payments", "payouts-list", "account-management"]) {
    await page.locator(`stripe-connect-${tag}`).waitFor();
  }
  const received = await page.locator(".payments-received").innerText();
  assert.match(received, /\$140\.00/, "paid minus refunds, this coach and mode only");
  assert.match(received, /3 payments/);
  await page.getByText("A payment needs your review").waitFor();

  fake.db.invoice_payments = fake.db.invoice_payments.map((p: any) => ({ ...p, application_fee_cents: 60, stripe_fee_cents: 204, paid_at: "2026-10-05T18:00:00Z", invoice_ids: ["invoice-liam"], primary_invoice_id: "invoice-liam" }));
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export with fees (CSV)" }).click()]);
  assert.equal(download.suggestedFilename(), "billio-card-payments.csv");
  assert.equal(await popup(page).count(), 0, "export didn't fail");
  const body = await page.locator(".ref-body").innerText();
  assert.match(body, /Standard transfers are free/);
  assert.doesNotMatch(body, /cost 1%/, "Stripe sets the expedited fee, so the page mustn't promise one");
  assert.match(body, /Stripe keeps its processing fee/);
  assert.doesNotMatch(body, /\btax/i);
});

test("Each Stripe account state shows the right message", async () => {
  for (const [state, text] of [
    ["in_review", "Stripe is reviewing your details"],
    ["action_needed", "Stripe needs a bit more information"],
  ] as const) {
    const fake = seedWorld();
    fake.functionResponses["connect-account"] = (body: any) =>
      body.action === "session" ? { client_secret: "cs_e2e" } : connectStatus(state);
    const { page, close } = await openPayments(fake);
    await page.getByText(text).waitFor();
    await page.locator("stripe-connect-notification-banner").waitFor();
    assert.equal(await page.getByRole("switch").count(), 0, "no card switch until active");
    await close();
  }
  app = null;
});

test("A failed enrollment reports the reason and keeps the coach on the page", async () => {
  const fake = seedWorld();
  fake.functionResponses["connect-account"] = (body: any) =>
    body.action === "enroll" ? { error: "Stripe is having a moment." } : connectStatus("not_started");
  const { page } = await openPayments(fake);
  await page.getByRole("button", { name: "Set up card payments" }).click();
  await popup(page).waitFor();
  assert.match(await popup(page).innerText(), /Couldn't set up card payments/);
  assert.match(await popup(page).innerText(), /Stripe is having a moment/);
  await page.getByRole("button", { name: "OK" }).click();
  await page.getByRole("button", { name: "Set up card payments" }).waitFor();
});

test("If Stripe can't load, the page offers a retry instead of an error popup", async () => {
  const fake = seedWorld();
  fake.functionResponses["connect-account"] = (body: any) =>
    body.action === "session" ? { client_secret: "cs_e2e" } : connectStatus("onboarding");
  const { page } = await openPayments(fake);
  await page.unroute(CONNECT_JS_URL);
  await page.reload();
  const retry = page.getByRole("button", { name: "Try again" });
  await retry.waitFor();
  assert.equal(await popup(page).count(), 0, "no error popup");

  await stubConnectJs(page);
  await retry.click();
  await page.locator("stripe-connect-account-onboarding").waitFor();
});

test("If the status check fails, Payments offers a retry and stays on the page", async () => {
  const fake = seedWorld();
  let fail = false;
  fake.functionResponses["connect-account"] = () => (fail ? { error: "Down." } : connectStatus("not_started"));
  const { page, navigate } = await openPayments(fake);
  await page.getByRole("button", { name: "Set up card payments" }).waitFor();

  fail = true;
  await navigate("/more");
  await page.locator(".more-list-item", { hasText: "Settings" }).waitFor();
  await navigate("/payments");
  await page.getByRole("button", { name: "Try again" }).waitFor();
  assert.ok(page.url().endsWith("/payments"));

  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("button", { name: "Set up card payments" }).waitFor();
});

test("Accept Payments sits right under Group Lessons and can't be pinned", async () => {
  const fake = seedWorld();
  fake.functionResponses["connect-account"] = () => connectStatus("not_started");
  app = await openApp(fake, "/more");
  const { page } = app;
  await page.locator(".more-card", { hasText: "Accept Payments" }).waitFor();
  const titles = await page.locator(".more-card h3").allInnerTexts();
  const group = titles.findIndex((t) => t.startsWith("Group"));
  assert.equal(titles[group + 1], "Accept Payments");
  assert.equal(await page.locator(".more-card", { hasText: "Accept Payments" }).locator(".more-pin-btn").count(), 0);
  assert.equal(await page.locator(".more-list-item", { hasText: "Payments" }).count(), 0, "not in Account any more");
});

test("Input zoom is off on Accept Payments only", async () => {
  const fake = seedWorld();
  fake.functionResponses["connect-account"] = () => connectStatus("not_started");
  const { page, navigate } = await openPayments(fake);
  const viewport = () => page.locator('meta[name="viewport"]').getAttribute("content");
  await page.getByRole("button", { name: "Set up card payments" }).waitFor();
  assert.match((await viewport())!, /maximum-scale=1/);
  await navigate("/more");
  await page.locator(".more-card", { hasText: "Accept Payments" }).waitFor();
  assert.doesNotMatch((await viewport())!, /maximum-scale/);
});

// ── Parents paying by card on /pay ──────────────────────────────────────────

const VENMO = { coach_name: "Coach Anna", venmo_handle: "Coach-Anna" };
const cardReady = { available: true, amount_cents: 6000, coach_name: "Coach Anna" };
const cardButton = (page: Page) => page.getByRole("button", { name: "Pay $60.00 by card or Apple Pay" });
const checkoutCalls = (fake: any, action: string) =>
  fake.requests("POST", "fn:create-invoice-checkout").filter((r: any) => r.body?.action === action);

test("A coach with only cards: parent pays by card, with no 'I've paid' button", async () => {
  const fake = seedWorld();
  payLink(fake, null);
  fake.functionResponses["create-invoice-checkout"] = (body: any) =>
    body.action === "checkout" ? { url: `${origin}/pay?token=tok-123&paid=1` } : cardReady;
  let origin = "";
  app = await openApp(fake, "/pay?token=tok-123");
  const { page } = app;
  origin = new URL(page.url()).origin;
  await page.getByRole("heading", { name: "Pay Coach Anna" }).waitFor();
  await cardButton(page).waitFor();
  assert.equal(await page.getByRole("button", { name: /I've sent|mark as paid/ }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Open app instead" }).count(), 0);

  const statusChecks = checkoutCalls(fake, "status").length; // StrictMode runs the load twice in dev
  await cardButton(page).click();
  await page.getByRole("heading", { name: "Payment Received" }).waitFor();
  assert.equal(checkoutCalls(fake, "checkout").length, 1);
  assert.match(await page.locator(".mip-invoice-card").innerText(), /INV-1001/);
  assert.equal(fake.requests("POST", "fn:mark-invoice-paid").length, 0, "the webhook marks it paid, not the page");
  assert.equal(checkoutCalls(fake, "status").length, statusChecks, "no card status check after paying");
});

test("A Pay online link waits for a slow card option instead of offering 'mark as paid'", async () => {
  const fake = seedWorld();
  payLink(fake, null);
  fake.functionResponses["create-invoice-checkout"] = async () => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return cardReady;
  };
  app = await openApp(fake, "/pay?token=tok-123&card=1");
  const { page } = app;
  await cardButton(page).waitFor();
  assert.equal(await page.getByRole("button", { name: /mark as paid/ }).count(), 0);
});

test("Cards alongside Venmo: both shown, card first", async () => {
  const fake = seedWorld();
  payLink(fake, VENMO);
  fake.functionResponses["create-invoice-checkout"] = () => cardReady;
  app = await openApp(fake, "/pay?token=tok-123");
  const { page } = app;
  await cardButton(page).waitFor();
  await page.locator(".pay-option-venmo").waitFor();
  await page.getByRole("button", { name: "✓ I've sent the payment" }).waitFor();
  const cardTop = (await cardButton(page).boundingBox())!.y;
  const venmoTop = (await page.locator(".pay-option-venmo").boundingBox())!.y;
  assert.ok(cardTop < venmoTop, "card above Venmo");
});

test("If card payment can't start, the parent is told and stays on the page", async () => {
  const fake = seedWorld();
  payLink(fake, null);
  fake.functionResponses["create-invoice-checkout"] = (body: any) =>
    body.action === "checkout" ? { error: "Card payment isn't available for this invoice." } : cardReady;
  app = await openApp(fake, "/pay?token=tok-123");
  const { page } = app;
  await cardButton(page).click();
  await popup(page).waitFor();
  assert.match(await popup(page).innerText(), /isn't available for this invoice/);
  await page.getByRole("button", { name: "OK" }).click();
  assert.equal(await cardButton(page).isEnabled(), true);
});

for (const [name, reply] of [
  ["isn't enrolled", { available: false }],
  ["hasn't been deployed", {}],
  ["fails", { error: "Down." }],
] as const) {
  test(`Pay link is unchanged when the card service ${name}`, async () => {
    const fake = seedWorld();
    payLink(fake, null);
    fake.functionResponses["create-invoice-checkout"] = () => reply;
    app = await openApp(fake, "/pay?token=tok-123");
    const { page } = app;
    await page.getByRole("heading", { name: "Mark Invoice as Paid?" }).waitFor();
    await page.getByRole("button", { name: "✓ Yes, mark as paid" }).waitFor();
    await page.getByRole("button", { name: "Open app instead" }).waitFor();
    assert.equal(await page.getByRole("button", { name: /by card/ }).count(), 0);
    assert.equal(await popup(page).count(), 0, "no error popup");
  });
}
