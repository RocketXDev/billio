import { useEffect, useState } from "react";
import { FaFileCsv, FaTimes } from "react-icons/fa";
import {
  buildLessonsCsv, buildMonthlySummaryCsv, downloadCsv, fetchLessonsForExport,
} from "../../lib/exportRecords";
import { showError, showWarning } from "../../lib/notify";

type Period = "thisYear" | "lastYear" | "custom";
type Term = { singular: string; plural: string; lowerPlural: string };

const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pretty = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function ExportRecordsDialog({ coachId, term, onClose }: {
  coachId: string;
  term: Term;
  onClose: () => void;
}) {
  const now = new Date();
  const year = now.getFullYear();
  // Early in the year people usually want last year's records.
  const [period, setPeriod] = useState<Period>(now.getMonth() < 2 ? "lastYear" : "thisYear");
  const [customFrom, setCustomFrom] = useState(`${year}-01-01`);
  const [customTo, setCustomTo] = useState(localDate(now));
  const [busy, setBusy] = useState<null | "lessons" | "summary">(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const range =
    period === "thisYear" ? { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) }
    : period === "lastYear" ? { from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, label: String(year - 1) }
    : { from: customFrom, to: customTo, label: `${customFrom}-to-${customTo}` };

  async function exportCsv(kind: "lessons" | "summary") {
    if (!range.from || !range.to || range.from > range.to) {
      showWarning("Choose a start date that's on or before the end date.");
      return;
    }
    setBusy(kind);
    try {
      const { lessons, groupTitles } = await fetchLessonsForExport(coachId, range.from, range.to);
      if (lessons.length === 0) {
        showWarning(`There are no ${term.lowerPlural} between ${pretty(range.from)} and ${pretty(range.to)}.`, "Nothing to export");
        return;
      }
      const slug = term.lowerPlural.replace(/[^a-z0-9]+/gi, "-");
      if (kind === "lessons") {
        downloadCsv(`billio-${slug}-${range.label}.csv`, buildLessonsCsv(lessons, term, groupTitles));
      } else {
        downloadCsv(`billio-monthly-summary-${range.label}.csv`, buildMonthlySummaryCsv(lessons, term, range.from, range.to));
      }
    } catch (error) {
      showError("export your records", error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="billio-confirm-overlay" onClick={() => !busy && onClose()}>
      <div
        className="billio-confirm-card ed-export-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ed-export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ed-export-head">
          <h2 id="ed-export-title">Export records</h2>
          <button type="button" className="ed-export-close" aria-label="Close" onClick={onClose} disabled={!!busy}>
            <FaTimes />
          </button>
        </div>
        <p className="ed-export-intro">
          Download your {term.lowerPlural} and earnings as a spreadsheet (CSV). Opens in Excel, Numbers or Google Sheets.
        </p>

        <span className="ed-export-label">Period</span>
        <div className="ed-export-periods" role="radiogroup" aria-label="Period">
          {([
            ["thisYear", String(year)],
            ["lastYear", String(year - 1)],
            ["custom", "Custom"],
          ] as [Period, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={period === value}
              className={`ed-export-period${period === value ? " active" : ""}`}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <div className="ed-export-dates">
            <label>
              From
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </label>
          </div>
        )}

        <div className="ed-export-options">
          <button type="button" className="ed-export-option" disabled={!!busy} onClick={() => exportCsv("lessons")}>
            <FaFileCsv aria-hidden="true" />
            <span>
              <strong>{busy === "lessons" ? "Preparing…" : `All ${term.lowerPlural}`}</strong>
              <small>One row per {term.singular.toLowerCase()}: date, student, amount, status, invoice</small>
            </span>
          </button>
          <button type="button" className="ed-export-option" disabled={!!busy} onClick={() => exportCsv("summary")}>
            <FaFileCsv aria-hidden="true" />
            <span>
              <strong>{busy === "summary" ? "Preparing…" : "Monthly summary"}</strong>
              <small>Totals per month: earned, awaiting payment, not billed yet</small>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
