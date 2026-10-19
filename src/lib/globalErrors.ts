import { showErrorMessage, showWarning } from "./notify";

type FormField = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

// The visible label for a form field: <label for=id>, else the first <label>
// in the field's wrapper, else aria-label / placeholder.
function fieldLabel(field: FormField) {
  const forLabel = field.id ? document.querySelector(`label[for="${CSS.escape(field.id)}"]`) : null;
  const wrapperLabel = field.parentElement?.querySelector("label");
  const text =
    forLabel?.textContent ||
    wrapperLabel?.textContent ||
    field.getAttribute("aria-label") ||
    ("placeholder" in field ? field.placeholder : "") ||
    "";
  return text.replace(/\s+/g, " ").replace(/[*:]\s*$/, "").trim();
}

function validationText(field: FormField) {
  const label = fieldLabel(field);
  if (field.validity.valueMissing) {
    if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) {
      return "Please tick the required box to continue.";
    }
    return label ? `Please fill in ${label}.` : "Please fill in the highlighted field.";
  }
  return label ? `${label}: ${field.validationMessage}` : field.validationMessage;
}

export function installGlobalErrorHandlers() {
  // Errors thrown inside event handlers and async code never reach a React
  // error boundary — before this they only showed up in the console, so a
  // failed action looked like it had worked.
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    if (reason?.name === "AbortError") return;
    showErrorMessage("Something went wrong", "That action didn't finish. Please try again.", reason);
  });

  window.addEventListener("error", (event) => {
    // Only our own code — not browser extensions or benign browser noise
    // such as "ResizeObserver loop completed with undelivered notifications".
    if (!(event.error instanceof Error)) return;
    if (event.filename && !event.filename.startsWith(window.location.origin)) return;
    showErrorMessage("Something went wrong", "That action didn't finish. Please try again.", event.error);
  });

  // Native form validation (`required`, type="email", min/max…) would show
  // the browser's own bubble. Show the same Billio popup as the app's own
  // checks instead, for the first invalid field of each submit, and put the
  // cursor in that field.
  let reportedThisSubmit = false;
  document.addEventListener(
    "invalid",
    (event) => {
      event.preventDefault();
      if (reportedThisSubmit) return;
      reportedThisSubmit = true;
      setTimeout(() => {
        reportedThisSubmit = false;
      }, 0);

      const field = event.target as FormField;
      field.focus?.(); // before the popup, so focus returns here when it closes
      showWarning(validationText(field));
    },
    true
  );
}
