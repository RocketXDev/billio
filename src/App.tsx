import {Routes, Route, Navigate} from "react-router-dom";
import Login from './pages/Login/Login';
import Signup from './pages/Signup/Signup';
import Dashboard from './pages/Dashboard/Dashboard';
import ProtectedRoute from './pages/ProtectedRoute/ProtectedRoute';
import EmailConfirmed from "./pages/EmailConfirmed/EmailConfirmed";
import VerifyEmail from "./pages/VerifyEmail/VerifyEmail";
import UpdatePassword from "./pages/UpdatePassword/UpdatePassword";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import PasswordUpdated from "./pages/PasswordUpdated/PasswordUpdated";
import Lessons from "./pages/Lessons/Lessons";
import Students from "./pages/Students/Students";
import Invoices from "./pages/Invoices/Invoices";
import Profile from "./pages/Profile/Profile";
import ComingSoon from "./pages/ComingSoon/ComingSoon";
import Privacy from "./pages/Privacy/Privacy";
import Terms from "./pages/Terms/Terms";
import LandingPage from "./pages/LandingPage/LandingPage";
import AppEntry from "./pages/AppEntry/AppEntry";
import SmsOptIn from "./pages/SmsOptIn/SmsOptIn";
import Upgrade from "./pages/Upgrade/Upgrade";
import DesktopLayout from "./components/DesktopLayout/DesktopLayout";
import Support from "./pages/Support/Support";
import More from "./pages/More/More";
import CoachingTimer from "./pages/CoachingTimer/CoachingTimer";
import About from "./pages/About/About";
import Settings from "./pages/Settings/Settings";
import MarkInvoicePaid from "./pages/MarkInvoicePaid/MarkInvoicePaid";
import RecurringLessons from "./pages/RecurringLessons/RecurringLessons";
import EarningsDashboard from "./pages/EarningsDashboard/EarningsDashboard";
import PdfInvoice from "./pages/PdfInvoice/PdfInvoice";

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
      <Route path="/sms-opt-in" element={<SmsOptIn />} />
      <Route path="/support" element={<Support />} />
      <Route path="/about" element={<About />} />
      <Route path="/mark-invoice-paid" element={<MarkInvoicePaid />} />
      <Route path="/pay" element={<MarkInvoicePaid />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <AppEntry />
            </DesktopLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <Dashboard />
            </DesktopLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/lessons"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <Lessons />
            </DesktopLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/students"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <Students />
            </DesktopLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <Invoices />
            </DesktopLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <Profile />
            </DesktopLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <Settings />
            </DesktopLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/more"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <More />
            </DesktopLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/timer"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <CoachingTimer />
            </DesktopLayout>
          </ProtectedRoute>
        }
      />

      <Route 
        path="/recurring-lessons" 
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <RecurringLessons />
            </DesktopLayout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/earnings-dashboard" 
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <EarningsDashboard />
            </DesktopLayout>
          </ProtectedRoute>
        } 
      />

      <Route 
        path="/pdf-invoice" 
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <PdfInvoice />
            </DesktopLayout>
          </ProtectedRoute>
        } 
      />

      <Route
        path="/upgrade"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <Upgrade />
            </DesktopLayout>
          </ProtectedRoute>
        }
      />

    </Routes>
  );
}

export default App;
