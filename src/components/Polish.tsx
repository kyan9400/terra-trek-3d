/* ==========================================================================
   POLISH — every 2D extra in one small module, imported by StageLoader after
   window "load" + idle (never in the first-load bundle):
     - section dots: active state from one IntersectionObserver
     - scroll reveals for the paper sections
     - magnetic buttons
     - a desktop cursor (dot + easing ring, "FLY" over globe markers)
   Reveals, magnets and the cursor run only with full motion and a fine
   pointer. Content is hidden only after this module adds html.has-reveal.
   ========================================================================== */

import { isReducedMotion, subscribeMotion } from "@/lib/motion";

const REVEAL = [".section-head h2", ".steps li", ".plan", ".facts > div", ".faq details"];
const LINKY = "a, button, summary, [role='button']";
const FINE = "(hover: hover) and (pointer: fine)";

/** Section dots: one observer on a line through the middle of the viewport. */
function startDots() {
  const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-dot]"));
  const byId = new Map(links.map((a) => [a.dataset.dot as string, a]));
  const sections = links
    .map((a) => document.getElementById(a.dataset.dot as string))
    .filter((el): el is HTMLElement => !!el);
  if (!sections.length) return () => {};
  let current: HTMLAnchorElement | null = null;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const link = byId.get(e.target.id) ?? null;
        if (link === current) continue;
        current?.removeAttribute("aria-current");
        link?.setAttribute("aria-current", "true");
        current = link;
      }
    },
    { rootMargin: "-50% 0px -50% 0px" },
  );
  sections.forEach((s) => io.observe(s));
  return () => io.disconnect();
}

/** Fade-and-rise reveals; only for elements still below the fold, so nothing visible blinks. */
function startReveals() {
  const root = document.documentElement;
  const items: HTMLElement[] = [];
  const fold = window.innerHeight;
  for (const sel of REVEAL) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      if (el.getBoundingClientRect().top < fold) return;
      const i = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.setProperty("--i", String(Math.min(i, 6)));
      el.setAttribute("data-reveal", "");
      items.push(el);
    });
  }
  if (!items.length) return () => {};
  root.classList.add("has-reveal");

  const show = (el: Element) => {
    el.setAttribute("data-in", "");
    io.unobserve(el);
  };
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && show(e.target)),
    { rootMargin: "0px 0px -12% 0px" },
  );
  items.forEach((el) => io.observe(el));

  // Once revealed, drop the attributes so hover transitions are not delayed
  const onEnd = (e: TransitionEvent) => {
    const el = e.target as HTMLElement;
    if (e.propertyName !== "opacity" || !el.hasAttribute("data-in")) return;
    el.removeAttribute("data-reveal");
    el.removeAttribute("data-in");
  };
  // Keyboard focus never lands on something invisible
  const onFocus = (e: FocusEvent) => {
    const el = (e.target as Element | null)?.closest("[data-reveal]:not([data-in])");
    if (el) show(el);
  };
  document.addEventListener("transitionend", onEnd);
  document.addEventListener("focusin", onFocus);
  return () => {
    io.disconnect();
    document.removeEventListener("transitionend", onEnd);
    document.removeEventListener("focusin", onFocus);
    root.classList.remove("has-reveal");
    items.forEach((el) => {
      el.removeAttribute("data-reveal");
      el.removeAttribute("data-in");
    });
  };
}

/** Buttons lean up to 6 px toward the pointer (CSS variables feed the transform). */
function startMagnets() {
  let raf = 0;
  let target: HTMLElement | null = null;
  let mx = 0;
  let my = 0;
  const write = () => {
    raf = 0;
    if (!target) return;
    target.style.setProperty("--mx", `${mx.toFixed(1)}px`);
    target.style.setProperty("--my", `${my.toFixed(1)}px`);
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const btn = (e.target as Element | null)?.closest<HTMLElement>(".btn") ?? null;
    if (btn !== target) {
      target?.style.removeProperty("--mx");
      target?.style.removeProperty("--my");
      target = btn;
    }
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    mx = Math.max(-1, Math.min(1, dx)) * 6;
    my = Math.max(-1, Math.min(1, dy)) * 6;
    if (!raf) raf = requestAnimationFrame(write);
  };
  document.addEventListener("pointermove", onMove, { passive: true });
  return () => {
    document.removeEventListener("pointermove", onMove);
    cancelAnimationFrame(raf);
    target?.style.removeProperty("--mx");
    target?.style.removeProperty("--my");
  };
}

/** Dot + ring cursor. The ring eases toward the pointer and its loop stops once it settles. */
function startCursor() {
  const root = document.documentElement;
  const dot = document.createElement("div");
  const ring = document.createElement("div");
  dot.className = "cursor-dot";
  ring.className = "cursor-ring";
  ring.innerHTML = '<span class="cursor-ring__shape"></span><span class="cursor-ring__label">Fly</span>';
  dot.setAttribute("aria-hidden", "true");
  ring.setAttribute("aria-hidden", "true");
  document.body.append(dot, ring);

  let x = -100;
  let y = -100;
  let rx = -100;
  let ry = -100;
  let raf = 0;
  let shown = false;

  const loop = () => {
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx.toFixed(2)}px, ${ry.toFixed(2)}px, 0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > 0.2 ? requestAnimationFrame(loop) : 0;
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    x = e.clientX;
    y = e.clientY;
    if (!shown) {
      shown = true;
      rx = x;
      ry = y;
      root.classList.add("cursor-on");
    }
    const t = e.target as Element | null;
    ring.toggleAttribute("data-link", !!t?.closest(LINKY));
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const onLeave = (e: PointerEvent) => {
    if (e.relatedTarget) return;
    shown = false;
    root.classList.remove("cursor-on");
  };
  root.classList.add("has-cursor");
  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerout", onLeave);
  return () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerout", onLeave);
    cancelAnimationFrame(raf);
    root.classList.remove("has-cursor", "cursor-on");
    dot.remove();
    ring.remove();
  };
}

/** Starts everything; motion-only extras follow the motion setting live. Returns a cleanup. */
export function startPolish() {
  const stopDots = startDots();
  const fine = window.matchMedia(FINE);
  let stopMotion: (() => void)[] = [];

  const sync = () => {
    const want = !isReducedMotion() && fine.matches;
    if (want && !stopMotion.length) stopMotion = [startReveals(), startMagnets(), startCursor()];
    else if (!want && stopMotion.length) {
      stopMotion.forEach((f) => f());
      stopMotion = [];
    }
  };
  sync();
  const offMotion = subscribeMotion(sync);
  fine.addEventListener("change", sync);

  return () => {
    stopDots();
    offMotion();
    fine.removeEventListener("change", sync);
    stopMotion.forEach((f) => f());
  };
}
