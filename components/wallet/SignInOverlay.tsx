"use client";

import { Loader2, ShieldCheck } from "lucide-react";

export default function SignInOverlay({
  visible,
  signingIn,
  onSignIn,
  onSkip,
}: {
  visible: boolean;
  signingIn: boolean;
  onSignIn: () => void;
  onSkip?: () => void;
}) {
  if (!visible) return null;

  return (
    <div className="sign-in-overlay">
      <div className="sign-in-overlay-card">
        <div className="sign-in-overlay-icon">
          {signingIn ? (
            <Loader2 size={40} className="animate-spin text-[var(--brand)]" />
          ) : (
            <ShieldCheck size={40} className="text-[var(--brand)]" />
          )}
        </div>
        <h2 className="sign-in-overlay-title">
          {signingIn ? "Signing in…" : "Sign in to continue"}
        </h2>
        <p className="sign-in-overlay-desc">
          {signingIn
            ? "Please confirm the signature in your wallet"
            : "Verify wallet ownership to access all features"}
        </p>
        {!signingIn && (
          <button
            type="button"
            onClick={onSignIn}
            className="sign-in-overlay-btn"
          >
            <ShieldCheck size={18} />
            Sign In
          </button>
        )}
        {!signingIn && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="sign-in-overlay-skip"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
