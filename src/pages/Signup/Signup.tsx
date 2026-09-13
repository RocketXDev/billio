import '../Login/Login.css';
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaCheckCircle, FaGift, FaTimesCircle } from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { PROFESSIONS } from "../../lib/professions";
import {
    clearStoredReferralCode,
    lookupReferralCode,
    resolveReferralCode,
    storeReferralCode,
} from "../../lib/referral";

function Signup() {
    const navigate = useNavigate();
    const location = useLocation();

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [profession, setProfession] = useState(PROFESSIONS[0].value);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Prefilled from the invite link's `?ref=CODE`, falling back to a code
    // stashed by an earlier page (someone who landed on "/" first). Resolved
    // during render, not from an effect, so the field is already filled on the
    // very first paint rather than appearing a beat later.
    //
    // Nothing to prefill means nothing shown: the field stays collapsed behind
    // "Have a referral code?".
    const [linkedCode] = useState(() => resolveReferralCode(location.search));
    const [referralCode, setReferralCode] = useState(linkedCode);
    const [showReferralField, setShowReferralField] = useState(!!linkedCode);
    const [referralCheck, setReferralCheck] = useState<
        { state: "idle" | "checking" } | { state: "valid"; name: string } | { state: "invalid" }
    >({ state: "idle" });

    // Debounced so a code isn't looked up on every keystroke. Codes are 7
    // characters, so anything shorter is still mid-typing.
    useEffect(() => {
        const trimmed = referralCode.trim();

        if (trimmed.length < 4) {
            setReferralCheck({ state: "idle" });
            return;
        }

        setReferralCheck({ state: "checking" });

        // `cancelled` covers the request that's already in flight when the
        // next keystroke lands — clearing the timer alone would still let a
        // stale answer overwrite a newer one.
        let cancelled = false;

        const timer = window.setTimeout(async () => {
            const result = await lookupReferralCode(trimmed);
            if (cancelled) return;
            setReferralCheck(
                result.valid ? { state: "valid", name: result.name } : { state: "invalid" }
            );
        }, 400);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [referralCode]);

    async function handleSignup(e: any) {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        let enteredCode = "";
        if (referralCode.trim()) {
            enteredCode = storeReferralCode(referralCode);
        } else {
            // They deleted a code that arrived from a link. Respect that
            // rather than quietly re-attaching the stored copy at first login.
            clearStoredReferralCode();
        }

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
            emailRedirectTo: `${window.location.origin}/email-confirmed`,
            data: {
                full_name: fullName,
                role: "coach",
                profession,
                // Second copy of the referral code: localStorage can be gone
                // by the time they confirm the email and first sign in (a
                // different browser profile, cleared storage), and user
                // metadata survives all of that.
                ...(enteredCode ? { referral_code: enteredCode } : {}),
            },
            },
        });

        if (error) {
            setMessage(error.message);
            setLoading(false);
            return;
        }

        setLoading(false);
        navigate("/verify-email");
    }

    return (
        <>
            <div className="mb mb-reverse">
                <div className="mb-wrapper">
                    <img className="mb-logo" src="/logo-white.png" alt="Billio logo" />

                    <div className="mb-form">
                    <img
                        className="mb-form-logo"
                        src="/signup_logo.png"
                        alt="Signup illustration"
                    />

                    <h1 className="mb-form-title">Sign Up</h1>

                    {/* Hidden once the code turns out to be bad — "you were invited"
                        sitting above "we don't recognise that code" is worse than
                        showing nothing. */}
                    {linkedCode && referralCheck.state !== "invalid" && (
                        <div className="signup-referral-note">
                            <FaGift />
                            <span>
                                You were invited to Billio — your 30-day Pro trial is ready.
                            </span>
                        </div>
                    )}

                    <form onSubmit={handleSignup}>
                        <div className="input-block">
                        <label htmlFor="profession">What best describes you?</label>
                        <select
                            id="profession"
                            className="profession-select"
                            value={profession}
                            onChange={(e) => setProfession(e.target.value)}
                        >
                            {PROFESSIONS.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                            ))}
                        </select>
                        </div>

                        <div className="input-block">
                        <label htmlFor="fullName">Full Name</label>
                        <input
                            id="fullName"
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                        </div>

                        <div className="input-block">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        </div>

                        <div className="input-block">
                            <label htmlFor="password">Password</label>

                            <div className="password-wrapper">
                                <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                />

                                <button
                                type="button"
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                >
                                {showPassword ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        {showReferralField ? (
                            <div className="input-block">
                                <label htmlFor="referralCode">Referral code (optional)</label>
                                <input
                                    id="referralCode"
                                    type="text"
                                    autoCapitalize="characters"
                                    autoComplete="off"
                                    spellCheck={false}
                                    placeholder="e.g. K7QM2XP"
                                    value={referralCode}
                                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                                />

                                {referralCheck.state === "checking" && (
                                    <p className="signup-referral-status">Checking code…</p>
                                )}
                                {referralCheck.state === "valid" && (
                                    <p className="signup-referral-status valid">
                                        <FaCheckCircle /> Referred by {referralCheck.name}
                                    </p>
                                )}
                                {referralCheck.state === "invalid" && (
                                    <p className="signup-referral-status invalid">
                                        <FaTimesCircle /> We don't recognise that code — check it, or
                                        leave it blank.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="signup-referral-toggle"
                                onClick={() => setShowReferralField(true)}
                            >
                                Have a referral code?
                            </button>
                        )}

                        {message && <p className="error-message">{message}</p>}

                        <button type="submit" disabled={loading}>
                        {loading ? "Creating..." : "Create Account"}
                        </button>
                    </form>
                    </div>

                    <div className="mb-signup">
                    Already have an account? <Link to="/login">Login</Link>
                    </div>
                </div>

                <div className="mb-desktop-aside">
                    <div className="mb-desktop-aside-inner">
                        <img src="/logo-white.png" alt="Billio" className="mb-desktop-logo" />
                        <span className="mb-desktop-badge">Built for coaches, tutors &amp; more</span>
                        <p className="mb-desktop-heading">Billing made simple.</p>
                        <p>Join coaches, tutors, instructors, and more who run their practice on Billio.</p>
                        <ul className="mb-desktop-points">
                            <li><span className="mb-desktop-point-icon"><FaCheckCircle /></span> Free plan, no credit card required</li>
                            <li><span className="mb-desktop-point-icon"><FaCheckCircle /></span> 30-day Pro trial on signup</li>
                            <li><span className="mb-desktop-point-icon"><FaCheckCircle /></span> Set up your profile in minutes</li>
                        </ul>
                    </div>
                </div>
            </div>
        </>
    );
}

export default Signup;