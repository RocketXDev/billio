import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FaArrowLeft,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaCreditCard,
  FaEllipsisH,
  FaExclamationCircle,
  FaFileInvoiceDollar,
  FaHome,
  FaUsers,
} from "react-icons/fa";
import type { LoadError, StripeConnectInstance } from "@stripe/connect-js";
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectBalances,
  ConnectComponentsProvider,
  ConnectNotificationBanner,
  ConnectPayments,
  ConnectPayoutsList,
} from "@stripe/react-connect-js";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import { useLessonTerm } from "../../hooks/useLessonTerm";
import {
  connectStatusKey,
  enrollInCardPayments,
  fetchCardPayments,
  fetchConnectStatus,
  paymentsEnabledFor,
  setCardPaymentsOn,
  type ConnectState,
} from "../../lib/connect";
import { showError } from "../../lib/notify";
import { formatMoney } from "../../lib/paymentOptions";
import { startConnect } from "./connectEmbed";
import "./Payments.css";

const STATE_COPY: Record<Exclude<ConnectState, "not_started" | "onboarding">, { icon: React.ReactNode; title: string; text: string }> = {
  active: {
    icon: <FaCheckCircle />,
    title: "You're ready to take cards",
    text: "Your Stripe account is verified.",
  },
  in_review: {
    icon: <FaClock />,
    title: "Stripe is reviewing your details",
    text: "This usually doesn't take long. You don't need to do anything right now.",
  },
  action_needed: {
    icon: <FaExclamationCircle />,
    title: "Stripe needs a bit more information",
    text: "Finish the steps below to start or keep taking card payments.",
  },
};

export default function Payments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const term = useLessonTerm();
  const { coachId, identityLoading } = useCoachIdentity();
  const paymentsEnabled = paymentsEnabledFor(coachId);

  // Longer key than More's: this one asks Stripe for the latest status.
  const pageKey = [...connectStatusKey(coachId), "page"];
  const { data: status, isError, isFetching, refetch } = useQuery({
    queryKey: pageKey,
    queryFn: () => fetchConnectStatus(true),
    enabled: paymentsEnabled,
    staleTime: 0,
    retry: false,
  });

  const [enrolling, setEnrolling] = useState(false);
  const [savingCards, setSavingCards] = useState(false);
  const [connect, setConnect] = useState<StripeConnectInstance | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const state = status?.available ? status.state : null;
  const needsStripe = !!state && state !== "not_started";
  const livemode = !!status?.available && status.livemode;

  const { data: cardPayments } = useQuery({
    queryKey: ["invoice-payments", coachId, livemode],
    queryFn: () => fetchCardPayments(coachId, livemode),
    enabled: needsStripe,
    staleTime: 0,
    retry: false,
  });
  const received = (cardPayments ?? []).filter((p) => ["succeeded", "partially_refunded", "disputed"].includes(p.status));
  const receivedCents = received.reduce((sum, p) => sum + p.amount_cents - p.refunded_cents, 0);
  const toReview = (cardPayments ?? []).filter((p) => p.needs_review && p.status === "succeeded").length;

  const connectStarted = useRef(false);
  const beginConnect = useCallback(() => {
    connectStarted.current = true;
    startConnect().then(setConnect).catch((error) => {
      console.error("Stripe embedded components failed to start:", error);
      setConnectError(error?.message || "Unknown error");
    });
  }, []);

  useEffect(() => {
    if (needsStripe && !connectStarted.current) beginConnect();
  }, [needsStripe, beginConnect]);

  // iOS zooms the whole page when a field smaller than 16px gets focus, and
  // Stripe's fields are in iframes we can't restyle. Only while this page is open.
  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) return;
    const original = viewport.getAttribute("content") ?? "";
    viewport.setAttribute("content", `${original}, maximum-scale=1.0`);
    return () => viewport.setAttribute("content", original);
  }, []);

  function retryConnect() {
    setConnect(null);
    setConnectError(null);
    beginConnect();
  }

  async function enroll() {
    if (enrolling) return;
    setEnrolling(true);
    try {
      queryClient.setQueryData(pageKey, await enrollInCardPayments());
    } catch (error) {
      showError("set up card payments", error);
    } finally {
      setEnrolling(false);
    }
  }

  async function toggleCards(on: boolean) {
    setSavingCards(true);
    try {
      queryClient.setQueryData(pageKey, await setCardPaymentsOn(on));
    } catch (error) {
      showError("update card payments", error);
    } finally {
      setSavingCards(false);
    }
  }

  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: connectStatusKey(coachId) });
  const onComponentError = ({ elementTagName, error }: LoadError) => {
    console.error(`Stripe ${elementTagName} failed to load:`, error);
    setConnectError(`${elementTagName}: ${error.type}${error.message ? ` (${error.message})` : ""}`);
  };

  if (identityLoading) {
    return (
      <div className="loading-screen">
        <div className="billio-loader">
          <div className="billio-loader-glow" />
          <img className="billio-loader-logo" src="/logo.png" alt="Billio" />
        </div>
      </div>
    );
  }

  if (!paymentsEnabled || (status && !status.available)) return <Navigate to="/more" replace />;

  const stripePanel = connectError ? (
    <div className="ref-card payments-problem">
      <p>We couldn't load this part of Stripe. Try again, or open Billio in Chrome or Safari with any ad blocker turned off.</p>
      <small className="payments-problem-detail">{connectError}</small>
      <button type="button" className="payments-primary-btn" onClick={retryConnect}>Try again</button>
    </div>
  ) : !connect ? (
    <div className="ref-card payments-problem"><p>Loading…</p></div>
  ) : (
    <ConnectComponentsProvider connectInstance={connect}>
      {state === "onboarding" ? (
        <div className="ref-card payments-embed">
          <ConnectAccountOnboarding onExit={refreshStatus} onLoadError={onComponentError} />
        </div>
      ) : (
        <>
          <ConnectNotificationBanner onLoadError={onComponentError} />
          <div className="ref-card payments-embed">
            <h2 className="ref-card-title">Your balance</h2>
            <ConnectBalances onLoadError={onComponentError} />
            <p className="payments-note">
              Use Pay out to withdraw to your bank. Standard transfers are free. Expedited transfers cost 1% and
              arrive in about 30 minutes, when Stripe offers them for your account.
            </p>
          </div>
          <div className="ref-card payments-embed">
            <h2 className="ref-card-title">Payments and refunds</h2>
            <ConnectPayments onLoadError={onComponentError} />
            <p className="payments-note">
              If you refund a parent, Billio's 1% is returned to you, but Stripe keeps its processing fee.
            </p>
          </div>
          <div className="ref-card payments-embed">
            <h2 className="ref-card-title">Withdrawals</h2>
            <ConnectPayoutsList onLoadError={onComponentError} />
          </div>
          <div className="ref-card payments-embed">
            <h2 className="ref-card-title">Account and bank details</h2>
            <ConnectAccountManagement onLoadError={onComponentError} />
          </div>
        </>
      )}
    </ConnectComponentsProvider>
  );

  return (
    <div className="ref-page">
      <div className="ref-header">
        <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
          <FaArrowLeft />
        </button>
        <img src="/logo.png" alt="Billio" className="ref-logo" />
      </div>

      <div className="ref-body">
        <div className="ref-hero">
          <div className="ref-hero-icon"><FaCreditCard /></div>
          <h1 className="ref-title">Accept Payments</h1>
          <p className="ref-subtitle">Let parents pay invoices by card or Apple Pay.</p>
          {status?.available && !status.livemode && <span className="payments-test-pill">Test mode</span>}
        </div>

        {isError && (
          <div className="ref-card payments-problem">
            <p>We couldn't load your payment details.</p>
            <button type="button" className="payments-primary-btn" disabled={isFetching} onClick={() => refetch()}>
              Try again
            </button>
          </div>
        )}

        {!status && !isError && <div className="ref-card payments-problem"><p>Loading…</p></div>}

        {state === "not_started" && (
          <>
            <div className="ref-card">
              <h2 className="ref-card-title">How it works</h2>
              <ul className="payments-points">
                <li>Parents pay from the invoice link with a credit card, debit card or Apple Pay.</li>
                <li>The money goes to your balance, and the invoice is marked paid.</li>
                <li>Withdraw to your bank whenever you like. Standard transfers are free; expedited transfers cost 1%, when available.</li>
              </ul>
            </div>

            <div className="ref-card">
              <h2 className="ref-card-title">What it costs, on a $60 invoice</h2>
              <div className="payments-fee-row"><span>Parent pays</span><span>$60.00</span></div>
              <div className="payments-fee-row"><span>Stripe processing</span><span>−$2.04</span></div>
              <div className="payments-fee-row"><span>Billio (1%)</span><span>−$0.60</span></div>
              <div className="payments-fee-row payments-fee-total"><span>You receive</span><span>$57.36</span></div>
              <p className="payments-note">Stripe's fee can vary a little by card. There's no monthly cost.</p>
            </div>

            <button type="button" className="payments-primary-btn" disabled={enrolling} onClick={enroll}>
              {enrolling ? "Setting up…" : "Set up card payments"}
            </button>
            <p className="payments-note payments-note-center">
              Stripe, our payments partner, will confirm your identity and bank details. It takes about 5 minutes.
              This is optional, and Venmo and Zelle keep working either way.
            </p>
          </>
        )}

        {state === "onboarding" && (
          <>
            <p className="payments-note payments-note-center">
              Stripe may open a small window to confirm your phone number. If nothing appears, allow pop-ups for Billio.
            </p>
            <p className="payments-note payments-note-center">
              Stripe asks for a customer support address, which parents may be able to see. If you'd rather not share
              your home address, you can use the rink or studio where you teach, or a mailing address like a PO box.
            </p>
          </>
        )}

        {state && state !== "not_started" && state !== "onboarding" && (
          <div className="ref-card payments-status" data-state={state}>
            <span className="payments-status-icon">{STATE_COPY[state].icon}</span>
            <div>
              <strong>{STATE_COPY[state].title}</strong>
              <small>{STATE_COPY[state].text}</small>
            </div>
          </div>
        )}

        {state === "active" && status?.available && (
          <div className="ref-card">
            <label className="settings-pay-switch payments-switch">
              <input
                type="checkbox"
                role="switch"
                checked={status.card_payments_on}
                disabled={savingCards}
                onChange={(e) => toggleCards(e.target.checked)}
              />
              <span className="settings-pay-switch-track" aria-hidden="true" />
              <span className="settings-pay-switch-text">
                <strong>Accept cards on invoices</strong>
                <small>Turn this off to hide the card option from parents.</small>
              </span>
            </label>
          </div>
        )}

        {toReview > 0 && (
          <div className="ref-card payments-status" data-state="action_needed">
            <span className="payments-status-icon"><FaExclamationCircle /></span>
            <div>
              <strong>{toReview === 1 ? "A payment needs" : `${toReview} payments need`} your review</strong>
              <small>The invoice was already paid or its amount changed. Check below and refund the parent if needed.</small>
            </div>
          </div>
        )}

        {received.length > 0 && (
          <div className="ref-card payments-received">
            <span>Received by card</span>
            <strong>{formatMoney(receivedCents / 100)}</strong>
            <small>{received.length === 1 ? "1 payment" : `${received.length} payments`} through Billio, before fees</small>
          </div>
        )}

        {needsStripe && stripePanel}
      </div>

      <nav className="bottom-nav">
        <div className="nav-item" onClick={() => navigate("/dashboard")}><FaHome /><span>Dashboard</span></div>
        <div className="nav-item" onClick={() => navigate("/lessons")}><FaCalendarAlt /><span>{term.plural}</span></div>
        <div className="nav-item" onClick={() => navigate("/students")}><FaUsers /><span>Students</span></div>
        <div className="nav-item" onClick={() => navigate("/invoices")}><FaFileInvoiceDollar /><span>Invoices</span></div>
        <div className="nav-item active" onClick={() => navigate("/more")}><FaEllipsisH /><span>More</span></div>
      </nav>
    </div>
  );
}
