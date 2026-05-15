import { useNavigate, useLocation } from "react-router-dom";
import {
  FaArrowLeft,
  FaTools,
} from "react-icons/fa";

function ComingSoon() {
  const navigate = useNavigate();
  const location = useLocation();

  const pageName =
    location.pathname.replace("/", "").charAt(0).toUpperCase() +
    location.pathname.replace("/", "").slice(1);

  return (
    <div className="coming-soon-page">
      <div className="coming-soon-card">
        <div className="coming-soon-icon">
          <FaTools />
        </div>

        <h1>{pageName}</h1>

        <p>
          This function is currently not available.
        </p>

        <button
          type="button"
          className="coming-soon-btn"
          onClick={() => navigate("/dashboard")}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default ComingSoon;