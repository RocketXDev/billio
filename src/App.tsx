import {Routes, Route, Navigate} from "react-router-dom";
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './pages/ProtectedRoute';
import EmailConfirmed from "./pages/EmailConfirmed";
import VerifyEmail from "./pages/VerifyEmail";
import UpdatePassword from "./pages/UpdatePassword";
import ForgotPassword from "./pages/ForgotPassword";
import PasswordUpdated from "./pages/PasswordUpdated";
import Lessons from "./pages/Lessons";
import Students from "./pages/Students";
import Invoices from "./pages/Invoices";
import Profile from "./pages/Profile";
import ComingSoon from "./pages/ComingSoon";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import LandingPage from "./pages/LandingPage";
import AppEntry from "./pages/AppEntry";

function App() {

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/email-confirmed" element={<EmailConfirmed />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/update-password" element={<UpdatePassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/password-updated" element={<PasswordUpdated />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppEntry />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lessons"
        element={
          <ProtectedRoute>
            <Lessons />
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute>
            <Students />
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices"
        element={
          <ProtectedRoute>
            <Invoices />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <ComingSoon />
          </ProtectedRoute>
        }
      />

      <Route
        path="/more"
        element={
          <ProtectedRoute>
            <ComingSoon />
          </ProtectedRoute>
        }
      />

    </Routes>
  );
}

export default App;