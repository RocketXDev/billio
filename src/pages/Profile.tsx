// src/pages/Profile.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaSave,
} from "react-icons/fa";
import { supabase } from "../lib/supabaseClient";

function Profile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [profileId, setProfileId] = useState("");
  const [coachId, setCoachId] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [visibleName, setVisibleName] = useState("");
  const [bio, setBio] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [preferredCommunication, setPreferredCommunication] = useState("email");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;

    if (!user) {
      navigate("/login");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profileData) {
      console.log("Profile load error:", profileError);
      setLoading(false);
      return;
    }

    setProfileId(profileData.id);
    setFullName(profileData.full_name || "");
    setEmail(profileData.email || user.email || "");

    const { data: coachData, error: coachError } = await supabase
      .from("coaches")
      .select("*")
      .eq("profile_id", profileData.id)
      .single();

    if (coachError) {
      console.log("Coach load error:", coachError);
      setLoading(false);
      return;
    }

    setCoachId(coachData.id);
    setVisibleName(coachData.visible_name || "");
    setBio(coachData.bio || "");
    setPhoneNumber(coachData.phone_number || "");
    setPreferredCommunication(
      coachData.preferred_communication || "email"
    );

    setLoading(false);
  }

  async function handleSaveProfile(e: any) {
    e.preventDefault();

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          email,
        })
        .eq("id", profileId);

      if (profileError) {
        console.log("Profile update error:", profileError);
        return;
      }

      const { error: coachError } = await supabase
        .from("coaches")
        .update({
          visible_name: visibleName,
          bio: bio || null,
          phone_number: phoneNumber || null,
          preferred_communication: preferredCommunication,
        })
        .eq("id", coachId);

      if (coachError) {
        console.log("Coach update error:", coachError);
        return;
      }

    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="billio-loader">
          <div className="billio-loader-glow" />
          <img className="billio-loader-logo" src="/logo.png" alt="Billio" />
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-wrapper">
        <div className="profile-body">
          <div className="profile-header">
            <h1>Profile</h1>
          </div>

          <section className="profile-hero-card">
            <div className="profile-avatar">
              {(visibleName || fullName || "B").charAt(0).toUpperCase()}
            </div>

            <div className="profile-hero-info">
              <h2>{visibleName || fullName || "Coach"}</h2>
              <p>{bio || "Bio"}</p>
            </div>
          </section>

          <form onSubmit={handleSaveProfile} className="profile-form">
            <section className="profile-section-card">
              <h3>Personal Information</h3>

              <div className="input-block">
                <label>Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label>Visible Coach Name</label>
                <input
                  type="text"
                  value={visibleName}
                  onChange={(e) => setVisibleName(e.target.value)}
                  placeholder="Name students will see"
                />
              </div>

              <div className="input-block">
                <label>Preferred Communication Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="input-block">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(555) 555-5555"
                />
              </div>

              <div className="input-block">
                <label>Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell students a little about yourself..."
                />
              </div>
            </section>

            <section className="profile-section-card">
              <h3>Communication Preferences</h3>

              <div className="profile-choice-group">
                {["email", "text", "both"].map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={`profile-choice ${
                      preferredCommunication === choice ? "active" : ""
                    }`}
                    onClick={() => setPreferredCommunication(choice)}
                  >
                    {choice === "email"
                      ? "Email"
                      : choice === "text"
                      ? "Text"
                      : "Both"}
                  </button>
                ))}
              </div>
            </section>

            <button
              type="submit"
              className="profile-save-btn"
              disabled={isSubmitting}
            >
              <FaSave />
              {isSubmitting ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>

        <nav className="bottom-nav">
          <div className="nav-item" onClick={() => navigate("/dashboard")}>
            <FaHome />
            <span>Dashboard</span>
          </div>

          <div className="nav-item" onClick={() => navigate("/lessons")}>
            <FaCalendarAlt />
            <span>Lessons</span>
          </div>

          <div className="nav-item" onClick={() => navigate("/students")}>
            <FaUsers />
            <span>Students</span>
          </div>

          <div className="nav-item" onClick={() => navigate("/invoices")}>
            <FaFileInvoiceDollar />
            <span>Invoices</span>
          </div>

          <div className="nav-item active" onClick={() => navigate("/profile")}>
            <FaEllipsisH />
            <span>More</span>
          </div>
        </nav>
      </div>
    </div>
  );
}

export default Profile;