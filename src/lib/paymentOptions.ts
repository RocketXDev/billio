// Optional Venmo / Zelle details a coach can show parents on invoices.
// Entirely opt-in: many coaches are paid another way (e.g. lesson tickets at
// the rink's front desk), and with nothing filled in, nothing is shown
// anywhere — the pay page, PDF and settings look exactly as before.

export type PaymentDetails = {
  venmo_handle?: string | null;
  zelle_contact?: string | null;
  zelle_name?: string | null;
};

export function hasPaymentOptions(details: PaymentDetails | null | undefined): details is PaymentDetails {
  return !!(details?.venmo_handle || details?.zelle_contact);
}

// Drops whichever methods the coach switched off in Settings → Getting paid.
export function offeredPayment(
  details: (PaymentDetails & { offer_venmo?: boolean | null; offer_zelle?: boolean | null }) | null | undefined
): PaymentDetails | null {
  if (!details) return null;
  const venmo_handle = details.offer_venmo === false ? null : details.venmo_handle ?? null;
  const zelle_contact = details.offer_zelle === false ? null : details.zelle_contact ?? null;
  return { venmo_handle, zelle_contact, zelle_name: zelle_contact ? details.zelle_name ?? null : null };
}

type Checked = { value: string | null; error: string | null };

/**
 * Accepts "@anna-smith", "anna-smith" or a pasted venmo.com link. Venmo
 * usernames are 5–30 letters, numbers, hyphens or underscores.
 */
export function normalizeVenmoHandle(input: string): Checked {
  const raw = input
    .trim()
    .replace(/^(https?:\/\/)?(www\.|account\.)?venmo\.com\/(u\/)?/i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
  if (!raw) return { value: null, error: null };
  if (!/^[A-Za-z0-9_-]{5,30}$/.test(raw)) {
    return { value: null, error: "Venmo usernames are 5–30 letters, numbers, hyphens or underscores." };
  }
  return { value: raw, error: null };
}

/** Zelle is sent to an email address or a US mobile number. */
export function normalizeZelleContact(input: string): Checked {
  const raw = input.trim();
  if (!raw) return { value: null, error: null };
  if (raw.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
      ? { value: raw.toLowerCase(), error: null }
      : { value: null, error: "Enter the email address your Zelle is registered to." };
  }
  const digits = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (digits.length !== 10) {
    return { value: null, error: "Enter the email or 10-digit US phone number your Zelle is registered to." };
  }
  return { value: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`, error: null };
}

/**
 * Venmo's documented payment link (venmo.com/paymentlinks): opens the Venmo
 * app on a phone with the amount filled in; the parent writes their own note.
 */
export function venmoPayUrl(handle: string, amount: number) {
  const params = new URLSearchParams({ txn: "pay", amount: amount.toFixed(2) });
  return `https://venmo.com/${encodeURIComponent(handle)}?${params.toString()}`;
}

export const formatMoney = (amount: number) =>
  amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
