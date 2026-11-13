// Calls to the connect-account edge function (card payments via Stripe Connect).
// The Stripe embedded components are loaded separately by the Payments page, so
// this file stays cheap for More to import.

import { fetchAllRows } from "./fetchAllRows";
import { supabase } from "./supabaseClient";

export type ConnectState = "not_started" | "onboarding" | "action_needed" | "in_review" | "active";

export type ConnectStatus =
  | { available: false }
  | { available: true; state: ConnectState; card_payments_on: boolean; livemode: boolean };

export const connectPublishableKey: string = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";

export const connectStatusKey = (coachId: string | null | undefined) => ["connect-status", coachId];

// Which coaches' apps may even ask about payments: comma-separated ids, or *
// for everyone; empty means nobody. Everyone else makes no extra requests and
// never sees the page. Access itself is enforced by the connect-account
// function's own allowlist, not by this.
export function paymentsEnabledFor(coachId: string) {
  if (!connectPublishableKey || !coachId) return false;
  const list = String(import.meta.env.VITE_PAYMENTS_COACH_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  return list.includes("*") || list.includes(coachId);
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error || data?.error) {
    // A non-2xx response arrives as `error`, with our message unread on the raw Response.
    let message: string | undefined = data?.error;
    if (!message && typeof error?.context?.json === "function") {
      try {
        message = (await error.context.json())?.error;
      } catch {
        // Not JSON: fall through to the SDK's message.
      }
    }
    throw new Error(message || error?.message || "The payments service didn't respond.");
  }
  return data as T;
}

const invokeConnect = <T,>(body: Record<string, unknown>) => invokeFunction<T>("connect-account", body);

export const fetchConnectStatus = (refresh = false) =>
  invokeConnect<ConnectStatus>({ action: "status", refresh });

// The server's last answer for this coach on this device, so More can show
// (or keep hiding) its row at once instead of waiting for the check.
const availableKey = (coachId: string) => `billio_payments_available_${coachId}`;

export function rememberedConnectAvailable(coachId: string): boolean | undefined {
  try {
    const saved = localStorage.getItem(availableKey(coachId));
    return saved === null ? undefined : saved === "1";
  } catch {
    return undefined;
  }
}

// For the More row: any failure just means the row stays hidden. Only a real
// answer is remembered, so a dropped connection doesn't hide it next time.
export async function fetchConnectAvailable(coachId: string) {
  try {
    const available = (await fetchConnectStatus()).available === true;
    try {
      localStorage.setItem(availableKey(coachId), available ? "1" : "0");
    } catch {
      // Storage blocked (private mode): the check still works, just not remembered.
    }
    return available;
  } catch {
    return false;
  }
}

export const enrollInCardPayments = () => invokeConnect<ConnectStatus>({ action: "enroll" });

export const setCardPaymentsOn = (on: boolean) =>
  invokeConnect<ConnectStatus>({ action: "set-card-payments", on });

export async function fetchConnectClientSecret() {
  const { client_secret } = await invokeConnect<{ client_secret: string }>({ action: "session" });
  return client_secret;
}

export type CardPayment = {
  id: string;
  amount_cents: number;
  refunded_cents: number;
  status: string;
  needs_review: boolean;
};

export const fetchCardPayments = (coachId: string, livemode: boolean) =>
  fetchAllRows<CardPayment>((from, to) =>
    supabase
      .from("invoice_payments")
      .select("id, amount_cents, refunded_cents, status, needs_review")
      .eq("coach_id", coachId)
      .eq("livemode", livemode)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to)
  );

// ── Parents paying from the /pay link ───────────────────────────────────────

export type CardCheckoutStatus = { available: boolean; amount_cents?: number; coach_name?: string | null };

export const fetchCardCheckoutStatus = (token: string) =>
  invokeFunction<CardCheckoutStatus>("create-invoice-checkout", { token, action: "status" });

export const createCardCheckout = (token: string) =>
  invokeFunction<{ url: string }>("create-invoice-checkout", { token, action: "checkout" });
