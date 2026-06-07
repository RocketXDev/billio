import { supabase } from "./supabaseClient";

export async function createInstallNotification(profileId: string) {
  // Check if one already exists so we don't duplicate
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("profile_id", profileId)
    .eq("type", "install_prompt")
    .maybeSingle();

  if (existing) return;

  await supabase.from("notifications").insert({
    profile_id: profileId,
    title: "Add Billio to your Home Screen",
    message: "Get the full app experience — faster access, works like a native app. Tap to set up in 3 steps.",
    type: "install_prompt",
    is_read: false,
  });
}