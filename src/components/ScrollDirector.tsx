"use client";

/* ==========================================================================
   SCROLL DIRECTOR — turns the page's scroll position into the route number
   `stage.p` that the globe reads:
       -1 at the top (hero) · 0..5 when each city card fills the screen · 6 outro
       · 6..7 the globe unrolls into the flat route map (scrolling the outro block)
   - ONE smoothing layer: Lenis (lerp 0.1) when full motion is on; the camera
     maps scroll directly, so it never trails behind the page.
   - Card positions are measured once (and on resize), never per scroll.
   - The active card / rail only touch the DOM when the index changes.
   - Clicking a city marker on the globe scrolls to its card.
   - The paper backdrop behind the canvas fades in with the unroll (also for
     poster-only visitors, so everyone lands on the printed map).
   - Desktop: drag the hero globe to spin it (inertia lives in the scene).
   ========================================================================== */

import { useEffect } from "react";
import Lenis from "lenis";
import { isReducedMotion, subscribeMotion } from "@/lib/motion";
import { setStageFlags, stage } from "@/lib/stage";
import { paperProgress, unrollProgress } from "@/lib/unroll-progress";

const INTERACTIVE = "a, button, input, textarea, select, summary, label, [data-card]";
/** Text the visitor might want to select: never starts a globe drag */
const TEXTY = "p, h1, h2, h3, dl, li, figure";
const WIDE_QUERY = "(min-width: 960px) and (min-aspect-ratio: 11/10)";

export default function ScrollDirector() {
  useEffect(() => {
    const root = document.documentElement;
    const stops = Array.from(document.querySelectorAll<HTMLElement>("[data-stop]"));
    const end = document.querySelector<HTMLElement>("[data-stop-end]");
    const unroll = document.querySelector<HTMLElement>("[data-stop-unroll]");
    const paperEl = document.querySelector<HTMLElement>("[data-stage-paper]");
    const stageEl = document.querySelector<HTMLElement>("[data-stage]");
    const railFill = document.querySelector<HTMLElement>("[data-rail-fill]");
    const railItems = Array.from(document.querySelectorAll<HTMLElement>("[data-rail-item]"));
    const progress = document.querySelector<HTMLElement>("[data-progress]");
    if (!stops.length || !end || !stageEl) return;

    let anchors: number[] = [];
    let maxScroll = 1;
    let lastPaper = -1;
    let active = -2;
    let lenis: Lenis | null = null;

    const docTop = (el: HTMLElement) => el.getBoundingClientRect().top + window.scrollY;

    const update = () => {
      const y = window.scrollY;
      let p = anchors.length - 2;
      if (y <= anchors[0]) p = -1;
      else {
        for (let j = 0; j < anchors.length - 1; j++) {
          if (y < anchors[j + 1]) {
            p = j - 1 + (y - anchors[j]) / Math.max(1, anchors[j + 1] - anchors[j]);
            break;
          }
        }
      }
      stage.p = p;

      const idx = p < -0.5 ? -1 : Math.min(stops.length - 1, Math.round(p));
      if (idx !== active) {
        active = idx;
        stops.forEach((el, i) => el.toggleAttribute("data-active", i === idx));
        railItems.forEach((el, i) => el.toggleAttribute("data-active", i === idx));
      }
      if (railFill) railFill.style.transform = `scaleY(${Math.min(1, Math.max(0, p / (stops.length - 1)))})`;
      // page progress bar: one transform write per scroll
      if (progress) progress.style.transform = `scaleX(${Math.min(1, Math.max(0, y / maxScroll))})`;
      // paper backdrop for the flat map (opacity only, written when it changes)
      const paper = Math.round(paperProgress(unrollProgress(p, isReducedMotion())) * 1000) / 1000;
      if (paperEl && paper !== lastPaper) {
        lastPaper = paper;
        paperEl.style.opacity = String(paper);
      }
      stage.wake();
      stage.invalidate();
    };

    const measure = () => {
      anchors = [0, ...stops.map(docTop), docTop(end)];
      if (unroll) anchors.push(docTop(unroll));
      maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setStageFlags({ wide: window.matchMedia(WIDE_QUERY).matches });
      update();
    };

    /* smooth scrolling (full motion only) */
    const startLenis = () => {
      if (lenis || isReducedMotion()) return;
      // respectReducedMotion is ours to decide (the visitor may have turned full motion on)
      lenis = new Lenis({ lerp: 0.1, anchors: true, autoRaf: true, respectReducedMotion: false });
    };
    const stopLenis = () => {
      lenis?.destroy();
      lenis = null;
    };
    startLenis();
    const offMotion = subscribeMotion(() => {
      if (isReducedMotion()) stopLenis();
      else startLenis();
      update();
    });

    stage.goTo = (index: number) => {
      const y = anchors[index + 1];
      if (y === undefined) return;
      if (lenis) lenis.scrollTo(y, { duration: 1.8 });
      else window.scrollTo({ top: y, behavior: "auto" });
      stops[index].querySelector<HTMLElement>("[data-card]")?.focus({ preventScroll: true });
    };

    /* events */
    const onScroll = () => update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(() => measure());
    ro.observe(document.body);
    document.fonts?.ready.then(measure).catch(() => undefined);

    const io = new IntersectionObserver(([entry]) => {
      setStageFlags({ visible: entry.isIntersecting });
      root.toggleAttribute("data-stage-off", !entry.isIntersecting);
    });
    io.observe(stageEl);

    let hovering = false;
    const onPointerMove = (e: PointerEvent) => {
      stage.px = (e.clientX / window.innerWidth) * 2 - 1;
      stage.py = -((e.clientY / window.innerHeight) * 2 - 1);
      if (stage.visible) stage.wake();
      if (e.pointerType !== "mouse" || !stage.visible) return;
      const target = e.target as Element | null;
      const over = !target?.closest(INTERACTIVE) && stage.pick(e.clientX, e.clientY) >= 0;
      if (over !== hovering) {
        hovering = over;
        root.toggleAttribute("data-globe-hover", over);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!stage.visible) return;
      const target = e.target as Element | null;
      if (target?.closest(INTERACTIVE)) return;
      const idx = stage.pick(e.clientX, e.clientY);
      if (idx >= 0) stage.goTo(idx);
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("click", onClick);

    /* drag-to-rotate in the hero: desktop mouse + full motion only, never on text or controls */
    let drag: { x: number; t: number; vel: number } | null = null;
    let dragged = false;
    const onDown = (e: PointerEvent) => {
      dragged = false;
      if (e.pointerType !== "mouse" || e.button !== 0 || isReducedMotion() || !stage.wide) return;
      if (stage.p > -0.5 || !stage.visible) return;
      const target = e.target as Element | null;
      if (target?.closest(INTERACTIVE) || target?.closest(TEXTY)) return;
      e.preventDefault(); // no text selection while dragging
      drag = { x: e.clientX, t: e.timeStamp, vel: 0 };
      stage.spinVel = 0;
      root.toggleAttribute("data-globe-drag", true);
    };
    const onDrag = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dt = Math.max(1, e.timeStamp - drag.t);
      const deg = -dx * 0.25; // drag right → the globe turns east-up toward you
      stage.spin += deg;
      drag.vel = drag.vel * 0.6 + ((deg / dt) * 1000) * 0.4;
      drag.x = e.clientX;
      drag.t = e.timeStamp;
      if (Math.abs(dx) > 2) dragged = true;
      stage.wake();
      stage.invalidate();
    };
    const onUp = () => {
      if (!drag) return;
      stage.spinVel = Math.max(-240, Math.min(240, drag.vel));
      drag = null;
      root.removeAttribute("data-globe-drag");
      stage.wake();
      stage.invalidate();
    };
    // a drag that ends over a marker must not also count as a click
    const onClickCapture = (e: MouseEvent) => {
      if (dragged) {
        e.stopPropagation();
        dragged = false;
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onDrag, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("click", onClickCapture, true);

    // Skip link: Lenis handles the scroll, this moves keyboard focus as well
    const skip = document.querySelector<HTMLAnchorElement>(".skip-link");
    const onSkip = () => document.getElementById("main")?.focus({ preventScroll: true });
    skip?.addEventListener("click", onSkip);

    measure();

    return () => {
      offMotion();
      stopLenis();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("click", onClick);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onDrag);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("click", onClickCapture, true);
      skip?.removeEventListener("click", onSkip);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return null;
}
