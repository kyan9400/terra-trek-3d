/* ==========================================================================
   NOISE TEXTURE — smooth value noise baked into a small tileable 3D texture.
   The earth and cloud shaders sample it instead of hashing noise inline:
   one texture fetch per octave instead of eight hashes. That keeps the
   shaders small, so they compile in a fraction of the time (ANGLE / D3D
   translates every unrolled inline-noise octave separately).
   Period: NOISE_PERIOD lattice cells per texture repeat, SUB texels per cell;
   the hardware's trilinear filter fills in between the baked samples.
   ========================================================================== */

import * as THREE from "three";

export const NOISE_PERIOD = 16;
const SUB = 4;

/** GLSL: vnoise(x) ≈ smooth value noise with one lattice cell per unit, 0..1. Needs `uniform sampler3D uNoise;`. */
export const NOISE_TEX_GLSL = /* glsl */ `
  uniform highp sampler3D uNoise;
  float vnoise(vec3 x) {
    return texture(uNoise, x * ${(1 / NOISE_PERIOD).toFixed(6)}).r;
  }
  vec3 vnoise3(vec3 x) {
    return vec3(vnoise(x), vnoise(x + 7.13), vnoise(x + 3.71)) - 0.5;
  }
`;

export function makeNoiseTexture() {
  const P = NOISE_PERIOD;
  const N = P * SUB;
  // lattice values (a fixed-seed LCG, so every visit looks the same)
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const lat = new Float32Array(P * P * P);
  for (let i = 0; i < lat.length; i++) lat[i] = rand();
  const L = (x: number, y: number, z: number) => lat[((z % P) * P + (y % P)) * P + (x % P)];
  const fade = (t: number) => t * t * (3 - 2 * t);

  const data = new Uint16Array(N * N * N);
  let k = 0;
  for (let z = 0; z < N; z++) {
    const z0 = Math.floor(z / SUB);
    const fz = fade((z % SUB) / SUB);
    for (let y = 0; y < N; y++) {
      const y0 = Math.floor(y / SUB);
      const fy = fade((y % SUB) / SUB);
      for (let x = 0; x < N; x++) {
        const x0 = Math.floor(x / SUB);
        const fx = fade((x % SUB) / SUB);
        const a = L(x0, y0, z0) + (L(x0 + 1, y0, z0) - L(x0, y0, z0)) * fx;
        const b = L(x0, y0 + 1, z0) + (L(x0 + 1, y0 + 1, z0) - L(x0, y0 + 1, z0)) * fx;
        const c = L(x0, y0, z0 + 1) + (L(x0 + 1, y0, z0 + 1) - L(x0, y0, z0 + 1)) * fx;
        const d = L(x0, y0 + 1, z0 + 1) + (L(x0 + 1, y0 + 1, z0 + 1) - L(x0, y0 + 1, z0 + 1)) * fx;
        const ab = a + (b - a) * fy;
        const cd = c + (d - c) * fy;
        data[k++] = THREE.DataUtils.toHalfFloat(ab + (cd - ab) * fz);
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RedFormat;
  tex.type = THREE.HalfFloatType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
