/* Scroll → unroll progress, shared by ScrollDirector (first-load bundle) and the 3D scene.
   Kept apart from unroll.ts so the GLSL never ships in the first-load JS. */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Route position p (6 = outro, 7 = flat map) → unroll progress 0..1. Reduced motion cuts at 6.5. */
export function unrollProgress(p: number, reduced: boolean) {
  if (reduced) return p >= 6.5 ? 1 : 0;
  return easeInOut(clamp01((p - 6 - 0.15) / 0.8));
}

/** Camera swing toward the map, a little ahead of the unroll. */
export function swingProgress(p: number, reduced: boolean) {
  if (reduced) return p >= 6.5 ? 1 : 0;
  return easeInOut(clamp01((p - 6) / 0.75));
}

/** Night → paper colour shift over the last part of the unroll. */
export const paperProgress = (u: number) => smooth(0.55, 1, u);
