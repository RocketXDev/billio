import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ProtectedRouteProps = {
    children: React.ReactNode
}

function ProtectedRoute({children }: ProtectedRouteProps) {
    const[loading, setLoading] = useState(true);
    const[isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        async function checkSession() {
            const { data } = await supabase.auth.getSession();

            setIsLoggedIn(!!data.session);
            setLoading(false);
        }

        checkSession();
    }, [])

    if (loading) {
        return <div className="p-6">Loading...</div>;
    }

    if (!isLoggedIn) {
        return <Navigate to="/login" />;
    }

    return children;

}

export default ProtectedRoute;