import { useState} from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    async function handleLogin(e:React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        const {error} = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            setMessage(error.message);
            setLoading(false);
            return;
        }

        setLoading(true);
        navigate("/dashboard");

    }

    return (
        <div className="min-h-screen bg-[#F7F8FC] flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-sm p-6">
                <h1 className="text-3xl font-bold text-[#0F172A]">Welcome back</h1>
                <p className="text-[#64748B] mt-2">
                Log in to manage your lessons.
                </p>

                <form onSubmit={handleLogin} className="mt-6 space-y-4">
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
                    {loading ? "Logging in..." : "Log in"}
                </button>
                </form>

                <p className="text-sm text-[#64748B] mt-4">
                New to Billio?{" "}
                <Link to="/signup" className="text-[#4F46E5] font-semibold">
                    Create account
                </Link>
                </p>
            </div>
        </div>
    );
}

export default Login;