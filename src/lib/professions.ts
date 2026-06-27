export interface ProfessionOption {
  value: string;
  label: string;
  lessonTermSingular: string;
  lessonTermPlural: string;
}

// Mirrors the audience called out on the landing page (rotating word +
// persona strip), plus a couple of common variants and a safe catch-all.
// lessonTermSingular/Plural seed a new coach's Settings > "What do you call
// a lesson?" picker, so each profession starts with the term that reads
// most naturally for that line of work.
export const PROFESSIONS: ProfessionOption[] = [
  { value: "coach", label: "Coach", lessonTermSingular: "Lesson", lessonTermPlural: "Lessons" },
  { value: "tutor", label: "Tutor", lessonTermSingular: "Lesson", lessonTermPlural: "Lessons" },
  { value: "instructor", label: "Instructor", lessonTermSingular: "Lesson", lessonTermPlural: "Lessons" },
  { value: "teacher", label: "Teacher", lessonTermSingular: "Lesson", lessonTermPlural: "Lessons" },
  { value: "trainer", label: "Trainer", lessonTermSingular: "Session", lessonTermPlural: "Sessions" },
  { value: "nanny", label: "Nanny", lessonTermSingular: "Booking", lessonTermPlural: "Bookings" },
  { value: "therapist", label: "Therapist", lessonTermSingular: "Appointment", lessonTermPlural: "Appointments" },
  { value: "other", label: "Other", lessonTermSingular: "Lesson", lessonTermPlural: "Lessons" },
];

export function getDefaultLessonTerm(profession: string | null | undefined) {
  const match = PROFESSIONS.find((p) => p.value === profession);
  return {
    singular: match?.lessonTermSingular ?? "Lesson",
    plural: match?.lessonTermPlural ?? "Lessons",
  };
}
