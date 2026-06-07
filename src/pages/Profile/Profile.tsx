import './Profile.css';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaHome,
  FaCalendarAlt,
  FaUsers,
  FaFileInvoiceDollar,
  FaEllipsisH,
  FaSave,
  FaCrown,
  FaLock,
} from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import Cropper from "react-easy-crop";
import { usePlan } from "../../hooks/usePlan";

function Profile() {
  const navigate = useNavigate();
  const { isPro, plan } = usePlan();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [profileId, setProfileId] = useState("");
  const [coachId, setCoachId] = useState("");

  const [avatarUrl, setAvatarUrl] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [visibleName, setVisibleName] = useState("");
  const [bio, setBio] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [coachSmsConsent, setCoachSmsConsent] = useState(false);
  const [preferredCommunication, setPreferredCommunication] = useState("email");

  const [defaultHourlyRate, setDefaultHourlyRate] = useState("");
  const [customRates, setCustomRates] = useState<any[]>([]);
  const [rateName, setRateName] = useState("");
  const [rateAmount, setRateAmount] = useState("");

  // Avatar related states
  const [avatarPath, setAvatarPath] = useState("");
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

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
    setAvatarUrl(coachData.avatar_url || "");
    setAvatarPath(coachData.avatar_path || "");
    setDefaultHourlyRate(
      coachData.default_hourly_rate ? String(coachData.default_hourly_rate) : ""
    );
    setCustomRates(coachData.custom_rates || []);
    setVisibleName(coachData.visible_name || "");
    setBio(coachData.bio || "");
    setPhoneNumber(coachData.phone_number || "");
    setPreferredCommunication(
      coachData.preferred_communication || "email"
    );
    setCoachSmsConsent(coachData.sms_consent || false);

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
          default_hourly_rate: Number(defaultHourlyRate || 0),
          custom_rates: customRates,
          avatar_url: avatarUrl || null,
          sms_consent: coachSmsConsent,
          sms_consent_at: coachSmsConsent ? new Date().toISOString() : null,
          sms_consent_source: coachSmsConsent ? "coach_onboarding" : null,
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

  async function handleAvatarUpload(e: any) {
    const file = e.target.files?.[0];

    if (!file || !coachId) return;

    const fileExt = file.name.split(".").pop();
    const filePath = `${coachId}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("coach-avatars")
      .upload(filePath, file, {
        upsert: true,
      });

    if (uploadError) {
      console.log("Avatar upload error:", uploadError);
      return;
    }

    const { data } = supabase.storage
      .from("coach-avatars")
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    setAvatarUrl(publicUrl);

    await supabase
      .from("coaches")
      .update({
        avatar_url: publicUrl,
        avatar_path: filePath
      })
      .eq("id", coachId);
  }

  function handleAvatarSelect(e: any) {
    const file = e.target.files?.[0];

    if (!file) return;

    setSelectedAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
    setShowCropper(true);

    e.target.value = "";
  }

  async function handleDeleteAvatar() {
    if (!coachId) return;

    let pathToDelete = avatarPath;

    if (!pathToDelete && avatarUrl) {
      const parts = avatarUrl.split("/coach-avatars/");

      if (parts.length > 1) {
        pathToDelete = decodeURIComponent(parts[1]);
      }
    }

    console.log("Deleting avatar path:", pathToDelete);

    if (pathToDelete) {
      const { data, error: storageError } = await supabase.storage
        .from("coach-avatars")
        .remove([pathToDelete]);

      console.log("Storage delete data:", data);
      console.log("Storage delete error:", storageError);

      if (storageError) return;
    }

    const { error: coachError } = await supabase
      .from("coaches")
      .update({
        avatar_url: null,
        avatar_path: null,
      })
      .eq("id", coachId);

    if (coachError) {
      console.log("Coach avatar clear error:", coachError);
      return;
    }

    setAvatarUrl("");
    setAvatarPath("");
  }

  function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", reject);
      image.src = url;
    });
  }

  async function getCroppedImage(imageSrc: string, pixelCrop: any): Promise<Blob> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    if (!ctx) {
      throw new Error("Could not create canvas context");
    }

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas is empty"));
          return;
        }

        resolve(blob);
      }, "image/jpeg");
    });
  }

  async function saveCroppedAvatar() {
    if (!avatarPreviewUrl || !croppedAreaPixels || !coachId) return;

    const croppedBlob = await getCroppedImage(
      avatarPreviewUrl,
      croppedAreaPixels
    );

    const filePath = `${coachId}/avatar-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("coach-avatars")
      .upload(filePath, croppedBlob, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.log("Avatar upload error:", uploadError);
      return;
    }

    const { data } = supabase.storage
      .from("coach-avatars")
      .getPublicUrl(filePath);

    const publicUrl = data.publicUrl;

    setAvatarUrl(publicUrl);
    setAvatarPath(filePath);

    await supabase
      .from("coaches")
      .update({
        avatar_url: publicUrl,
        avatar_path: filePath,
      })
      .eq("id", coachId);

    setShowCropper(false);
    setSelectedAvatarFile(null);
    setAvatarPreviewUrl("");
    setZoom(1);
    setCrop({ x: 0, y: 0 });
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
            <div className="profile-avatar-wrapper">
              <label className="profile-avatar uploadable-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Coach avatar" />
                ) : (
                  (visibleName || fullName || "B").charAt(0).toUpperCase()
                )}

                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  hidden
                />
              </label>

              {avatarUrl && (
                <button
                  type="button"
                  className="avatar-delete-btn"
                  onClick={handleDeleteAvatar}
                >
                  ×
                </button>
              )}
            </div>

            <div className="profile-hero-info">
              <div className="profile-name-row">
                <h2>{visibleName || fullName || "Coach"}</h2>
                <span className={`plan-badge ${plan}`}>
                  {isPro ? <><FaCrown style={{ fontSize: 9, marginRight: 3 }} />Pro</> : "Free"}
                </span>
              </div>
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
                <label className="sms-consent-checkbox">
                  <input
                    type="checkbox"
                    checked={coachSmsConsent}
                    onChange={(e) => setCoachSmsConsent(e.target.checked)}
                  />
                  <span>
                    I agree to receive transactional SMS messages from Billio about my account,
                    invoice review reminders, billing notifications, and coaching-related app
                    updates. Message frequency varies. Message and data rates may apply. Reply
                    STOP to opt out. Reply HELP for help.{" "}
                    <a href="/terms" target="_blank" rel="noreferrer">
                      Terms
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" target="_blank" rel="noreferrer">
                      Privacy Policy
                    </a>
                    .
                  </span>
              </label>
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
              <h3>Coaching Information</h3>

              <div className="input-block">
                <label>Default Hourly Rate</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={defaultHourlyRate ? `$${defaultHourlyRate}` : ""}
                  onChange={(e) =>
                    setDefaultHourlyRate(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="$100"
                />
              </div>

              <h4 className="custom-rates-title">
                Other Custom Rates
              </h4>

              <div className="custom-rate-row">
                <input
                  type="text"
                  value={rateName}
                  onChange={(e) => setRateName(e.target.value)}
                  placeholder="Lesson"
                />

                <input
                  type="text"
                  inputMode="decimal"
                  value={rateAmount ? `$${rateAmount}` : ""}
                  onChange={(e) =>
                    setRateAmount(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  placeholder="Amount"
                />

                <button
                  type="button"
                  onClick={() => {
                    if (!rateName.trim() || !rateAmount) return;

                    setCustomRates((prev) => [
                      ...prev,
                      {
                        name: rateName.trim(),
                        amount: Number(rateAmount),
                      },
                    ]);

                    setRateName("");
                    setRateAmount("");
                  }}
                >
                  Add
                </button>
              </div>

              {customRates.length > 0 && (
                <div className="custom-rates-list">
                  {customRates.map((rate, index) => (
                    <div key={index} className="custom-rate-item">
                      <span>{rate.name}</span>
                      <strong>${Number(rate.amount).toFixed(2)}</strong>

                      <button
                        type="button"
                        onClick={() =>
                          setCustomRates((prev) =>
                            prev.filter((_, rateIndex) => rateIndex !== index)
                          )
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="profile-section-card">
              <h3>Communication Preferences</h3>
              <div className="profile-choice-group">
                {["email", "text", "both"].map((choice) => {
                  const isLocked = !isPro && (choice === "text" || choice === "both");
                  return (
                    <div key={choice} className="lock-wrapper">
                      <button
                        type="button"
                        className={`profile-choice ${preferredCommunication === choice ? "active" : ""}${isLocked ? " pro-locked-choice" : ""}`}
                        onClick={() => !isLocked && setPreferredCommunication(choice)}
                        disabled={isLocked}
                      >
                        {choice === "email" ? "Email" : choice === "text" ? "Text" : "Both"}
                      </button>
                      {isLocked && (
                        <span className="pro-only-bubble">
                          <FaLock style={{ fontSize: 8 }} /> Pro only
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {isPro && (
              <button
                type="button"
                className="profile-cancel-sub-btn"
                onClick={() => navigate("/upgrade")}
              >
                Manage Subscription
              </button>
            )}

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
      {showCropper && (
        <div className="avatar-crop-overlay">
          <div className="avatar-crop-sheet">
            <div className="avatar-crop-header">
              <h2>Adjust Photo</h2>
              <button type="button" onClick={() => setShowCropper(false)}>
                ×
              </button>
            </div>

            <div className="avatar-crop-box">
              <Cropper
                image={avatarPreviewUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedPixels) =>
                  setCroppedAreaPixels(croppedPixels)
                }
              />
            </div>

            <div className="avatar-zoom-control">
              <label>Zoom</label>
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </div>

            <button
              type="button"
              className="profile-save-btn"
              onClick={saveCroppedAvatar}
            >
              Save Photo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;