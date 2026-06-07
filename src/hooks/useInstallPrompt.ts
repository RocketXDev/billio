// src/hooks/useInstallPrompt.ts
import { useEffect, useState } from "react";

export type Platform = "ios" | "android" | "other";

export function useInstallPrompt() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Android Chrome deferred prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Detect platform
    const ua = navigator.userAgent;
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);
    setPlatform(isIOS ? "ios" : isAndroid ? "android" : "other");

    // Already installed (standalone mode)
    const standalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches;
    setIsInstalled(standalone);

    // Check if user dismissed before
    const saved = localStorage.getItem("billio_install_dismissed");
    if (saved) {
      const { until } = JSON.parse(saved);
      if (until && Date.now() < until) setDismissed(true);
    }

    // Android: capture beforeinstallprompt
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function remindLater() {
    // Snooze for 3 days
    const until = Date.now() + 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem("billio_install_dismissed", JSON.stringify({ until }));
    setDismissed(true);
  }

  function dismissForever() {
    localStorage.setItem("billio_install_dismissed", JSON.stringify({ until: 9999999999999 }));
    setDismissed(true);
  }

  async function triggerAndroidInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  }

  // Show banner when: not installed, not dismissed, on iOS or Android
  const shouldShow = !isInstalled && !dismissed && (platform === "ios" || platform === "android");

  return {
    platform,
    isInstalled,
    dismissed,
    shouldShow,
    deferredPrompt,
    remindLater,
    dismissForever,
    triggerAndroidInstall,
  };
}