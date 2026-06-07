// src/hooks/useSettings.ts
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

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
  const [settings, setSettings] = useState<CoachSettings>(DEFAULTS);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) { setSettingsLoading(false); return; }

      const { data: profileData } = await supabase
        .from("profiles").select("id").eq("user_id", user.id).single();
      if (!profileData) { setSettingsLoading(false); return; }

      const { data: coachData } = await supabase
        .from("coaches")
        .select("default_lesson_duration, default_due_date_days, invoice_prefix, time_format")
        .eq("profile_id", profileData.id)
        .single();

      if (coachData) {
        setSettings({
          defaultLessonDuration: coachData.default_lesson_duration ?? 30,
          defaultDueDateDays: coachData.default_due_date_days ?? 7,
          invoicePrefix: coachData.invoice_prefix ?? "INV",
          timeFormat: coachData.time_format ?? "12h",
        });
      }

      setSettingsLoading(false);
    }

    load();
  }, []);

  return { settings, settingsLoading };
}