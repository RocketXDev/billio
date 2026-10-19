import { Component, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { FaExclamationTriangle } from "react-icons/fa";
import "./ErrorBoundary.css";

type Props = { children: ReactNode; resetKey: string };
type State = { error: Error | null };

// Catches render crashes so the coach gets a way back instead of a blank
// page. Resets when the route changes, so navigating away recovers.
class Boundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("Billio crashed:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="crash-screen">
        <div className="billio-confirm-card crash-card" role="alert">
          <div className="billio-confirm-icon" aria-hidden="true">
            <FaExclamationTriangle />
          </div>
          <h2>Something went wrong</h2>
          <p>
            Billio hit an unexpected error on this page. Everything you already
            saved is safe — reload to pick up where you left off.
          </p>
          <code className="crash-detail">{this.state.error.message}</code>
          <div className="billio-confirm-actions">
            <button type="button" className="billio-cancel-btn" onClick={() => window.location.assign("/dashboard")}>
              Dashboard
            </button>
            <button type="button" className="crash-reload-btn" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default function ErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <Boundary resetKey={location.pathname}>{children}</Boundary>;
}
