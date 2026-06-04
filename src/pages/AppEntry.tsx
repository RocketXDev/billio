import { Navigate } from "react-router-dom";

export default function AppEntry({ session }: { session: any }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}