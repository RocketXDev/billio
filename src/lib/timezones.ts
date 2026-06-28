// Single source of truth for the timezone options offered in Settings, and
// the labels used for read-only displays elsewhere (Invoices, Lessons
// reminder settings) that reference the same coaches.invoice_timezone value
// but no longer have their own editable copy of this control.
export const TIMEZONE_GROUPS = [
  {
    label: "Americas",
    options: [
      { value: "America/Denver", label: "Mountain Time" },
      { value: "America/Los_Angeles", label: "Pacific Time" },
      { value: "America/Chicago", label: "Central Time" },
      { value: "America/New_York", label: "Eastern Time" },
    ],
  },
  {
    label: "Europe",
    options: [
      { value: "Europe/London", label: "London (GMT/BST)" },
      { value: "Europe/Lisbon", label: "Lisbon (WET/WEST)" },
      { value: "Europe/Paris", label: "Paris, Berlin, Madrid, Rome (CET/CEST)" },
      { value: "Europe/Athens", label: "Athens, Helsinki, Bucharest (EET/EEST)" },
      { value: "Europe/Istanbul", label: "Istanbul (TRT)" },
      { value: "Europe/Moscow", label: "Moscow (MSK)" },
    ],
  },
];

export const TIMEZONE_LABELS: Record<string, string> = Object.fromEntries(
  TIMEZONE_GROUPS.flatMap((group) => group.options.map((opt) => [opt.value, opt.label]))
);

export function timezoneLabel(value: string | null | undefined): string {
  if (!value) return "Mountain Time";
  return TIMEZONE_LABELS[value] || value;
}
