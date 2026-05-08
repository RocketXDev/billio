import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function Dashboard() {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.log(error);
        return;
      }

      setFullName(data.full_name);
      setRole(data.role);
    }

    loadProfile();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[#F7F8FC] px-4 py-6">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm font-medium text-[#64748B]">Welcome back</p>
          <h1 className="text-3xl font-bold text-[#0F172A]">
            {fullName || "Coach"}
          </h1>
          <p className="mt-1 text-sm text-[#64748B] capitalize">
            {role || "Loading..."} dashboard
          </p>
        </div>

        {/* Main Quick Action */}
        <button className="mb-6 w-full rounded-3xl bg-[#4F46E5] py-5 text-lg font-bold text-white shadow-lg">
          + Add Lesson
        </button>

        {/* Stats */}
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

        {/* Today Lessons */}
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
            <p className="text-sm text-[#64748B]">
              No lessons added yet.
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Tap “Add Lesson” to start tracking.
            </p>
          </div>
        </div>

        {/* Billing Preview */}
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

        {/* Logout */}
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