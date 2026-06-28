import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
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
import AiAssistant from "./pages/AiAssistant/AiAssistant";
import About from "./pages/About/About";
import BlogIndex from "./pages/Blog/BlogIndex";
import BlogPost from "./pages/Blog/BlogPost";
import Settings from "./pages/Settings/Settings";
import MarkInvoicePaid from "./pages/MarkInvoicePaid/MarkInvoicePaid";
import RecurringLessons from "./pages/RecurringLessons/RecurringLessons";
import GroupLessons from "./pages/GroupLessons/GroupLessons";
import GoogleCalendar from "./pages/GoogleCalendar/GoogleCalendar";
import EarningsDashboard from "./pages/EarningsDashboard/EarningsDashboard";
import PdfInvoice from "./pages/PdfInvoice/PdfInvoice";

const SITE_URL = "https://www.mybillioapp.com";

// Per-route <title> and meta description for public pages. This is a
// client-rendered SPA sharing one index.html, so every route otherwise
// inherits the same title/description ("/" keeps index.html's own, which is
// already correct — everything else here overrides it after mount).
const PAGE_META: Record<string, { title: string; description: string }> = {
  "/login": {
    title: "Login | Billio",
    description: "Log in to your Billio account to manage students, schedule lessons, and track invoices.",
  },
  "/signup": {
    title: "Sign Up Free | Billio",
    description: "Create your free Billio account — no credit card required. Start scheduling lessons and automating invoices today.",
  },
  "/about": {
    title: "About Billio | Billing Made Simple for Coaches",
    description: "Learn about Billio, the mobile-first scheduling and invoicing app built for coaches, tutors, instructors, teachers, nannies, and therapists.",
  },
  "/blog": {
    title: "Blog | Billio",
    description: "Scheduling, billing, and admin advice for coaches, tutors, instructors, and music educators — from the team building Billio.",
  },
  "/support": {
    title: "Support | Billio",
    description: "Get help with Billio — contact our support team for questions about scheduling, invoicing, billing, or your account.",
  },
  "/privacy": {
    title: "Privacy Policy | Billio",
    description: "Read Billio's Privacy Policy to learn how we collect, use, and protect your information. We never sell your personal data.",
  },
  "/terms": {
    title: "Terms of Service | Billio",
    description: "Read Billio's Terms and Conditions covering use of the app, billing, and your account.",
  },
  "/sms-opt-in": {
    title: "SMS Consent | Billio",
    description: "Details on Billio's SMS messaging program, consent, and how to opt out of text message reminders.",
  },
};

function App() {
  const location = useLocation();

  // Captured once, on the very first render, before any effect below has a
  // chance to overwrite them — these are index.html's original tags, used
  // as the fallback for any route not in PAGE_META. og:title/og:description
  // differ from the plain title/description in index.html, so each needs
  // its own original value rather than reusing one for the other.
  const defaultMetaRef = useRef({
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? "",
    ogDescription: document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? "",
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? "",
    ogType: document.querySelector('meta[property="og:type"]')?.getAttribute("content") ?? "website",
    twitterTitle: document.querySelector('meta[name="twitter:title"]')?.getAttribute("content") ?? "",
    twitterDescription: document.querySelector('meta[name="twitter:description"]')?.getAttribute("content") ?? "",
    twitterImage: document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ?? "",
  });

  // This is a client-rendered SPA with one index.html for every route, so
  // there's no per-page canonical tag from the server. Keep a single
  // <link rel="canonical"> in <head> in sync with the current path instead —
  // a static one in index.html would point every route at "/", which is
  // worse than having none (Google would treat every other page as a
  // duplicate of the homepage).
  useEffect(() => {
    const path = location.pathname === "/" ? "/" : location.pathname.replace(/\/+$/, "");
    const canonicalUrl = `${SITE_URL}${path}`;

    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonicalUrl);

    // og:url was previously static (always the homepage) — every shared
    // page looked like a duplicate of "/" in link previews. Keep it in sync
    // with the canonical URL for every route, including blog posts.
    const ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute("content", canonicalUrl);
  }, [location.pathname]);

  useEffect(() => {
    // Individual blog posts (/blog/:slug) set their own title/description/
    // canonical from post data in BlogPost.tsx — bail out here so this
    // effect (which only knows the static PAGE_META map) doesn't stomp on
    // them. Effects run child-first on mount, so without this guard this
    // effect would run after BlogPost's and overwrite it back to the
    // index.html defaults.
    if (/^\/blog\/.+/.test(location.pathname)) return;

    // Unmapped routes (incl. "/") fall back to index.html's own original
    // tags — captured once on first render, before any route here has had
    // a chance to overwrite them, so navigating from e.g. /privacy back to
    // "/" within the SPA (no full reload) correctly restores them instead
    // of leaving the previous page's title/description stuck.
    const pageMeta = PAGE_META[location.pathname];
    const defaults = defaultMetaRef.current;
    const title = pageMeta?.title ?? defaults.title;
    const description = pageMeta?.description ?? defaults.description;
    const ogTitleValue = pageMeta?.title ?? defaults.ogTitle;
    const ogDescriptionValue = pageMeta?.description ?? defaults.ogDescription;

    document.title = title;

    const descTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (descTag) descTag.setAttribute("content", description);

    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", ogTitleValue);

    const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", ogDescriptionValue);

    // Reset the image/type/Twitter tags to their defaults on every
    // non-blog-post route. Blog posts set their own (post hero image,
    // og:type "article") in BlogPost.tsx — this is what restores the
    // defaults once you navigate away from one.
    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
    if (ogImage) ogImage.setAttribute("content", defaults.ogImage);

    const ogType = document.querySelector<HTMLMetaElement>('meta[property="og:type"]');
    if (ogType) ogType.setAttribute("content", defaults.ogType);

    const twitterTitle = document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]');
    if (twitterTitle) twitterTitle.setAttribute("content", ogTitleValue || defaults.twitterTitle);

    const twitterDescription = document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]');
    if (twitterDescription) twitterDescription.setAttribute("content", ogDescriptionValue || defaults.twitterDescription);

    const twitterImage = document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]');
    if (twitterImage) twitterImage.setAttribute("content", defaults.twitterImage);
  }, [location.pathname]);

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
      <Route path="/blog" element={<BlogIndex />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
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
        path="/assistant"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <AiAssistant />
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
        path="/group-lessons"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <GroupLessons />
            </DesktopLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/google-calendar"
        element={
          <ProtectedRoute>
            <DesktopLayout>
              <GoogleCalendar />
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
