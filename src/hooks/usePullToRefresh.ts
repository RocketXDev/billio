import { useEffect } from "react";

export function usePullToRefresh() {
  useEffect(() => {
    let startY = 0;

    function handleTouchStart(e: TouchEvent) {
      startY = e.touches[0].clientY;
    }

    function handleTouchEnd(e: TouchEvent) {
      const endY = e.changedTouches[0].clientY;
      const pulledDown = endY - startY > 120;

      if (window.scrollY <= 0 && pulledDown) {
        window.location.reload();
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);
}