// src/pages/MarkInvoicePaid/MarkInvoicePaid.tsx
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import "./MarkInvoicePaid.css";

type State = "loading" | "confirm" | "success" | "already_paid" | "error";

export default function MarkInvoicePaid() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [state, setState] = useState<State>("loading");
  const [invoice, setInvoice] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg("No token provided.");
      setState("error");
      return;
    }
    validateToken();
  }, [token]);

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

  async function handleMarkPaid() {
    if (marking) return;
    setMarking(true);
    try {
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
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
      setState("error");
    } finally {
      setMarking(false);
    }
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

  return (
    <div className="mip-page">
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
              Confirming will mark this invoice as paid and update all linked lesson statuses in Billio.
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
              onClick={() => navigate("/invoices")}
            >
              Open app instead
            </button>

            <p className="mip-disclaimer">
              This link expires in 7 days. If you already marked this paid in the app, ignore this.
            </p>
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
              This invoice has been marked as paid and lesson statuses have been updated in Billio.
            </p>

            <button
              type="button"
              className="mip-btn-primary"
              onClick={() => navigate("/invoices")}
            >
              Open Billio
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

            <button
              type="button"
              className="mip-btn-primary"
              onClick={() => navigate("/invoices")}
            >
              Open Billio
            </button>
          </>
        )}

        {/* Error */}
        {state === "error" && (
          <>
            <div className="mip-icon error">!</div>
            <h2 className="mip-title">Link Invalid</h2>

            <p className="mip-subtitle">
              {errorMsg || "This link is invalid or has expired. Please open Billio to update the invoice manually."}
            </p>

            <button
              type="button"
              className="mip-btn-primary"
              onClick={() => navigate("/invoices")}
            >
              Open Billio
            </button>
          </>
        )}
      </div>
    </div>
  );
}