import { useNavigate } from "react-router-dom";
import { FaCrown, FaArrowRight } from "react-icons/fa";

interface UpgradeBannerProps {
  message?: string;
  compact?: boolean;
}

export default function UpgradeBanner({
  message = "Unlock all features with Pro",
  compact = false,
}: UpgradeBannerProps) {
  const navigate = useNavigate();

  if (compact) {
    return (
      <button
        type="button"
        className="upgrade-banner-compact"
        onClick={() => navigate("/upgrade")}
      >
        <FaCrown style={{ fontSize: 11, marginRight: 5, color: "#f59e0b" }} />
        {message}
        <FaArrowRight style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }} />
      </button>
    );
  }

  return (
    <div className="upgrade-banner-full">
      <div className="upgrade-banner-left">
        <div className="upgrade-banner-crown">
          <FaCrown />
        </div>
        <div>
          <strong>Upgrade to Pro</strong>
          <p>{message}</p>
        </div>
      </div>
      <button
        type="button"
        className="upgrade-banner-btn"
        onClick={() => navigate("/upgrade")}
      >
        Upgrade
        <FaArrowRight style={{ fontSize: 11, marginLeft: 5 }} />
      </button>
    </div>
  );
}
