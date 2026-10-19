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
  const lines = lessonsCsv.text.replace(/^﻿/, "").trim().split("\r\n");
  const expected = fake.rows("lessons").filter((l) => l.lesson_date.startsWith("2026-")).length;
  assert.equal(lines.length, expected + 1, "header + one row per 2026 lesson");
  assert.match(lines[0], /^Date,Start time,Student,Lesson type,/);
  assert.ok(lines.some((l) => l.startsWith("2026-10-05,14:00,Liam Chen,") && l.includes("INV-1001")), "invoice number included");
  assert.ok(lines.some((l) => l.includes("Teen Squad")), "group class title included");

  const summary = await read("Monthly summary");
  assert.equal(summary.name, "billio-monthly-summary-2026.csv");
  const sLines = summary.text.replace(/^﻿/, "").trim().split("\r\n");
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
