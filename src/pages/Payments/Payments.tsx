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
import type { StripeConnectInstance } from "@stripe/connect-js";
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
  ConnectNotificationBanner,
} from "@stripe/react-connect-js";
import { useCoachIdentity } from "../../hooks/useCoachIdentity";
import { useLessonTerm } from "../../hooks/useLessonTerm";
import {
  connectStatusKey,
  enrollInCardPayments,
  fetchConnectStatus,
  paymentsEnabledFor,
  setCardPaymentsOn,
  type ConnectState,
} from "../../lib/connect";
import { showError } from "../../lib/notify";
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
  const [connectFailed, setConnectFailed] = useState(false);

  const state = status?.available ? status.state : null;
  const needsStripe = !!state && state !== "not_started";

  const connectStarted = useRef(false);
  const beginConnect = useCallback(() => {
    connectStarted.current = true;
    startConnect().then(setConnect).catch((error) => {
      console.error("Stripe embedded components failed to start:", error);
      setConnectFailed(true);
    });
  }, []);

  useEffect(() => {
    if (needsStripe && !connectStarted.current) beginConnect();
  }, [needsStripe, beginConnect]);

  function retryConnect() {
    setConnect(null);
    setConnectFailed(false);
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
  const onComponentError = () => setConnectFailed(true);

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

  const stripePanel = connectFailed ? (
    <div className="ref-card payments-problem">
      <p>We couldn't load this part of Stripe. Check your connection and try again.</p>
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
          <h1 className="ref-title">Payments</h1>
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
          <p className="payments-note payments-note-center">
            Stripe may open a small window to confirm your phone number. If nothing appears, allow pop-ups for Billio.
          </p>
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
