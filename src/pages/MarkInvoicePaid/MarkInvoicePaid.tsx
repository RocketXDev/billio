// src/pages/MarkInvoicePaid/MarkInvoicePaid.tsx
// ONE component for both flows:
//
//  • Student / client (from email or SMS link):  ?token=<token>
//      → validates via get-payment-reminder-invoice, writes via mark-invoice-paid
//
//  • Coach (in-app, authenticated):  pass invoiceId prop, or ?invoice=<id>
//      → loads the invoice directly and writes with the coach's own
//        authenticated Supabase client (no token, no edge function)
//
// Route usage (either mode):
//   <Route path="/pay" element={<MarkInvoicePaid />} />
//
// Modal usage from the invoices list (coach mode) — lets you drop the
// separate CoachMarkInvoicePaid component:
//   const [payingInvoice, setPayingInvoice] = useState<any>(null);
//   {payingInvoice && (
//     <MarkInvoicePaid
//       invoiceId={payingInvoice.id}
//       asModal
//       onClose={() => setPayingInvoice(null)}
//       onPaid={() => { setPayingInvoice(null); refreshInvoices(); }}
//     />
//   )}

import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useLessonTerm } from "../../hooks/useLessonTerm";
import "./MarkInvoicePaid.css";

type State = "loading" | "confirm" | "success" | "already_paid" | "error";

interface MarkInvoicePaidProps {
  // Coach mode: pass the invoice id directly (e.g. from the invoices list).
  invoiceId?: string;
  // Render as an overlay modal instead of a full page.
  asModal?: boolean;
  // Called when the modal should close (modal mode).
  onClose?: () => void;
  // Called after a successful mark-paid so the parent can refresh.
  onPaid?: (invoiceId: string) => void;
}

export default function MarkInvoicePaid({
  invoiceId: invoiceIdProp,
  asModal = false,
  onClose,
  onPaid,
}: MarkInvoicePaidProps = {}) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const term = useLessonTerm();

  const token = searchParams.get("token");
  const invoiceId = invoiceIdProp || searchParams.get("invoice") || null;

  // Student mode when there's a token; otherwise coach (authenticated) mode.
  const mode: "student" | "coach" = token ? "student" : "coach";

  const [state, setState] = useState<State>("loading");
  const [invoice, setInvoice] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (mode === "student") {
      if (!token) {
        setErrorMsg("No token provided.");
        setState("error");
        return;
      }
      validateToken();
    } else {
      if (!invoiceId) {
        setErrorMsg("No invoice specified.");
        setState("error");
        return;
      }
      loadInvoice();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, invoiceId]);

  // ── Student: validate the token via the edge function ──────────────
  async function validateToken() {
    try {
      const { data, error } = await supabase.functions.invoke(
        "get-payment-reminder-invoice",
        { body: { token } }
      );

      if (error || data?.error) {
        setErrorMsg(data?.error || error?.message || "Invalid or expired link.");
        setState("error");
        return;
      }

      setInvoice(data.invoice);
      setState(data.already_paid ? "already_paid" : "confirm");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
      setState("error");
    }
  }

  // ── Coach: load the invoice directly (RLS: coach owns it) ──────────
  async function loadInvoice() {
    try {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, status, due_date, students(student_name)")
        .eq("id", invoiceId)
        .single();

      if (error || !data) {
        setErrorMsg(error?.message || "Invoice not found.");
        setState("error");
        return;
      }

      setInvoice(data);
      setState(data.status === "paid" ? "already_paid" : "confirm");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
      setState("error");
    }
  }

  // ── Mark paid — branches by mode ───────────────────────────────────
  async function handleMarkPaid() {
    if (marking) return;
    setMarking(true);
    setErrorMsg("");

    try {
      if (mode === "student") {
        // Token flow — edge function does the writes with service role.
        const { data, error } = await supabase.functions.invoke("mark-invoice-paid", {
          body: { token },
        });

        if (error || data?.error) {
          setErrorMsg(data?.error || error?.message || "Could not mark as paid.");
          setState("error");
          return;
        }

        setInvoice(data.invoice);
        setState("success");
        onPaid?.(data.invoice?.id || invoiceId || "");
      } else {
        // Coach flow — direct authenticated writes.
        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            paid_via: "coach_manual",
          })
          .eq("id", invoiceId);

        if (invoiceError) throw invoiceError;

        const { data: invoiceLessons, error: lessonsLookupError } = await supabase
          .from("invoice_lessons")
          .select("lesson_id")
          .eq("invoice_id", invoiceId);

        if (lessonsLookupError) throw lessonsLookupError;

        const lessonIds = (invoiceLessons || [])
          .map((item: any) => item.lesson_id)
          .filter(Boolean);

        if (lessonIds.length > 0) {
          const { error: lessonsUpdateError } = await supabase
            .from("lessons")
            .update({ billing_status: "paid" })
            .in("id", lessonIds);

          if (lessonsUpdateError) throw lessonsUpdateError;
        }

        setState("success");
        onPaid?.(invoiceId || "");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
      setState("error");
    } finally {
      setMarking(false);
    }
  }

  // Close (modal) or go back to the app (route).
  function dismiss() {
    if (onClose) onClose();
    else navigate("/invoices");
  }

  if (state === "loading") {
    return (
      <div className="loading-screen">
        <div className="billio-loader">
          <div className="billio-loader-glow" />
          <img className="billio-loader-logo" src="/logo.png" alt="Billio" />
        </div>
      </div>
    );
  }

  const studentName = invoice?.students?.student_name || "Student";
  const invoiceNumber = invoice?.invoice_number || "Invoice";
  const total = invoice ? `$${Number(invoice.total || 0).toFixed(2)}` : "";

  const card = (
    <div className="mip-card">
      <img src="/logo.png" alt="Billio" className="mip-logo" />

      {/* Confirm */}
      {state === "confirm" && (
        <>
          <div className="mip-icon warning">?</div>
          <h2 className="mip-title">Mark Invoice as Paid?</h2>

          <div className="mip-invoice-card">
            <div className="mip-invoice-number">{invoiceNumber}</div>
            <div className="mip-invoice-student">{studentName}</div>
            <div className="mip-invoice-amount">{total}</div>
            {invoice?.due_date && (
              <div className="mip-invoice-due">Due date was {invoice.due_date}</div>
            )}
          </div>

          <p className="mip-subtitle">
            Confirming will mark this invoice as paid and update all linked {term.lower}
            statuses in Billio.
          </p>

          <button
            type="button"
            className="mip-btn-primary"
            onClick={handleMarkPaid}
            disabled={marking}
          >
            {marking ? "Marking as paid..." : "✓ Yes, mark as paid"}
          </button>

          <button
            type="button"
            className="mip-btn-secondary"
            onClick={dismiss}
            disabled={marking}
          >
            {mode === "student" ? "Open app instead" : "Cancel"}
          </button>

          {mode === "student" && (
            <p className="mip-disclaimer">
              This link expires in 7 days. If you already marked this paid in the app, ignore this.
            </p>
          )}
        </>
      )}

      {/* Success */}
      {state === "success" && (
        <>
          <div className="mip-icon success">✓</div>
          <h2 className="mip-title">Invoice Marked as Paid</h2>

          <div className="mip-invoice-card">
            <div className="mip-invoice-number">{invoiceNumber}</div>
            <div className="mip-invoice-student">{studentName}</div>
            <div className="mip-invoice-amount">{total}</div>
          </div>

          <p className="mip-subtitle">
            This invoice has been marked as paid and {term.lower} statuses have been
            updated in Billio.
          </p>

          <button type="button" className="mip-btn-primary" onClick={dismiss}>
            {onClose ? "Done" : "Open Billio"}
          </button>
        </>
      )}

      {/* Already paid */}
      {state === "already_paid" && (
        <>
          <div className="mip-icon info">✓</div>
          <h2 className="mip-title">Already Paid</h2>

          <div className="mip-invoice-card">
            <div className="mip-invoice-number">{invoiceNumber}</div>
            <div className="mip-invoice-student">{studentName}</div>
            <div className="mip-invoice-amount">{total}</div>
          </div>

          <p className="mip-subtitle">
            This invoice was already marked as paid in Billio.
          </p>

          <button type="button" className="mip-btn-primary" onClick={dismiss}>
            {onClose ? "Done" : "Open Billio"}
          </button>
        </>
      )}

      {/* Error */}
      {state === "error" && (
        <>
          <div className="mip-icon error">!</div>
          <h2 className="mip-title">{mode === "student" ? "Link Invalid" : "Something Went Wrong"}</h2>

          <p className="mip-subtitle">
            {errorMsg ||
              "This link is invalid or has expired. Please open Billio to update the invoice manually."}
          </p>

          <button type="button" className="mip-btn-primary" onClick={dismiss}>
            {onClose ? "Close" : "Open Billio"}
          </button>
        </>
      )}
    </div>
  );

  // Modal mode wraps the same card in an overlay; route mode renders the page.
  if (asModal) {
    return (
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.55)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          zIndex: 1000,
        }}
      >
        <div onClick={(e) => e.stopPropagation()}>{card}</div>
      </div>
    );
  }

  return <div className="mip-page">{card}</div>;
}