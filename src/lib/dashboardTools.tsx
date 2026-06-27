import { FaChartLine, FaClock, FaFilePdf, FaGoogle, FaRedoAlt, FaRobot, FaUserFriends } from "react-icons/fa";
import type { useLessonTerm } from "../hooks/useLessonTerm";

export interface DashboardTool {
  slug: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  free: boolean;
  comingSoon?: boolean;
  comingSoonReason?: string;
}

type LessonTerm = ReturnType<typeof useLessonTerm>;

export function getDashboardTools(term: LessonTerm): DashboardTool[] {
  return [
    {
      slug: "recurring-lessons",
      icon: <FaRedoAlt />,
      title: `Recurring ${term.plural}`,
      desc: `Schedule repeating ${term.lowerPlural} for students automatically.`,
      free: true,
    },
    {
      slug: "group-lessons",
      icon: <FaUserFriends />,
      title: `Group ${term.plural}`,
      desc: `Schedule one ${term.lower} for multiple students at once.`,
      free: true,
    },
    {
      slug: "earnings-dashboard",
      icon: <FaChartLine />,
      title: "Earnings Dashboard",
      desc: `Weekly summary, income totals, and ${term.lower} stats at a glance.`,
      free: false,
    },
    {
      slug: "timer",
      icon: <FaClock />,
      title: `${term.singular} Timer`,
      desc: `Start and stop a live timer while teaching a ${term.lower}.`,
      free: false,
    },
    {
      slug: "pdf-invoice",
      icon: <FaFilePdf />,
      title: "PDF Invoices",
      desc: "Bill competitions, choreography, and travel with branded PDF invoices.",
      free: false,
    },
    {
      slug: "assistant",
      icon: <FaRobot />,
      title: "AI Assistant",
      desc: `Create ${term.lowerPlural} and invoices by chatting or speaking naturally.`,
      free: false,
    },
    {
      slug: "google-calendar",
      icon: <FaGoogle />,
      title: "Google Calendar Sync",
      desc: `Two-way sync your ${term.lowerPlural} and events with Google Calendar.`,
      free: false,
      comingSoon: true,
      comingSoonReason: "Currently unavailable — pending Google approval.",
    },
  ];
}

export function getDashboardTool(slug: string, term: LessonTerm) {
  return getDashboardTools(term).find((tool) => tool.slug === slug);
}
