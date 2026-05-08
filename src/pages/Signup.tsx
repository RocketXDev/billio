import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function Signup() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<"coach" | "student">("coach");
    const [password, setPassword] = useState("");
    
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
                role: role,
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
            <div className="mb">
                <div className="mb-wrapper">
                    <img className="mb-logo" src="/logo.png" alt="Billio logo" />

                    <div className="mb-form">
                    <img
                        className="mb-form-logo"
                        src="/signup_logo.png"
                        alt="Signup illustration"
                    />

                    <div className="mb-form-title">Sign Up</div>

                    <form onSubmit={handleSignup}>
                        <div className="role-toggle">
                        <div
                            className={`role-slider ${
                            role === "student" ? "role-slider-right" : ""
                            }`}
                        />

                        <button
                            type="button"
                            className={`role-option ${
                            role === "coach" ? "role-option-active" : ""
                            }`}
                            onClick={() => setRole("coach")}
                        >
                            Coach
                        </button>

                        <button
                            type="button"
                            className={`role-option ${
                            role === "student" ? "role-option-active" : ""
                            }`}
                            onClick={() => setRole("student")}
                        >
                            Student
                        </button>
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
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
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
            </div>
        </>
    );
}

export default Signup;