import { FaChartLine, FaClock, FaFilePdf, FaRedoAlt } from "react-icons/fa";

export interface DashboardTool {
  slug: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  free: boolean;
}

export const DASHBOARD_TOOLS: DashboardTool[] = [
  {
    slug: "recurring-lessons",
    icon: <FaRedoAlt />,
    title: "Recurring Lessons",
    desc: "Schedule repeating lessons for students automatically.",
    free: true,
  },
  {
    slug: "earnings-dashboard",
    icon: <FaChartLine />,
    title: "Earnings Dashboard",
    desc: "Weekly summary, income totals, and lesson stats at a glance.",
    free: false,
  },
  {
    slug: "timer",
    icon: <FaClock />,
    title: "Lesson Timer",
    desc: "Start and stop a live timer while teaching a lesson.",
    free: false,
  },
  {
    slug: "pdf-invoice",
    icon: <FaFilePdf />,
    title: "PDF Invoices",
    desc: "Bill competitions, choreography, and travel with branded PDF invoices.",
    free: false,
  },
];

export function getDashboardTool(slug: string) {
  return DASHBOARD_TOOLS.find((tool) => tool.slug === slug);
}
