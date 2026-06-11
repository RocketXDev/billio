import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function fetchCoachIdentity() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();
  if (!profileData) return null;

  const { data: coachData } = await supabase
    .from("coaches")
    .select("id, plan")
    .eq("profile_id", profileData.id)
    .single();
  if (!coachData) return null;

  return {
    userId: user.id,
    profileId: profileData.id,
    coachId: coachData.id,
    fullName: profileData.full_name || "",
    plan: (coachData.plan || "free") as "free" | "pro",
  };
}

export function useCoachIdentity() {
  const { data, isLoading } = useQuery({
    queryKey: ["coach-identity"],
    queryFn: fetchCoachIdentity,
    staleTime: 10 * 60 * 1000,
  });

  return {
    userId: data?.userId ?? "",
    profileId: data?.profileId ?? "",
    coachId: data?.coachId ?? "",
    fullName: data?.fullName ?? "",
    plan: data?.plan ?? ("free" as "free" | "pro"),
    identityLoading: isLoading,
  };
}
