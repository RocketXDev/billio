import { supabase } from "./supabaseClient";

export type StudentEntry = { id: string | null; name: string };

type Resolved = { ids: string[]; created: boolean; error: null };
type Failed = { ids: null; created: boolean; error: unknown };

const normalize = (name: string) => name.trim().toLowerCase();

/**
 * Turns students a coach picked or typed into student ids:
 * - an entry that already has an id is used as-is,
 * - a name matching one of the coach's students (ignoring case and
 *   surrounding spaces) reuses that student,
 * - anything else creates the student and links it to the coach.
 *
 * Returns the error instead of throwing, so each caller keeps its own error
 * handling (popup, inline message, assistant reply). `created` tells the
 * caller to refresh its student lists.
 */
export async function resolveStudentIds(coachId: string, entries: StudentEntry[]): Promise<Resolved | Failed> {
  if (entries.every((e) => e.id)) return { ids: entries.map((e) => e.id!), created: false, error: null };

  const { data: links, error: lookupError } = await supabase
    .from("coach_students")
    .select("student_id, students(id, student_name)")
    .eq("coach_id", coachId);
  if (lookupError) return { ids: null, created: false, error: lookupError };

  const idByName = new Map<string, string>();
  for (const link of (links ?? []) as { student_id: string; students: { student_name?: string | null } | null }[]) {
    const name = link.students?.student_name;
    if (name && !idByName.has(normalize(name))) idByName.set(normalize(name), link.student_id);
  }

  const ids: string[] = [];
  let created = false;

  for (const entry of entries) {
    if (entry.id) {
      ids.push(entry.id);
      continue;
    }

    const key = normalize(entry.name);
    const existingId = idByName.get(key);
    if (existingId) {
      ids.push(existingId);
      continue;
    }

    const { data: student, error: createError } = await supabase
      .from("students")
      .insert({ student_name: entry.name.trim(), active: true })
      .select("id")
      .single();
    if (createError || !student) return { ids: null, created, error: createError };

    const { error: linkError } = await supabase
      .from("coach_students")
      .insert({ coach_id: coachId, student_id: student.id });
    if (linkError) return { ids: null, created: true, error: linkError };

    created = true;
    idByName.set(key, student.id); // the same new name twice → one student
    ids.push(student.id);
  }

  return { ids, created, error: null };
}

/** Single-student form of resolveStudentIds. */
export async function findOrCreateStudentId(coachId: string, name: string, pickedId: string | null = null) {
  const result = await resolveStudentIds(coachId, [{ id: pickedId, name }]);
  return result.error
    ? { id: null, created: result.created, error: result.error }
    : { id: result.ids[0], created: result.created, error: null };
}
