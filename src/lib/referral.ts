import { supabase } from "./supabaseClient";

// Kept in sync with `v_per_reward` in supabase/sql/referral_program.sql — the
// database is the authority (get_referral_summary returns the real number),
// this is only the copy used before the summary has loaded.
export const REFERRALS_PER_REWARD = 3;

const STORAGE_KEY = "billio_referral_code";

function normalize(code: string | null | undefined) {
  const cleaned = (code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return cleaned.length >= 4 && cleaned.length <= 16 ? cleaned : "";
}

/**
 * Stashes a `?ref=CODE` off any public URL. The code has to survive signup,
 * the email-confirmation round trip, and first login before there's a coach
 * row to attach it to — localStorage is the only thing that spans all three.
 */
export function captureReferralCode(search: string) {
  const code = normalize(new URLSearchParams(search).get("ref"));
  if (!code) return "";
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode / storage disabled — the signup metadata copy still works.
  }
  return code;
}

export function getStoredReferralCode() {
  try {
    return normalize(localStorage.getItem(STORAGE_KEY));
  } catch {
    return "";
  }
}

/** Saves a code the user typed by hand instead of arriving through a link. */
export function storeReferralCode(code: string) {
  const cleaned = normalize(code);
  if (!cleaned) return "";
  try {
    localStorage.setItem(STORAGE_KEY, cleaned);
  } catch {
    // Private mode / storage disabled — the signup metadata copy still works.
  }
  return cleaned;
}

/**
 * Checks a code before the user commits to it. Attribution itself happens much
 * later (first dashboard load, possibly a different session), so without this
 * a mistyped code would fail silently and the referrer would never be credited
 * — with nobody in a position to notice.
 *
 * Runs unauthenticated: the signup form is the main place it's needed.
 */
export async function lookupReferralCode(code: string) {
  const cleaned = normalize(code);
  if (!cleaned) return { valid: false as const };

  const { data, error } = await supabase.rpc("lookup_referral_code", { p_code: cleaned });
  if (error) return { valid: false as const, unavailable: true };

  const result = data as { valid?: boolean; name?: string } | null;
  return result?.valid
    ? { valid: true as const, name: result.name ?? "another coach" }
    : { valid: false as const };
}

export function clearStoredReferralCode() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do.
  }
}

export function buildReferralLink(code: string) {
  return `${window.location.origin}/signup?ref=${encodeURIComponent(code)}`;
}

// Outcomes there's no point retrying: either it worked, or it never will for
// this account. Anything else (notably "no_coach", when the coach row hasn't
// been created yet) keeps the stored code around for the next attempt.
const TERMINAL_REASONS = new Set([
  "already_referred",
  "invalid_code",
  "self_referral",
  "not_eligible",
]);

/**
 * Attaches a stored referral code to the signed-in coach. Cheap and safe to
 * call on every dashboard load — it returns immediately when there's no code
 * stored, and the RPC itself no-ops once a referral row exists.
 */
export async function claimStoredReferral() {
  let code = getStoredReferralCode();

  // Fallback for a browser that lost localStorage between signup and first
  // login (cleared storage, or confirming the email in a different profile):
  // signup also writes the code into the auth user's metadata.
  if (!code) {
    const { data } = await supabase.auth.getSession();
    code = normalize(data.session?.user?.user_metadata?.referral_code);
  }

  if (!code) return null;

  const { data, error } = await supabase.rpc("claim_referral", { p_code: code });
  if (error) return null;

  const result = data as { ok?: boolean; reason?: string } | null;
  if (result?.ok || (result?.reason && TERMINAL_REASONS.has(result.reason))) {
    clearStoredReferralCode();
  }

  return result;
}
