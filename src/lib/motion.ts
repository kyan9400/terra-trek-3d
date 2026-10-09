/* ==========================================================================
   MOTION PREFERENCE — a tiny external store.
   The OS "reduce motion" setting is respected by default, but many Windows
   users turn animations off for speed, not comfort, so the visitor can turn
   full motion back on. The choice is remembered (localStorage) and
   ?motion=full|reduced in the URL wins over both.
   ========================================================================== */

const KEY = "terra-trek-motion";
type Choice = "full" | "reduced";

let reduced: boolean | null = null; // null until read on the client
const listeners = new Set<() => void>();

function readChoice(): Choice | null {
  const fromUrl = new URLSearchParams(window.location.search).get("motion");
  if (fromUrl === "full" || fromUrl === "reduced") return fromUrl;
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "full" || saved === "reduced" ? saved : null;
  } catch {
    return null; // storage blocked (private mode, sandboxed embeds)
  }
}

function init() {
  if (reduced !== null) return;
  const choice = readChoice();
  const system = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  reduced = choice === "full" ? false : choice === "reduced" ? true : system;
  document.documentElement.classList.toggle("reduce-motion", reduced);
}

export function isReducedMotion() {
  init();
  return reduced as boolean;
}

export function setReducedMotion(value: boolean) {
  init();
  reduced = value;
  document.documentElement.classList.toggle("reduce-motion", value);
  try {
    localStorage.setItem(KEY, value ? "reduced" : "full");
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
  // A ?motion= in the URL would beat the saved choice on the next visit
  const url = new URL(window.location.href);
  if (url.searchParams.has("motion")) {
    url.searchParams.delete("motion");
    try {
      history.replaceState(history.state, "", url);
    } catch {
      /* ignore */
    }
  }
  listeners.forEach((l) => l());
}

export function subscribeMotion(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
