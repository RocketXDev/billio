import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useCoachIdentity } from "./useCoachIdentity";

export interface CoachSettings {
  defaultLessonDuration: number;
  defaultDueDateDays: number;
  invoicePrefix: string;
  timeFormat: "12h" | "24h";
}

const DEFAULTS: CoachSettings = {
  defaultLessonDuration: 30,
  defaultDueDateDays: 7,
  invoicePrefix: "INV",
  timeFormat: "12h",
};

export function useSettings() {
  const { coachId, identityLoading } = useCoachIdentity();

  const { data, isLoading } = useQuery({
    queryKey: ["settings", coachId],
    queryFn: async () => {
      const { data: coachData } = await supabase
        .from("coaches")
        .select("default_lesson_duration, default_due_date_days, invoice_prefix, time_format")
        .eq("id", coachId)
        .single();
      return coachData;
    },
    enabled: !!coachId,
  });

  return {
    settings: data
      ? {
          defaultLessonDuration: data.default_lesson_duration ?? 30,
          defaultDueDateDays: data.default_due_date_days ?? 7,
          invoicePrefix: data.invoice_prefix ?? "INV",
          timeFormat: (data.time_format ?? "12h") as "12h" | "24h",
        }
      : DEFAULTS,
    settingsLoading: identityLoading || isLoading,
  };
}
