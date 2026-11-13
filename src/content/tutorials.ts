// Tutorial videos shown on /tutorials. Each one is public/media/tutorials/<slug>.mp4
// with a <slug>.jpg thumbnail. Bump VIDEO_VERSION after re-recording any of
// them so browsers fetch the new files instead of a cached copy.

export const VIDEO_VERSION = 1;

export type Tutorial = {
  slug: string;
  title: string;
  description: string;
  seconds: number;
};

export type TutorialSection = {
  title: string;
  tutorials: Tutorial[];
};

export const TUTORIAL_SECTIONS: TutorialSection[] = [
  {
    title: "Getting started",
    tutorials: [
      { slug: "00-getting-started", title: "Getting started", seconds: 46,
        description: "Create your account, confirm your email and set up your profile." },
    ],
  },
  {
    title: "Lessons and students",
    tutorials: [
      { slug: "01-add-a-lesson", title: "Adding a lesson", seconds: 28,
        description: "Put a lesson on your calendar in a few taps." },
      { slug: "02-repeating-lessons", title: "Repeating lessons", seconds: 28,
        description: "Schedule a weekly lesson once and it fills your calendar." },
      { slug: "03-add-a-student", title: "Adding a student", seconds: 30,
        description: "Save a student and the parent who gets their invoices." },
      { slug: "04-group-classes", title: "Group classes", seconds: 31,
        description: "Teach several students at once and bill each of them." },
      { slug: "10-lesson-reminders", title: "Lesson reminders", seconds: 21,
        description: "Remind families automatically before each lesson." },
    ],
  },
  {
    title: "Invoices",
    tutorials: [
      { slug: "05-create-an-invoice", title: "Creating an invoice", seconds: 20,
        description: "Turn a student's unbilled lessons into one invoice." },
      { slug: "06-send-an-invoice", title: "Sending an invoice", seconds: 16,
        description: "Send it by email or text with one tap." },
      { slug: "07-combined-invoices", title: "Combined invoices for siblings", seconds: 17,
        description: "One message for brothers and sisters with the same parent." },
      { slug: "08-mark-an-invoice-paid", title: "Marking an invoice paid", seconds: 14,
        description: "Record cash or check payments in a tap." },
      { slug: "09-automatic-invoices", title: "Automatic invoices", seconds: 24,
        description: "Let Billio create and send invoices on your schedule." },
    ],
  },
  {
    title: "Getting paid",
    tutorials: [
      { slug: "11-venmo-paypal-zelle", title: "Venmo, PayPal and Zelle", seconds: 26,
        description: "Show parents how to pay you on every invoice." },
      { slug: "12-accept-card-payments", title: "Accepting card payments", seconds: 21,
        description: "Let parents pay by card or Apple Pay." },
      { slug: "13-earnings-and-export", title: "Earnings and exports", seconds: 19,
        description: "See what you've earned and download a spreadsheet." },
    ],
  },
];

export const ALL_TUTORIALS = TUTORIAL_SECTIONS.flatMap((section) => section.tutorials);

export const tutorialFile = (slug: string, ext: "mp4" | "jpg") =>
  `/media/tutorials/${slug}.${ext}?v=${VIDEO_VERSION}`;

export const formatLength = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
