// Every page's stylesheet, loaded up front in the exact order the app
// originally evaluated them (before pages were code-split).
//
// Pages are lazy-loaded (lib/lazyPage), but their CSS must not be: many
// pages rely on classes from another page's stylesheet (e.g. the add-lesson
// form and rate chips), and on the cascade order between them. Loading CSS
// per page broke layouts across the app. JS stays split; CSS is ~36 KB
// gzipped, which is what every visitor downloaded before anyway.
//
// Order matters — keep new page CSS at the end unless it must override.

import "../pages/Login/Login.css";
import "../components/InstallGuide/InstallGuide.css";
import "../pages/Dashboard/Dashboard.css";
import "../pages/RecurringLessons/RecurringLessons.css";
import "../pages/Lessons/Lessons.css";
import "../pages/Students/Students.css";
import "../pages/Invoices/Invoices.css";
import "../pages/Profile/Profile.css";
import "../pages/ComingSoon/ComingSoon.css";
import "../pages/Privacy/Privacy.css";
import "../pages/Terms/Terms.css";
import "../components/RotatingWord/RotatingWord.css";
import "../pages/LandingPage/LandingPage.css";
import "../pages/SmsOptIn/SmsOptIn.css";
import "../pages/Upgrade/Upgrade.css";
import "../pages/Referrals/Referrals.css";
import "../components/DesktopLayout/DesktopLayout.css";
import "../components/PullToRefresh/PullToRefresh.css";
import "../pages/Support/Support.css";
import "../pages/More/More.css";
import "../pages/CoachingTimer/CoachingTimer.css";
import "../pages/AiAssistant/AiAssistant.css";
import "../pages/About/About.css";
import "../pages/Blog/Blog.css";
import "../pages/Settings/Settings.css";
import "../pages/MarkInvoicePaid/MarkInvoicePaid.css";
import "../pages/GroupLessons/GroupLessons.css";
import "../pages/GoogleCalendar/GoogleCalendar.css";
import "../pages/EarningsDashboard/EarningsDashboard.css";
import "../pages/PdfInvoice/PdfInvoice.css";
