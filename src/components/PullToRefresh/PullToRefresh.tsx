import { useEffect, useRef, useState } from "react";
import "./PullToRefresh.css";

// User must drag their finger ~200px to trigger (0.4 resistance × 200 = 80 threshold)
const THRESHOLD = 80;
const RESISTANCE = 0.4;
const R = 13;
const CIRCUMFERENCE = 2 * Math.PI * R; // ~81.68

type Phase = "idle" | "pulling" | "releasing" | "triggered";

export function PullToRefresh() {
  const [pullY, setPullY] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");

  const activeRef = useRef(false);
  const startYRef = useRef(0);
  const pullRef = useRef(0);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 4) return;
      activeRef.current = true;
      startYRef.current = e.touches[0].clientY;
      setPhase("pulling");
    }

    function onTouchMove(e: TouchEvent) {
      if (!activeRef.current) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPullY(0);
        }
        return;
      }
      const visual = Math.min(delta * RESISTANCE, THRESHOLD);
      pullRef.current = visual;
      setPullY(visual);
    }

    function onTouchEnd() {
      if (!activeRef.current) return;
      activeRef.current = false;
      const captured = pullRef.current;
      pullRef.current = 0;

      if (captured >= THRESHOLD) {
        setPhase("triggered");
        setTimeout(() => window.location.reload(), 380);
        return;
      }

      setPhase("releasing");
      setPullY(0);
      setTimeout(() => setPhase("idle"), 320);
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  if (phase === "idle") return null;

  const progress = Math.min(pullY / THRESHOLD, 1);
  const dashOffset = CIRCUMFERENCE * (1 - (phase === "triggered" ? 1 : progress));
  // Slides in from above: hidden at pullY=0, visible at pullY=THRESHOLD
  const translateY = phase === "triggered" ? 16 : pullY - 52;

  return (
    <div
      className={`ptr-wrap${phase === "releasing" || phase === "triggered" ? " ptr-spring" : ""}`}
      style={{ transform: `translateX(-50%) translateY(${translateY}px)` }}
    >
      <div className="ptr-bg">
        <div className={phase === "triggered" ? "ptr-spinning" : ""}>
          <svg viewBox="0 0 32 32" className="ptr-svg">
            <circle
              cx="16" cy="16" r={R}
              fill="none"
              stroke="var(--border, #e2e8f0)"
              strokeWidth="2.5"
            />
            <circle
              cx="16" cy="16" r={R}
              fill="none"
              stroke="var(--primary-purple, #5b3df5)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 16 16)"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
