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

        const {data: authData, error: authError} = await supabase.auth.signUp({
            email,
            password
        })

        if (authError) {
            setMessage(authError.message);
            setLoading(false);
            return;
        }

        const user = authData.user;

        if (!user) {
            setMessage("Check your email to confirm your account.");
            setLoading(false);
            return;
        }

        const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .insert({
                user_id: user.id,
                full_name: fullName,
                email,
                role,
            })
            .select()
            .single();
    
        if (profileError) {
            setMessage(profileError.message);
            setLoading(false);
            return;
        }

        if (role === "coach") {
            const { error: coachError } = await supabase.from("coaches").insert({
                profile_id: profileData.id,
                full_name: fullName,
                active: true,
                setup_completed: false
            });

            if (coachError) {
                setMessage(coachError.message);
                setLoading(false);
                return;
            }

            navigate("/dashboard");
        }

        if (role === "student") {
            const { error: studentError } = await supabase.from("students").insert({
                profile_id: profileData.id,
                student_name: fullName,
                setup_completed: false,
                active: true
            });

            if (studentError) {
                setMessage(studentError.message);
                setLoading(false);
                return;
            }

            navigate("/dashboard");
        }

        setLoading(false);
    
    }

    return (
        <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-sm p-6">
            <h1 className="text-3xl font-bold text-[#0F172A]">
                Create Billio account
            </h1>

            <p className="text-[#64748B] mt-2">
                Start tracking lessons and billing faster.
            </p>

            <form onSubmit={handleSignup} className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => setRole("coach")}
                    className={`rounded-2xl p-3 font-semibold ${
                    role === "coach"
                        ? "bg-[#4F46E5] text-white"
                        : "bg-[#F7F8FC] text-[#64748B]"
                    }`}
                >
                    Coach
                </button>

                <button
                    type="button"
                    onClick={() => setRole("student")}
                    className={`rounded-2xl p-3 font-semibold ${
                    role === "student"
                        ? "bg-[#4F46E5] text-white"
                        : "bg-[#F7F8FC] text-[#64748B]"
                    }`}
                >
                    Student
                </button>
                </div>

                <input
                className="w-full rounded-2xl border p-3"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                />

                <input
                className="w-full rounded-2xl border p-3"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                />

                <input
                className="w-full rounded-2xl border p-3"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                />

                {message && <p className="text-sm text-red-500">{message}</p>}

                <button
                className="w-full rounded-2xl bg-[#4F46E5] text-white py-3 font-semibold"
                disabled={loading}
                >
                {loading ? "Creating..." : "Create account"}
                </button>
            </form>

            <p className="text-sm text-[#64748B] mt-4">
                Already have an account?{" "}
                <Link to="/login" className="text-[#4F46E5] font-semibold">
                Log in
                </Link>
            </p>
            </div>
        </div>
    );
}

export default Signup;