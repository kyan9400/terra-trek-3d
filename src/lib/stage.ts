/* ==========================================================================
   STAGE STATE — the one place where the HTML page and the 3D scene meet.
   Written by the scroll director (event handlers), read by the scene every
   frame. Plain mutable object on purpose: no React state per scroll/frame.
   ========================================================================== */

const listeners = new Set<() => void>();

/** Subscribe to coarse stage changes (visibility, layout). Not called per scroll. */
export function subscribeStage(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setStageFlags(flags: { visible?: boolean; wide?: boolean }) {
  let changed = false;
  if (flags.visible !== undefined && flags.visible !== stage.visible) {
    stage.visible = flags.visible;
    changed = true;
  }
  if (flags.wide !== undefined && flags.wide !== stage.wide) {
    stage.wide = flags.wide;
    changed = true;
  }
  if (changed) {
    listeners.forEach((l) => l());
    stage.invalidate();
  }
}

export const stage = {
  /** Continuous route position: -1 hero · 0..5 city cards · 6 outro · 6..7 the globe unrolls into a map */
  p: -1,
  /** Until this time (performance.now) the canvas renders every frame; otherwise the idle ticker runs at ~30 fps */
  hotUntil: 0,
  /** Something just moved (scroll, pointer, intro): render at full rate for 1.5 s */
  wake() {
    stage.hotUntil = performance.now() + 1500;
  },
  /** Pointer in NDC (-1..1), for gentle parallax */
  px: 0,
  py: 0,
  /** Desktop drag-to-rotate in the hero: extra longitude (degrees) and its inertia (degrees / s) */
  spin: 0,
  spinVel: 0,
  /** Is the stage (hero + routes) on screen? */
  visible: true,
  /** Wide layout (cards left, globe right) vs. stacked (globe above) */
  wide: true,
  /** Set by the canvas: request one new frame (render on demand) */
  invalidate: () => {},
  /** Set by the scroll director: fly to a city card */
  goTo: (index: number) => {
    void index;
  },
  /** Set by the canvas: screen-space marker picking, returns a city index or -1 */
  pick: (clientX: number, clientY: number) => {
    void clientX;
    void clientY;
    return -1;
  },
};
