// Edge-function helper that puts optional Venmo/Zelle into invoice emails/texts.
//
// supabase/ is gitignored (edge functions are deployed from the dashboard and
// not kept in the repo), so these tests run only when the functions are
// present locally — otherwise they're reported as skipped, not failed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { venmoPayUrl as appVenmoPayUrl } from "../../src/lib/paymentOptions.ts";

const helperUrl = new URL("../../supabase/functions/_shared/paymentMessage.ts", import.meta.url);

if (!existsSync(helperUrl)) {
  test("edge-function payment helper (supabase/functions not present locally)", { skip: true }, () => {});
} else {
  const {
    loadCoachPaymentForMessages, paymentEmailHtml, paymentForMessages, paymentSmsText,
    venmoPayUrl: edgeVenmoPayUrl,
  } = await import(helperUrl.href);

  const full = { venmo_handle: "Coach-Anna", zelle_contact: "(555) 010-2000", zelle_name: "Anna Smith" };

  test("edge and app build the identical Venmo link", () => {
    for (const [handle, amount] of [["Coach-Anna", 120], ["a_b-c1", 7.5]] as const) {
      assert.equal(edgeVenmoPayUrl(handle, amount), appVenmoPayUrl(handle, amount));
    }
  });

  test("nothing is added unless the coach set details and kept the switch on", () => {
    assert.equal(paymentForMessages({}), null);
    assert.equal(paymentForMessages({ zelle_name: "Anna" }), null, "a name alone isn't a payment method");
    assert.equal(paymentForMessages({ ...full, payment_in_messages: false }), null, "switched off");
    assert.deepEqual(paymentForMessages({ ...full, payment_in_messages: true }), full);
    assert.deepEqual(paymentForMessages({ ...full, payment_in_messages: null }), full, "missing flag = on (column default)");
    assert.deepEqual(paymentForMessages({ venmo_handle: "Coach-Anna", zelle_name: "Anna" }),
      { venmo_handle: "Coach-Anna", zelle_contact: null, zelle_name: null }, "Zelle name dropped without a Zelle contact");
    assert.equal(paymentEmailHtml(null, 120), "");
    assert.equal(paymentSmsText(null, 120), "");
  });

  test("SMS lines: Venmo link (amount only) and Zelle with name — no note instruction", () => {
    assert.equal(
      paymentSmsText(full, 120),
      [
        "How to pay:",
        "Venmo: https://venmo.com/Coach-Anna?txn=pay&amount=120.00",
        "Zelle: (555) 010-2000 (Anna Smith)",
      ].join("\n")
    );
    assert.equal(
      paymentSmsText({ venmo_handle: null, zelle_contact: "a@b.co", zelle_name: null }, 60),
      "How to pay:\nZelle: a@b.co"
    );
  });

  test("email block links Venmo with the amount and escapes everything typed", () => {
    const html = paymentEmailHtml(
      { venmo_handle: "Coach-Anna", zelle_contact: "x@y.co", zelle_name: `<script>alert("x")</script>` },
      120
    );
    assert.ok(html.includes('href="https://venmo.com/Coach-Anna?txn=pay&amp;amount=120.00"'), "href is attribute-escaped");
    assert.ok(!/payment note|note=/.test(html), "no payment-note instruction or pre-filled note");
    assert.ok(html.includes("Pay $120.00 with Venmo"));
    assert.ok(html.includes("@Coach-Anna"));
    assert.ok(!html.includes("<script>"), "no raw HTML from coach input");
    assert.ok(html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"));
  });

  test("loading never throws and never blocks sending", async () => {
    const client = (result: unknown, throws = false) => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              if (throws) throw new Error("network");
              return result;
            },
          }),
        }),
      }),
    });
    assert.equal(await loadCoachPaymentForMessages(client({ data: null, error: { code: "42703" } }), "c1"), null, "column missing (SQL not run)");
    assert.equal(await loadCoachPaymentForMessages(client(null, true), "c1"), null, "thrown error");
    assert.equal(await loadCoachPaymentForMessages(client({ data: full, error: null }), null), null, "no coach id");
    assert.deepEqual(await loadCoachPaymentForMessages(client({ data: { ...full, payment_in_messages: true }, error: null }), "c1"), full);
  });

  test("the copies inlined into the send functions match the shared helper exactly", async () => {
    const { readFile } = await import("node:fs/promises");
    const root = new URL("../../supabase/functions/", import.meta.url);
    const shared = (await readFile(new URL("_shared/paymentMessage.ts", root), "utf8")).trimEnd();
    for (const fn of ["send-single-invoice", "send-combined-invoice"]) {
      const src = await readFile(new URL(`${fn}/index.ts`, root), "utf8");
      const block = src.match(/\/\/ ── BEGIN paymentMessage[^\n]*\n[^\n]*\n([\s\S]*?)\/\/ ── END paymentMessage ──/);
      assert.ok(block, `${fn}: inlined block missing`);
      assert.equal(block[1].trimEnd(), shared, `${fn}: inlined copy differs — re-copy from _shared/paymentMessage.ts`);
    }
  });
}
