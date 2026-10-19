// App-wide popup for errors, validation messages and confirmations. Replaces
// window.alert()/window.confirm() with a dialog styled like the rest of
// Billio (rendered by <NoticeHost />, mounted once in main.tsx).
//
// These are plain functions, not a hook, so any handler — including the many
// async save/delete functions inside page components — can call them.

export type NoticeTone = "error" | "warning" | "info";

export type Notice = {
  id: number;
  tone: NoticeTone;
  title: string;
  message?: string;
  // Raw error text (e.g. from Supabase), shown small for support/debugging.
  detail?: string;
  confirm?: {
    confirmLabel: string;
    cancelLabel: string;
    destructive: boolean;
    resolve: (confirmed: boolean) => void;
  };
};

let queue: Notice[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeNotices(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// One popup at a time; the rest wait their turn.
export function getCurrentNotice(): Notice | null {
  return queue[0] ?? null;
}

function push(notice: Omit<Notice, "id">) {
  // A multi-step save can fail at several steps at once — while a popup with
  // the same title is still showing or queued, don't stack another.
  if (!notice.confirm && queue.some((q) => !q.confirm && q.title === notice.title)) return;
  queue = [...queue, { ...notice, id: nextId++ }];
  emit();
}

export function dismissNotice(id: number, confirmed = false) {
  const notice = queue.find((q) => q.id === id);
  if (!notice) return;
  queue = queue.filter((q) => q.id !== id);
  notice.confirm?.resolve(confirmed);
  emit();
}

function errorText(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    const { message } = error as { message: unknown };
    if (typeof message === "string") return message;
  }
  return String(error);
}

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Something the coach asked for didn't happen. `action` completes the
 * sentence "Couldn't …", e.g. showError("save the lesson", error).
 */
export function showError(action: string, error?: unknown) {
  console.error(`Couldn't ${action}:`, error);
  push({
    tone: "error",
    title: `Couldn't ${action}`,
    message: isOffline()
      ? "You appear to be offline. Check your connection and try again."
      : "Please try again. If it keeps happening, contact support.",
    detail: errorText(error),
  });
}

/** An error with its own wording (e.g. a message from Stripe). */
export function showErrorMessage(title: string, message?: string, error?: unknown) {
  if (error) console.error(`${title}:`, error);
  push({ tone: "error", title, message, detail: errorText(error) });
}

/** Input needs fixing before we can continue. */
export function showWarning(message: string, title = "Check your details") {
  push({ tone: "warning", title, message });
}

/** Resolves true if the coach confirms, false if they cancel or dismiss. */
export function confirmDialog(options: {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    push({
      tone: options.destructive ? "error" : "info",
      title: options.title,
      message: options.message,
      confirm: {
        confirmLabel: options.confirmLabel ?? "Confirm",
        cancelLabel: options.cancelLabel ?? "Cancel",
        destructive: !!options.destructive,
        resolve,
      },
    });
  });
}
