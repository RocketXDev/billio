import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function Dashboard() {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function setupUserProfile() {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        window.location.href = "/login";
        return;
      }

      let { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        console.log("Profile lookup error:", profileError);
        setLoading(false);
        return;
      }

      if (!profileData) {
        const metadataFullName = user.user_metadata.full_name || "New User";
        const metadataRole = user.user_metadata.role || "coach";

        const { data: newProfile, error: createProfileError } = await supabase
          .from("profiles")
          .insert({
            user_id: user.id,
            full_name: metadataFullName,
            email: user.email,
            role: metadataRole,
          })
          .select()
          .single();

        if (createProfileError) {
          console.log("Create profile error:", createProfileError);
          setLoading(false);
          return;
        }

        profileData = newProfile;
      }

      setFullName(profileData.full_name);
      setRole(profileData.role);

      if (profileData.role === "coach") {
        const { data: coachData, error: coachLookupError } = await supabase
          .from("coaches")
          .select("*")
          .eq("profile_id", profileData.id)
          .maybeSingle();

        if (coachLookupError) {
          console.log("Coach lookup error:", coachLookupError);
        }

        if (!coachData) {
          const { error: createCoachError } = await supabase
            .from("coaches")
            .insert({
              profile_id: profileData.id,
              active: true,
              setup_completed: false,
            });

          if (createCoachError) {
            console.log("Create coach error:", createCoachError);
          }
        }
      }

      if (profileData.role === "student") {
        const { data: studentData, error: studentLookupError } = await supabase
          .from("students")
          .select("*")
          .eq("profile_id", profileData.id)
          .maybeSingle();

        if (studentLookupError) {
          console.log("Student lookup error:", studentLookupError);
        }

        if (!studentData) {
          const { error: createStudentError } = await supabase
            .from("students")
            .insert({
              profile_id: profileData.id,
              student_name: profileData.full_name,
              active: true,
            });

          if (createStudentError) {
            console.log("Create student error:", createStudentError);
          }
        }
      }

      setLoading(false);
    }

    setupUserProfile();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center">
        <p>Loading Billio...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F7F8FC] px-4 py-6">
      <div className="mx-auto max-w-md">
        <div className="mb-6">
          <p className="text-sm text-[#64748B]">Welcome back</p>
          <h1 className="text-3xl font-bold text-[#0F172A]">
            {fullName || "User"}
          </h1>
          <p className="mt-1 text-sm capitalize text-[#64748B]">
            {role} dashboard
          </p>
        </div>

        <button className="mb-6 w-full rounded-3xl bg-[#4F46E5] py-5 text-lg font-bold text-white shadow-lg">
          + Add Lesson
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <p className="text-sm text-[#64748B]">Today</p>
            <h2 className="mt-2 text-2xl font-bold text-[#0F172A]">0</h2>
            <p className="text-xs text-[#94A3B8]">lessons</p>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <p className="text-sm text-[#64748B]">This Week</p>
            <h2 className="mt-2 text-2xl font-bold text-[#0F172A]">$0</h2>
            <p className="text-xs text-[#94A3B8]">earned</p>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <p className="text-sm text-[#64748B]">Unbilled</p>
            <h2 className="mt-2 text-2xl font-bold text-[#0F172A]">0</h2>
            <p className="text-xs text-[#94A3B8]">sessions</p>
          </div>

          <div className="rounded-3xl bg-white p-4 shadow-sm">
            <p className="text-sm text-[#64748B]">Clients</p>
            <h2 className="mt-2 text-2xl font-bold text-[#0F172A]">0</h2>
            <p className="text-xs text-[#94A3B8]">active</p>
          </div>
        </div>

        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#0F172A]">
              Today’s Lessons
            </h2>
            <button className="text-sm font-semibold text-[#4F46E5]">
              View all
            </button>
          </div>

          <div className="rounded-3xl bg-white p-5 text-center shadow-sm">
            <p className="text-sm text-[#64748B]">No lessons added yet.</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Tap “Add Lesson” to start tracking.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#64748B]">Weekly Billing</p>
              <h2 className="mt-1 text-xl font-bold text-[#0F172A]">
                Nothing to bill yet
              </h2>
            </div>

            <button className="rounded-2xl bg-[#F7F8FC] px-4 py-2 text-sm font-semibold text-[#4F46E5]">
              Review
            </button>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="mt-8 w-full rounded-2xl bg-white py-3 font-semibold text-[#0F172A] shadow-sm"
        >
          Log out
        </button>
      </div>
    </div>
  );
}

export default Dashboard;