// Builds a PDF for a regular (lesson-based) invoice, reusing the same visual
// conventions as PdfInvoice.tsx's custom-invoice generator, but with a table
// built from real lesson rows instead of freeform line items. Returns a Blob
// so the caller can upload it to Storage, rather than triggering a download.

type InvoiceLessonRow = {
  lesson_date: string;
  start_time: string;
  duration_minutes: number;
  hourly_rate?: number | null;
  rate: number;
};

type GenerateInvoicePdfArgs = {
  businessName: string;
  accentColor: string;
  logoUrl?: string;
  footerNote?: string;
  studentName: string;
  invoiceNumber: string;
  issueDate?: string;
  dueDate?: string;
  lessons: InvoiceLessonRow[];
  total: number;
};

function money(n: any) {
  return Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function hexToRgb(hex: string) {
  const h = (hex || "#3b33d9").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function formatTime(timeStr: string) {
  if (!timeStr) return "";
  const [h, m] = timeStr.slice(0, 5).split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHours = h % 12 === 0 ? 12 : h % 12;
  return `${displayHours}:${String(m).padStart(2, "0")} ${period}`;
}

export async function generateInvoicePdf(args: GenerateInvoicePdfArgs): Promise<Blob> {
  const { businessName, accentColor, logoUrl, footerNote, studentName, invoiceNumber, issueDate, dueDate, lessons, total } = args;

  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  const rgb = hexToRgb(accentColor);
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.rect(0, 0, pageW, 10, "F");

  if (logoUrl) {
    try {
      const img = await loadImage(logoUrl);
      doc.addImage(img, "PNG", margin, y, 90, 90 * (img.height / img.width));
      y += 100;
    } catch {
      /* skip logo on failure */
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text(businessName || "Invoice", margin, y + 10);
  y += 28;

  // invoice meta (right side)
  let metaY = margin + (logoUrl ? 100 : 0);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(invoiceNumber, pageW - margin, metaY + 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  metaY += 26;
  if (issueDate) {
    doc.text(`Issued ${formatDate(issueDate)}`, pageW - margin, metaY, { align: "right" });
    metaY += 14;
  }
  if (dueDate) {
    doc.text(`Due ${formatDate(dueDate)}`, pageW - margin, metaY, { align: "right" });
    metaY += 14;
  }

  y = Math.max(y, metaY) + 20;

  // bill to
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.text("BILL TO", margin, y);
  y += 14;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(studentName || "Student", margin, y);
  y += 16;
  y += 16;

  // table header — Date / Time / Duration / Rate / Amount
  doc.setFillColor(rgb.r, rgb.g, rgb.b);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.rect(margin, y, pageW - margin * 2, 24, "F");
  doc.text("Date", margin + 10, y + 16);
  doc.text("Time", pageW - margin - 260, y + 16, { align: "right" });
  doc.text("Duration", pageW - margin - 180, y + 16, { align: "right" });
  doc.text("Rate", pageW - margin - 95, y + 16, { align: "right" });
  doc.text("Amount", pageW - margin - 10, y + 16, { align: "right" });
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  lessons.forEach((lesson, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(245, 246, 248);
      doc.rect(margin, y, pageW - margin * 2, 22, "F");
    }
    doc.setFontSize(10);
    doc.text(formatDate(lesson.lesson_date), margin + 10, y + 15);
    doc.text(formatTime(lesson.start_time), pageW - margin - 260, y + 15, { align: "right" });
    doc.text(`${lesson.duration_minutes} min`, pageW - margin - 180, y + 15, { align: "right" });
    doc.text(lesson.hourly_rate ? `${money(lesson.hourly_rate)}/hr` : "—", pageW - margin - 95, y + 15, { align: "right" });
    doc.text(money(lesson.rate), pageW - margin - 10, y + 15, { align: "right" });
    y += 22;
  });

  // total
  y += 10;
  doc.setDrawColor(229, 231, 235);
  doc.line(pageW - margin - 200, y, pageW - margin, y);
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Total", pageW - margin - 120, y, { align: "right" });
  doc.setTextColor(rgb.r, rgb.g, rgb.b);
  doc.text(money(total), pageW - margin - 10, y, { align: "right" });

  if (footerNote) {
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(
      doc.splitTextToSize(footerNote, pageW - margin * 2),
      margin,
      doc.internal.pageSize.getHeight() - margin
    );
  }

  return doc.output("blob");
}
