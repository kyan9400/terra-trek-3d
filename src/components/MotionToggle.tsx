"use client";

import { useSyncExternalStore } from "react";
import { isReducedMotion, setReducedMotion, subscribeMotion } from "@/lib/motion";

const serverSnapshot = () => null;

export default function MotionToggle() {
  const reduced = useSyncExternalStore(subscribeMotion, isReducedMotion, serverSnapshot);
  return (
    <button
      type="button"
      className="motion-toggle"
      aria-pressed={reduced === null ? undefined : !reduced}
      onClick={() => setReducedMotion(!reduced)}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3.5 12c4-3.5 13-3.5 17 0M12 3.5c-3 4-3 13 0 17" fill="none" stroke="currentColor" strokeWidth="1.6" />
        {reduced ? <path d="M5 19 19 5" stroke="currentColor" strokeWidth="1.8" /> : null}
      </svg>
      {/* stable name + aria-pressed ("Full motion, pressed / not pressed"); the mini switch shows the state */}
      <span className="motion-toggle__text">Full motion</span>
      <span className="motion-switch" aria-hidden="true" />
    </button>
  );
}
