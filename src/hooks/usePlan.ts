import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type Plan = "free" | "pro";

export function usePlan() {
  const [plan, setPlan] = useState<Plan>("free");
  const [planLoading, setPlanLoading] = useState(true);
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) { setPlanLoading(false); return; }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("user_id", user.id)
        .single();

      if (!profileData) { setPlanLoading(false); return; }

      setFullName(profileData.full_name || "");

      const { data: coachData } = await supabase
        .from("coaches")
        .select("plan")
        .eq("profile_id", profileData.id)
        .single();

      if (coachData?.plan === "pro") {
        setPlan("pro");
      } else {
        setPlan("free");
      }

      setPlanLoading(false);
    }

    load();
  }, []);

  const isPro = plan === "pro";
  const isFree = plan === "free";

  return { plan, planLoading, isPro, isFree, fullName };
}