import { useState } from "react";
import { FaArrowRight, FaCheck, FaRegCopy } from "react-icons/fa";
import { formatMoney, hasPaymentOptions, venmoPayUrl, type PaymentDetails } from "../../lib/paymentOptions";
import "./PaymentOptions.css";

// "How to pay" block: Venmo (deep link with the amount filled in) and Zelle (copyable details — Zelle has no link, it lives inside each
// bank's app). Renders nothing when the coach hasn't added either.
//
// Brand colours and names only, no official logos (both brands restrict
// logo use).
export default function PaymentOptions({ details, amount, preview = false }: {
  details: PaymentDetails | null | undefined;
  amount: number;
  // Settings preview: same look, links inert.
  preview?: boolean;
}) {
  if (!hasPaymentOptions(details)) return null;
  const { venmo_handle: venmo, zelle_contact: zelle, zelle_name: zelleName } = details;

  return (
    <section className="pay-options" aria-label="How to pay">
      <h3 className="pay-options-title">How to pay</h3>

      {venmo && (
        <a
          className="pay-option pay-option-venmo"
          href={preview ? undefined : venmoPayUrl(venmo, amount)}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={preview || undefined}
          onClick={preview ? (e) => e.preventDefault() : undefined}
        >
          <span className="pay-option-badge" aria-hidden="true">V</span>
          <span className="pay-option-text">
            <strong>Pay {formatMoney(amount)} with Venmo</strong>
            <small>@{venmo}</small>
          </span>
          <FaArrowRight className="pay-option-arrow" aria-hidden="true" />
        </a>
      )}

      {zelle && (
        <div className="pay-option pay-option-zelle">
          <div className="pay-option-head">
            <span className="pay-option-badge" aria-hidden="true">Z</span>
            <span className="pay-option-text">
              <strong>Zelle</strong>
              <small>Open your bank's app and choose Zelle</small>
            </span>
          </div>
          <dl className="pay-zelle-rows">
            <CopyRow label="Send to" value={zelle} />
            {zelleName && <CopyRow label="Name" value={zelleName} copyable={false} />}
            <CopyRow label="Amount" value={formatMoney(amount)} copyValue={amount.toFixed(2)} />
          </dl>
        </div>
      )}

    </section>
  );
}

function CopyRow({ label, value, copyValue, copyable = true }: {
  label: string;
  value: string;
  copyValue?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyValue ?? value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (e.g. insecure context): the value is still
      // selectable on screen.
    }
  }

  return (
    <div className="pay-zelle-row">
      <dt>{label}</dt>
      <dd>
        <span className="pay-zelle-value">{value}</span>
        {copyable && (
          <button type="button" className="pay-copy-btn" onClick={copy} aria-label={`Copy ${label.toLowerCase()}`} title="Copy">
            {copied ? <FaCheck aria-hidden="true" /> : <FaRegCopy aria-hidden="true" />}
            <span className="pay-copy-label">{copied ? "Copied" : "Copy"}</span>
          </button>
        )}
      </dd>
    </div>
  );
}
