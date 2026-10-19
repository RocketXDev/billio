// The popup queue behind showError / showWarning / confirmDialog.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  confirmDialog, dismissNotice, getCurrentNotice, showError, showErrorMessage, showWarning, subscribeNotices,
} from "../../src/lib/notify.ts";

const quiet = console.error;
function drain() {
  while (getCurrentNotice()) dismissNotice(getCurrentNotice()!.id);
}

test("showError builds a 'Couldn't …' popup with the raw error as detail", () => {
  console.error = () => {};
  try {
    drain();
    showError("save the lesson", { message: "duplicate key" });
    const n = getCurrentNotice()!;
    assert.equal(n.tone, "error");
    assert.equal(n.title, "Couldn't save the lesson");
    assert.equal(n.detail, "duplicate key");
    drain();
  } finally {
    console.error = quiet;
  }
});

test("several failures of one action show a single popup", () => {
  console.error = () => {};
  try {
    drain();
    showError("update the group session", "step 1");
    showError("update the group session", "step 2");
    showError("delete the lesson", "other");
    dismissNotice(getCurrentNotice()!.id);
    assert.equal(getCurrentNotice()!.title, "Couldn't delete the lesson", "second distinct popup queued");
    dismissNotice(getCurrentNotice()!.id);
    assert.equal(getCurrentNotice(), null);
  } finally {
    console.error = quiet;
  }
});

test("warnings and custom errors queue in order and notify subscribers", () => {
  drain();
  let calls = 0;
  const unsubscribe = subscribeNotices(() => calls++);
  showWarning("Please enter a student name.");
  showErrorMessage("Payment failed", "Card declined");
  assert.equal(getCurrentNotice()!.title, "Check your details");
  dismissNotice(getCurrentNotice()!.id);
  assert.equal(getCurrentNotice()!.title, "Payment failed");
  drain();
  unsubscribe();
  assert.ok(calls >= 4);
});

test("confirmDialog resolves true on confirm and false on dismiss", async () => {
  drain();
  const yes = confirmDialog({ title: "Delete?", destructive: true });
  dismissNotice(getCurrentNotice()!.id, true);
  assert.equal(await yes, true);

  const no = confirmDialog({ title: "Delete?" });
  dismissNotice(getCurrentNotice()!.id);
  assert.equal(await no, false);
});

// ── Notification links ──────────────────────────────────────────────────────
import { notificationLink } from "../../src/lib/notifications.ts";

test("notification links only open pages inside Billio", () => {
  assert.equal(notificationLink({ link: "/earnings-dashboard" }), "/earnings-dashboard");
  assert.equal(notificationLink({ link: "  /lessons " }), "/lessons");
  assert.equal(notificationLink({ link: null }), null);
  assert.equal(notificationLink({}), null);
  for (const unsafe of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "lessons"]) {
    assert.equal(notificationLink({ link: unsafe }), null, unsafe);
  }
});
