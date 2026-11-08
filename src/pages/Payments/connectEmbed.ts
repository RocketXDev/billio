// Starts Stripe's embedded components. Only the Payments page imports this.

import { loadConnectAndInitialize } from "@stripe/connect-js/pure";
import { connectPublishableKey, fetchConnectClientSecret } from "../../lib/connect";

const CONNECT_JS_URL = "https://connect-js.stripe.com/v1.0/connect.js";

// Stripe's loader remembers a failed download forever and leaves an unhandled
// rejection (which would raise the global error popup). Fetching the script
// here first keeps a failure on the page and lets "Try again" really retry.
function loadConnectScript() {
  return new Promise<void>((resolve, reject) => {
    if ((window as unknown as { StripeConnect?: { init?: unknown } }).StripeConnect?.init) return resolve();
    const script = document.createElement("script");
    script.src = CONNECT_JS_URL;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error("Couldn't load Stripe."));
    };
    document.head.appendChild(script);
  });
}

export async function startConnect() {
  await loadConnectScript();

  // Fetched up front for the same reason: a failure here stays on the page.
  let firstSecret: string | null = await fetchConnectClientSecret();

  return loadConnectAndInitialize({
    publishableKey: connectPublishableKey,
    fetchClientSecret: async () => {
      if (firstSecret) {
        const secret = firstSecret;
        firstSecret = null;
        return secret;
      }
      return fetchConnectClientSecret();
    },
    fonts: [{ cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" }],
    appearance: {
      overlays: "dialog",
      variables: {
        colorPrimary: "#3b33d9",
        fontFamily: "Inter, sans-serif",
        borderRadius: "10px",
      },
    },
  });
}
