import { useEffect, useRef, useSyncExternalStore } from "react";
import { FaExclamationCircle, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";
import { dismissNotice, getCurrentNotice, subscribeNotices } from "../../lib/notify";
import "./NoticeHost.css";

const ICONS = {
  error: FaExclamationTriangle,
  warning: FaExclamationCircle,
  info: FaInfoCircle,
};

// Renders the popup queued through lib/notify. Built on the app's existing
// billio-confirm dialog styles so it matches the other confirmation modals.
export default function NoticeHost() {
  const notice = useSyncExternalStore(subscribeNotices, getCurrentNotice);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!notice) return;

    if (!returnFocusRef.current) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
    }
    primaryRef.current?.focus();

    const id = notice.id;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        dismissNotice(id, false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [notice]);

  // Hand focus back to whatever the coach was on once the last popup closes.
  useEffect(() => {
    if (notice || !returnFocusRef.current) return;
    returnFocusRef.current.focus?.();
    returnFocusRef.current = null;
  }, [notice]);

  if (!notice) return null;

  const Icon = ICONS[notice.tone];
  const close = (confirmed: boolean) => dismissNotice(notice.id, confirmed);

  return (
    <div className="billio-confirm-overlay notice-overlay" onClick={() => close(false)}>
      <div
        className={`billio-confirm-card notice-card notice-${notice.tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="notice-title"
        aria-describedby={notice.message ? "notice-message" : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="billio-confirm-icon notice-icon" aria-hidden="true">
          <Icon />
        </div>

        <h2 id="notice-title">{notice.title}</h2>
        {notice.message && <p id="notice-message">{notice.message}</p>}
        {notice.detail && <code className="notice-detail">{notice.detail}</code>}

        {notice.confirm ? (
          <div className="billio-confirm-actions">
            <button type="button" className="billio-cancel-btn" onClick={() => close(false)}>
              {notice.confirm.cancelLabel}
            </button>
            <button
              ref={primaryRef}
              type="button"
              className={notice.confirm.destructive ? "billio-danger-btn" : "notice-primary-btn"}
              onClick={() => close(true)}
            >
              {notice.confirm.confirmLabel}
            </button>
          </div>
        ) : (
          <button ref={primaryRef} type="button" className="notice-primary-btn notice-ok-btn" onClick={() => close(false)}>
            OK
          </button>
        )}
      </div>
    </div>
  );
}
