/* ==========================================================================
   QUALITY TIERS — decided before the Canvas exists.
   1. Hardware hints (cores, memory, touch, save-data) give a first guess.
   2. One throwaway WebGL context reveals the GPU name: software renderers
      get no 3D at all (the poster stays); integrated laptop and phone GPUs
      cap at medium.
   3. ?quality=low|medium|high in the URL overrides everything (and forces
      the 3D on, even on a software renderer).
   ========================================================================== */

export type Tier = "low" | "medium" | "high";

export type TierSettings = {
  dprCap: number;
  antialias: boolean;
  landSamples: number; // Fibonacci samples on the sphere; ~29% become land dots
  stars: number;
  twinkle: boolean;
  ambientArcs: boolean;
  cityLights: boolean;
};

export const TIERS: Record<Tier, TierSettings> = {
  high: { dprCap: 2, antialias: true, landSamples: 60000, stars: 2400, twinkle: true, ambientArcs: true, cityLights: true },
  medium: { dprCap: 1.5, antialias: true, landSamples: 36000, stars: 1200, twinkle: false, ambientArcs: true, cityLights: true },
  low: { dprCap: 1, antialias: false, landSamples: 20000, stars: 500, twinkle: false, ambientArcs: false, cityLights: false },
};

const isTier = (v: string | null): v is Tier => v === "low" || v === "medium" || v === "high";

/** Software rasterisers: a CPU-throttled phone in a lab, a VM, a remote desktop. */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|mesa offscreen|gdi generic/i;

function gpuName(gl: WebGL2RenderingContext) {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const unmasked = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "") : "";
  return unmasked || String(gl.getParameter(gl.RENDERER) || "");
}

function context(opts: WebGLContextAttributes): WebGL2RenderingContext | null {
  try {
    return document.createElement("canvas").getContext("webgl2", opts);
  } catch {
    return null;
  }
}

/**
 * webgl: WebGL2 exists at all · software: it would run on a software rasteriser
 * (then the page keeps the poster and never downloads the 3D chunk) · forced: ?quality= was given,
 * which turns the 3D on even for software renderers.
 */
export type Probe = { webgl: boolean; tier: Tier; gpu: string; software: boolean; forced: boolean };

/** Tiny and three.js-free: one small context, read the renderer string, lose the context. */
export function probeQuality(): Probe {
  const forced = new URLSearchParams(window.location.search).get("quality");
  // three.js r163+ renders with WebGL2 only, so WebGL1-only devices get the poster
  let gl = context({ powerPreference: "high-performance", failIfMajorPerformanceCaveat: true });
  let caveat = false;
  if (!gl) {
    // only a slow (software) context is on offer
    gl = context({ powerPreference: "high-performance" });
    caveat = !!gl;
  }
  if (!gl) return { webgl: false, tier: "low", gpu: "", software: false, forced: false };

  const gpu = gpuName(gl);
  gl.getExtension("WEBGL_lose_context")?.loseContext(); // free it right away
  const software = caveat || SOFTWARE.test(gpu);

  if (isTier(forced)) return { webgl: true, tier: forced, gpu, software, forced: true };

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 4;
  const touch = window.matchMedia("(pointer: coarse)").matches;

  let tier: Tier = "high";
  if (nav.connection?.saveData || cores <= 2 || memory <= 2) tier = "low";
  else if (touch || cores <= 4 || memory <= 4) tier = "medium";

  if (software) tier = "low";
  else if (/intel|uhd|iris|mali|adreno|powervr|apple gpu|radeon\(tm\) graphics|radeon graphics/i.test(gpu) && tier === "high")
    tier = "medium";

  return { webgl: true, tier, gpu, software, forced: false };
}
