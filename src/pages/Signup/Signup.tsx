import '../Login/Login.css';
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash, FaCheckCircle } from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import { PROFESSIONS } from "../../lib/professions";

function Signup() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [profession, setProfession] = useState(PROFESSIONS[0].value);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    async function handleSignup(e: any) {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
            emailRedirectTo: `${window.location.origin}/email-confirmed`,
            data: {
                full_name: fullName,
                role: "coach",
                profession,
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