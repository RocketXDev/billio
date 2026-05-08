import { useState} from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import "../App.css"

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
        <>
            <div className="mb">
                <div className="mb-wrapper">
                    <img className="mb-logo" src="./logo.png" alt="" />
                    <div className="mb-form">
                        <img className="mb-form-logo" 
                            alt="Login Illustration" 
                            src="./login_logo.png">
                        </img>
                        <div className="mb-form-title">Login</div>
                        <form onSubmit={handleLogin}>
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
                            <div className="mb-fp-link">Forgot Password?</div>
                            {message && (
                                <p className="error-message">
                                    {message}
                                </p>
                            )}
                            <button type="submit" disabled={loading}>{loading ? "Logging in..." : "Login"}</button>
                        </form>
                    </div>
                    <div className="mb-signup">Don't have an account? <Link to="/signup">Sign Up</Link></div>
                </div>
            </div>
        </>
        
    );
}

export default Login;