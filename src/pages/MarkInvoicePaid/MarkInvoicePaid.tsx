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
import PaymentOptions from "../../components/PaymentOptions/PaymentOptions";
import { hasPaymentOptions, type PaymentDetails } from "../../lib/paymentOptions";
import { createCardCheckout, fetchCardCheckoutStatus, type CardCheckoutStatus } from "../../lib/connect";
import { showError } from "../../lib/notify";
import "./MarkInvoicePaid.css";

type State = "loading" | "confirm" | "success" | "already_paid" | "card_paid" | "error";

// How long the page will wait for the card option before showing without it.
const CARD_STATUS_WAIT_MS = 1500;
// Longer from a "Pay online" link: this parent came here to pay by card, and
// without the option the page would ask them to mark the invoice paid.
const CARD_LINK_WAIT_MS = 8000;

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
  // Stripe sends the parent back here with paid=1 after a successful card payment.
  const returnedFromCard = mode === "student" && searchParams.get("paid") === "1";

  const [state, setState] = useState<State>("loading");
  const [invoice, setInvoice] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [marking, setMarking] = useState(false);
  // Set when this invoice was part of a combined send (invoice_group_id) —
  // its siblings, so paid-status can be shown/marked across the whole group.
  const [groupInvoices, setGroupInvoices] = useState<any[] | null>(null);
  // The coach's optional Venmo/Zelle details (parent links only) — null when
  // they haven't added any, which keeps this page exactly as before.
  const [payment, setPayment] = useState<(PaymentDetails & { coach_name?: string | null }) | null>(null);
  const [cardOption, setCardOption] = useState<CardCheckoutStatus | null>(null);
  const [startingCard, setStartingCard] = useState(false);

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

  // Pressing back from Stripe can restore this page exactly as it was left.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setStartingCard(false);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  // Never blocks the page for long, and any failure just means no card option.
  function loadCardOption() {
    const status = fetchCardCheckoutStatus(token!).then(setCardOption).catch(() => {});
    const waitMs = searchParams.get("card") === "1" ? CARD_LINK_WAIT_MS : CARD_STATUS_WAIT_MS;
    return Promise.race([status, new Promise((resolve) => setTimeout(resolve, waitMs))]);
  }

  async function startCardPayment() {
    if (startingCard) return;
    setStartingCard(true);
    try {
      const { url } = await createCardCheckout(token!);
      window.location.href = url;
    } catch (err) {
      setStartingCard(false);
      showError("open card payment", err);
    }
  }

  // ── Student: validate the token via the edge function ──────────────
  async function validateToken() {
    try {
      const [{ data, error }] = await Promise.all([
        supabase.functions.invoke("get-payment-reminder-invoice", { body: { token } }),
        returnedFromCard ? null : loadCardOption(),
      ]);

      if (returnedFromCard) {
        // The money has moved; the invoice flips to paid moments later.
        if (data?.invoice) {
          setInvoice(data.invoice);
          setGroupInvoices(data.group || null);
        }
        setState("card_paid");
        return;
      }

      if (error || data?.error) {
        setErrorMsg(data?.error || error?.message || "Invalid or expired link.");
        setState("error");
        return;
      }

      setInvoice(data.invoice);
      setGroupInvoices(data.group || null);
      setPayment(data.payment || null);
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
        .select("id, invoice_number, total, status, due_date, invoice_group_id, students(student_name)")
        .eq("id", invoiceId)
        .single();

      if (error || !data) {
        setErrorMsg(error?.message || "Invoice not found.");
        setState("error");
        return;
      }

      setInvoice(data);

      if (data.invoice_group_id) {
        const { data: siblings } = await supabase
          .from("invoices")
          .select("id, invoice_number, total, students(student_name)")
          .eq("invoice_group_id", data.invoice_group_id);
        if (siblings && siblings.length > 1) setGroupInvoices(siblings);
      }

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
        setGroupInvoices(data.group || null);
        setState("success");
        onPaid?.(data.invoice?.id || invoiceId || "");
      } else {
        // Coach flow — direct authenticated writes. If this invoice was part
        // of a combined send, cascade the same write to every sibling so the
        // group's paid status can't end up split between members.
        const targetIds = groupInvoices ? groupInvoices.map((g) => g.id) : [invoiceId];

        const { error: invoiceError } = await supabase
          .from("invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            paid_via: "coach_manual",
          })
          .in("id", targetIds);

        if (invoiceError) throw invoiceError;

        const { data: invoiceLessons, error: lessonsLookupError } = await supabase
          .from("invoice_lessons")
          .select("lesson_id")
          .in("invoice_id", targetIds);

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

  const studentName = invoice?.students?.student_name || invoice?.student_name || "Student";
  const invoiceNumber = invoice?.invoice_number || "Invoice";
  const total = invoice ? `$${Number(invoice.total || 0).toFixed(2)}` : "";
  const groupTotal = groupInvoices
    ? groupInvoices.reduce((sum, g) => sum + Number(g.total || 0), 0)
    : null;

  const showPayment = mode === "student" && hasPaymentOptions(payment);
  const showCard = mode === "student" && !!cardOption?.available;
  const coachName = payment?.coach_name?.trim() || cardOption?.coach_name?.trim() || "your coach";
  const cardAmount = `$${((cardOption?.amount_cents ?? 0) / 100).toFixed(2)}`;

  // Same card in all three states — a combined invoice shows every
  // student's subtotal plus the grand total instead of a single amount.
  function invoiceCardBody(showDueDate: boolean) {
    if (groupInvoices) {
      return (
        <div className="mip-invoice-card">
          {groupInvoices.map((g) => (
            <div key={g.id} className="mip-invoice-group-row">
              <span>{g.students?.student_name || "Student"}</span>
              <span>${Number(g.total || 0).toFixed(2)}</span>
            </div>
          ))}
          <div className="mip-invoice-amount">${groupTotal!.toFixed(2)}</div>
          {showDueDate && invoice?.due_date && (
            <div className="mip-invoice-due">Due date was {invoice.due_date}</div>
          )}
        </div>
      );
    }
    return (
      <div className="mip-invoice-card">
        <div className="mip-invoice-number">{invoiceNumber}</div>
        <div className="mip-invoice-student">{studentName}</div>
        <div className="mip-invoice-amount">{total}</div>
        {showDueDate && invoice?.due_date && (
          <div className="mip-invoice-due">Due date was {invoice.due_date}</div>
        )}
      </div>
    );
  }

  const card = (
    <div className="mip-card">
      <img src="/logo.png" alt="Billio" className="mip-logo" />

      {/* Confirm */}
      {state === "confirm" && (
        <>
          {showPayment || showCard ? (
            <h2 className="mip-title">Pay {coachName}</h2>
          ) : (
            <>
              <div className="mip-icon warning">?</div>
              <h2 className="mip-title">Mark Invoice as Paid?</h2>
            </>
          )}

          {invoiceCardBody(true)}

          {showCard && (
            <button
              type="button"
              className="mip-btn-primary"
              onClick={startCardPayment}
              disabled={startingCard}
            >
              {startingCard ? "Opening secure payment..." : `Pay ${cardAmount} by card or Apple Pay`}
            </button>
          )}

          {showCard && !showPayment ? null : showPayment ? (
            <>
              <PaymentOptions
                details={payment}
                amount={groupTotal ?? Number(invoice?.total || 0)}
              />
              <p className="mip-subtitle">
                Once you've sent the payment, tap below so {coachName} knows it's taken care of.
              </p>
            </>
          ) : (
            <p className="mip-subtitle">
              Confirming will mark {groupInvoices ? "these invoices" : "this invoice"} as paid
              and update all linked {term.lower} statuses in Billio.
            </p>
          )}

          {/* Card payments mark themselves paid. */}
          {(showPayment || !showCard) && (
            <button
              type="button"
              className={showCard ? "mip-btn-secondary" : "mip-btn-primary"}
              onClick={handleMarkPaid}
              disabled={marking}
            >
              {marking ? "Marking as paid..." : showPayment ? "✓ I've sent the payment" : "✓ Yes, mark as paid"}
            </button>
          )}

          {/* Parents paying online have no app to open. */}
          {!showPayment && !showCard && (
            <button
              type="button"
              className="mip-btn-secondary"
              onClick={dismiss}
              disabled={marking}
            >
              {mode === "student" ? "Open app instead" : "Cancel"}
            </button>
          )}

          {mode === "student" && (
            <p className="mip-disclaimer">
              {showPayment || showCard
                ? "Questions about this invoice? Please contact your coach."
                : "This link expires in 7 days. If you already marked this paid in the app, ignore this."}
            </p>
          )}
        </>
      )}

      {/* Back from a successful card payment */}
      {state === "card_paid" && (
        <>
          <div className="mip-icon success">✓</div>
          <h2 className="mip-title">Payment Received</h2>

          {invoice && invoiceCardBody(false)}

          <p className="mip-subtitle">Thank you. Your coach will see this in Billio shortly.</p>
        </>
      )}

      {/* Success */}
      {state === "success" && (
        <>
          <div className="mip-icon success">✓</div>
          <h2 className="mip-title">Invoice Marked as Paid</h2>

          {invoiceCardBody(false)}

          <p className="mip-subtitle">
            {groupInvoices ? "These invoices have" : "This invoice has"} been marked as
            paid and {term.lower} statuses have been updated in Billio.
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

          {invoiceCardBody(false)}

          <p className="mip-subtitle">
            {groupInvoices ? "These invoices were" : "This invoice was"} already marked as
            paid in Billio.
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