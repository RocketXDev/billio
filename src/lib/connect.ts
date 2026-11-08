// Calls to the connect-account edge function (card payments via Stripe Connect).
// The Stripe embedded components are loaded separately by the Payments page, so
// this file stays cheap for More to import.

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

async function invokeConnect<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("connect-account", { body });
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

export const fetchConnectStatus = (refresh = false) =>
  invokeConnect<ConnectStatus>({ action: "status", refresh });

// For the More row: any failure just means the row stays hidden.
export async function fetchConnectAvailable() {
  try {
    const status = await fetchConnectStatus();
    return status.available === true;
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
