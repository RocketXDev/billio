// Parses CSV text into rows of raw string cells. Handles quoted fields
// (including embedded commas/newlines and "" escaped quotes) since a naive
// text.split(",") breaks on any real-world export with a quoted field.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }

    if (char === "\r") {
      i++;
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }

    field += char;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export type StudentCsvField =
  | "name"
  | "email"
  | "phone"
  | "parentName"
  | "parentEmail"
  | "parentPhone"
  | "notes";

// Header names are matched case-insensitively, with underscores/dashes
// normalized to spaces, against any of these common variants.
const FIELD_ALIASES: Record<StudentCsvField, string[]> = {
  name: ["name", "student name", "students", "student", "full name", "fullname", "child name", "child"],
  email: ["email", "email address", "student email"],
  phone: ["phone", "phone number", "mobile", "mobile number", "cell", "cell phone", "student phone"],
  parentName: ["parent name", "parent", "parents", "guardian name", "guardian", "parent guardian", "mom name", "dad name", "mother name", "father name"],
  parentEmail: ["parent email", "guardian email", "parents email", "mom email", "dad email"],
  parentPhone: ["parent phone", "guardian phone", "parent number", "guardian number", "parents phone", "mom phone", "dad phone"],
  notes: ["notes", "note", "comment", "comments"],
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/['’]/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function mapCsvHeaders(headerRow: string[]): Partial<Record<StudentCsvField, number>> {
  const normalized = headerRow.map(normalizeHeader);
  const map: Partial<Record<StudentCsvField, number>> = {};

  (Object.keys(FIELD_ALIASES) as StudentCsvField[]).forEach((field) => {
    const index = normalized.findIndex((header) => FIELD_ALIASES[field].includes(header));
    if (index !== -1) map[field] = index;
  });

  return map;
}

export interface ParsedStudentRow {
  name: string;
  email: string | null;
  phone: string | null;
  parentName: string | null;
  parentEmail: string | null;
  parentPhone: string | null;
  notes: string | null;
}

// Rows with no usable name are dropped — a student can't be created
// without one, and every other field is optional and left empty if the
// CSV doesn't have (or that row doesn't fill in) a matching column.
export function rowsToStudentRecords(
  rows: string[][],
  columnMap: Partial<Record<StudentCsvField, number>>
): ParsedStudentRow[] {
  function valueAt(row: string[], field: StudentCsvField): string {
    const index = columnMap[field];
    if (index === undefined) return "";
    return (row[index] ?? "").trim();
  }

  return rows
    .map((row) => ({
      name: valueAt(row, "name"),
      email: valueAt(row, "email") || null,
      phone: valueAt(row, "phone") || null,
      parentName: valueAt(row, "parentName") || null,
      parentEmail: valueAt(row, "parentEmail") || null,
      parentPhone: valueAt(row, "parentPhone") || null,
      notes: valueAt(row, "notes") || null,
    }))
    .filter((record) => record.name);
}
