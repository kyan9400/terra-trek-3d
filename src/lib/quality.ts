/* ==========================================================================
   QUALITY TIERS — decided before the Canvas exists.
   1. Hardware hints (cores, memory, touch, save-data) give a first guess.
   2. One throwaway WebGL context reveals the GPU name: software renderers
      drop to low; integrated laptop and phone GPUs cap at medium.
   3. ?quality=low|medium|high in the URL overrides everything.
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

function gpuName(gl: WebGL2RenderingContext) {
  const name = String(gl.getParameter(gl.RENDERER) || "");
  if (!/^webkit/i.test(name)) return name; // Firefox already reports the real name
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || name) : name;
}

export type Probe = { webgl: boolean; tier: Tier; gpu: string };

export function probeQuality(): Probe {
  const forced = new URLSearchParams(window.location.search).get("quality");
  // three.js r163+ renders with WebGL2 only, so WebGL1-only devices get the poster
  let gl: WebGL2RenderingContext | null = null;
  try {
    const canvas = document.createElement("canvas");
    gl = canvas.getContext("webgl2", { powerPreference: "high-performance" });
  } catch {
    gl = null;
  }
  if (!gl) return { webgl: false, tier: "low", gpu: "" };

  const gpu = gpuName(gl);
  gl.getExtension("WEBGL_lose_context")?.loseContext(); // free it right away

  if (isTier(forced)) return { webgl: true, tier: forced, gpu };

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 4;
  const touch = window.matchMedia("(pointer: coarse)").matches;

  let tier: Tier = "high";
  if (nav.connection?.saveData || cores <= 2 || memory <= 2) tier = "low";
  else if (touch || cores <= 4 || memory <= 4) tier = "medium";

  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) tier = "low";
  else if (/intel|uhd|iris|mali|adreno|powervr|apple gpu|radeon\(tm\) graphics|radeon graphics/i.test(gpu) && tier === "high")
    tier = "medium";

  return { webgl: true, tier, gpu };
}
