import { useSettings } from "./useSettings";

/**
 * Coaches can rename "Lesson" to "Session", "Event", "Appointment", etc. in
 * Settings. Use this anywhere the UI would otherwise hardcode "Lesson"/"Lessons".
 */
export function useLessonTerm() {
  const { settings } = useSettings();
  const singular = settings.lessonTermSingular || "Lesson";
  const plural = settings.lessonTermPlural || "Lessons";

  return {
    singular,
    plural,
    lower: singular.toLowerCase(),
    lowerPlural: plural.toLowerCase(),
  };
}
