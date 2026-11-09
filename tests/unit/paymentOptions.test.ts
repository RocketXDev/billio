// Optional Venmo / Zelle details.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePaypalHandle, offeredPayment, paypalPayUrl,
  hasPaymentOptions, normalizeVenmoHandle, normalizeZelleContact, venmoPayUrl,
} from "../../src/lib/paymentOptions.ts";

test("Venmo usernames are accepted with or without @, or as a pasted link", () => {
  for (const input of ["anna-smith", "@anna-smith", "  @anna-smith ", "https://venmo.com/anna-smith",
    "https://venmo.com/u/anna-smith", "https://account.venmo.com/u/anna-smith?ref=x", "venmo.com/anna-smith"]) {
    assert.deepEqual(normalizeVenmoHandle(input), { value: "anna-smith", error: null }, input);
  }
  assert.deepEqual(normalizeVenmoHandle("Coach_Anna_2026"), { value: "Coach_Anna_2026", error: null });
});

test("empty Venmo is fine (optional); invalid usernames are explained", () => {
  assert.deepEqual(normalizeVenmoHandle(""), { value: null, error: null });
  assert.deepEqual(normalizeVenmoHandle("   "), { value: null, error: null });
  for (const bad of ["abc", "anna smith", "anna!", "a".repeat(31)]) {
    const r = normalizeVenmoHandle(bad);
    assert.equal(r.value, null, bad);
    assert.match(r.error!, /5–30 letters/, bad);
  }
});

test("Zelle takes an email (lower-cased) or a US phone (formatted)", () => {
  assert.deepEqual(normalizeZelleContact("Anna@Example.COM"), { value: "anna@example.com", error: null });
  for (const phone of ["5550102000", "555-010-2000", "(555) 010 2000", "+1 555 010 2000", "1-555-010-2000"]) {
    assert.deepEqual(normalizeZelleContact(phone), { value: "(555) 010-2000", error: null }, phone);
  }
  assert.deepEqual(normalizeZelleContact(""), { value: null, error: null });
  for (const bad of ["anna@", "anna@example", "555-0102", "12345678901234"]) {
    assert.ok(normalizeZelleContact(bad).error, bad);
  }
});

test("Venmo link follows Venmo's documented payment-link format", () => {
  const url = new URL(venmoPayUrl("anna-smith", 120));
  assert.equal(url.origin + url.pathname, "https://venmo.com/anna-smith");
  assert.equal(url.searchParams.get("txn"), "pay");
  assert.equal(url.searchParams.get("amount"), "120.00", "decimal, no $ sign");
  assert.equal(url.searchParams.has("note"), false, "parents write their own note");
});

test("PayPal names: pasted links are cleaned up, junk is refused", () => {
  for (const input of ["annasmith", "@annasmith", "paypal.me/annasmith", "https://www.paypal.me/annasmith/25", "https://www.paypal.com/paypalme/annasmith"]) {
    assert.deepEqual(normalizePaypalHandle(input), { value: "annasmith", error: null }, input);
  }
  assert.deepEqual(normalizePaypalHandle("  "), { value: null, error: null });
  assert.ok(normalizePaypalHandle("anna smith").error);
  assert.equal(hasPaymentOptions({ paypal_handle: "annasmith" }), true);
});

test("PayPal link carries the amount in dollars", () => {
  assert.equal(paypalPayUrl("annasmith", 120), "https://paypal.me/annasmith/120.00USD");
  assert.equal(paypalPayUrl("annasmith", 7.5), "https://paypal.me/annasmith/7.50USD");
});

test("offeredPayment drops only the methods switched off", () => {
  const full = { venmo_handle: "anna-smith", paypal_handle: "annasmith", zelle_contact: "a@b.co", zelle_name: "Anna" };
  assert.deepEqual(offeredPayment(full), full, "columns missing = everything stays on");
  assert.deepEqual(offeredPayment({ ...full, offer_venmo: false }), { ...full, venmo_handle: null });
  assert.deepEqual(offeredPayment({ ...full, offer_paypal: false }), { ...full, paypal_handle: null });
  assert.deepEqual(offeredPayment({ ...full, offer_zelle: false }), { venmo_handle: "anna-smith", paypal_handle: "annasmith", zelle_contact: null, zelle_name: null });
  assert.equal(hasPaymentOptions(offeredPayment({ ...full, offer_venmo: false, offer_paypal: false, offer_zelle: false })), false);
  assert.equal(offeredPayment(null), null);
});

test("payment options show only when Venmo or Zelle is set", () => {
  assert.equal(hasPaymentOptions(null), false);
  assert.equal(hasPaymentOptions({}), false);
  assert.equal(hasPaymentOptions({ venmo_handle: null, zelle_contact: null, zelle_name: "Anna" }), false);
  assert.equal(hasPaymentOptions({ venmo_handle: "anna-smith" }), true);
  assert.equal(hasPaymentOptions({ zelle_contact: "a@b.co" }), true);
});
