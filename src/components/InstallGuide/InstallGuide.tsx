// src/components/InstallGuide/InstallGuide.tsx
import { useState } from "react";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import "./InstallGuide.css";

interface InstallGuideProps {
  onClose: () => void;
}

const IOS_STEPS = [
  {
    icon: "⬆️",
    title: "Tap the Share button",
    desc: 'In Safari, tap the Share icon at the bottom of the screen (the box with an arrow pointing up).',
  },
  {
    icon: "➕",
    title: 'Tap "Add to Home Screen"',
    desc: 'Scroll down in the share menu and tap "Add to Home Screen".',
  },
  {
    icon: "✅",
    title: "Tap Add",
    desc: 'Give it a name or leave it as "Billio", then tap Add in the top right corner.',
  },
];

const ANDROID_STEPS = [
  {
    icon: "⋮",
    title: "Tap the menu",
    desc: "In Chrome, tap the three-dot menu in the top right corner.",
  },
  {
    icon: "➕",
    title: 'Tap "Add to Home screen"',
    desc: 'Tap "Add to Home screen" or "Install app" from the menu.',
  },
  {
    icon: "✅",
    title: "Tap Install",
    desc: "Confirm by tapping Install or Add. Billio will appear on your home screen.",
  },
];

export function InstallGuide({ onClose }: InstallGuideProps) {
  const { platform, triggerAndroidInstall, deferredPrompt } = useInstallPrompt();
  const steps = platform === "ios" ? IOS_STEPS : ANDROID_STEPS;

  return (
    <div className="install-overlay" onClick={onClose}>
      <div className="install-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="install-sheet-header">
          <img src="/logo.png" alt="Billio" className="install-logo" />
          <button type="button" className="install-close-btn" onClick={onClose}>×</button>
        </div>

        <h2 className="install-title">Add Billio to your Home Screen</h2>
        <p className="install-subtitle">
          Get the full app experience — faster access, no browser bar, works like a native app.
        </p>

        <div className="install-steps">
          {steps.map((step, i) => (
            <div key={i} className="install-step">
              <div className="install-step-num">{i + 1}</div>
              <div className="install-step-icon">{step.icon}</div>
              <div>
                <strong>{step.title}</strong>
                <p>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {platform === "android" && deferredPrompt && (
          <button
            type="button"
            className="install-cta-btn"
            onClick={() => { triggerAndroidInstall(); onClose(); }}
          >
            Install Billio
          </button>
        )}

        {platform === "ios" && (
          <div className="install-ios-hint">
            <span>Look for</span>
            <span className="install-share-icon">⬆️</span>
            <span>at the bottom of Safari</span>
          </div>
        )}

        <button type="button" className="install-dismiss-btn" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

// ── Banner shown on dashboard ──────────────────────────────────
interface InstallBannerProps {
  onOpenGuide: () => void;
  onDismiss: () => void;
}

export function InstallBanner({ onOpenGuide, onDismiss }: InstallBannerProps) {
  return (
    <div className="install-banner">
      <div className="install-banner-left">
        <img src="/b-logo.png" alt="Billio" className="install-banner-logo" />
        <div>
          <strong>Add Billio to your Home Screen</strong>
          <p>Tap to set up the app in 3 quick steps.</p>
        </div>
      </div>
      <div className="install-banner-actions">
        <button type="button" className="install-banner-cta" onClick={onOpenGuide}>
          Set up
        </button>
        <button type="button" className="install-banner-dismiss" onClick={onDismiss}>
          Later
        </button>
      </div>
    </div>
  );
}