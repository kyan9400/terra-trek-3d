/* ==========================================================================
   EARTH TEXTURES — the painted globe, made in code at build time.
   - mask  (R8, equirectangular): the hand-plotted land polygons from land.ts,
           filled by a 2D canvas (anti-aliased edges, very fast).
   - geo   (RGBA8, low-res, mipmapped):
             R terrain height (terrain.ts ranges)
             G metro light (night side)
             B soft land coverage (the mask box-blurred over ~1.5°): coast
               shaping, and at a lower mip level the shallow continental shelf
             A aridity 0 (rainforest) … 1 (sand sea): latitude climate belts
               plus hand-placed deserts and wet forests (coarse geography)
   The surface shader turns these into biomes, relief, coasts and lights.
   Built in row slices that yield to the main thread. No per-frame work.
   ========================================================================== */

import * as THREE from "three";
import { LAND_RAW, WATER_RAW, antarcticEdge } from "./land";
import { aridity } from "./climate";
import { cityLight, terrainHeight } from "./terrain";

const DEG = Math.PI / 180;

function yieldToMain(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export type EarthTextures = { mask: THREE.DataTexture; geo: THREE.DataTexture };

/**
 * maskW: width of the equirectangular land mask (height = maskW / 2).
 * geoW: width of the geo texture (height = geoW / 2), a power of two.
 * Returns null if `alive()` turns false part-way.
 */
export async function buildEarth(maskW: number, geoW: number, lights: boolean, alive: () => boolean): Promise<EarthTextures | null> {
  const W = maskW;
  const H = maskW / 2;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const X = (lon: number) => ((lon + 180) / 360) * W;
  const Y = (lat: number) => ((90 - lat) / 180) * H;
  const poly = (pts: number[]) => {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      if (i === 0) ctx.moveTo(X(pts[i]), Y(pts[i + 1]));
      else ctx.lineTo(X(pts[i]), Y(pts[i + 1]));
    }
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  LAND_RAW.forEach(poly);
  // Antarctica: the wavy edge down to the pole
  ctx.beginPath();
  ctx.moveTo(X(-180), Y(-90));
  for (let lon = -180; lon <= 180; lon += 2) ctx.lineTo(X(lon), Y(antarcticEdge(lon)));
  ctx.lineTo(X(180), Y(-90));
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#000";
  WATER_RAW.forEach(poly);

  const rgba = ctx.getImageData(0, 0, W, H).data;
  // R8, flipped so row 0 is the south pole (v = 0 ↔ lat −90°, matching the globe's uv)
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W * 4;
    const dst = y * W;
    for (let x = 0; x < W; x++) mask[dst + x] = rgba[src + x * 4];
  }
  canvas.width = canvas.height = 1; // free the canvas memory
  await yieldToMain();
  if (!alive()) return null;

  // geo grid: box-average the mask into it, then blur ~1.5°
  const GW = geoW;
  const GH = geoW / 2;
  const step = W / GW;
  const cover = new Float32Array(GW * GH);
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      let s = 0;
      for (let yy = 0; yy < step; yy++) {
        const row = (gy * step + yy) * W + gx * step;
        for (let xx = 0; xx < step; xx++) s += mask[row + xx];
      }
      cover[gy * GW + gx] = s / (step * step * 255);
    }
  }
  const tmp = new Float32Array(GW * GH);
  const R = Math.max(1, Math.round(GW / 360)); // about 1° per pass
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        let s = 0;
        for (let k = -R; k <= R; k++) s += cover[y * GW + ((x + k + GW) % GW)];
        tmp[y * GW + x] = s / (2 * R + 1);
      }
    for (let y = 0; y < GH; y++)
      for (let x = 0; x < GW; x++) {
        let s = 0;
        for (let k = -R; k <= R; k++) s += tmp[Math.min(GH - 1, Math.max(0, y + k)) * GW + x];
        cover[y * GW + x] = s / (2 * R + 1);
      }
  }
  await yieldToMain();
  if (!alive()) return null;

  const geo = new Uint8Array(GW * GH * 4);
  const ROWS = 24;
  for (let y0 = 0; y0 < GH; y0 += ROWS) {
    if (y0 > 0) {
      await yieldToMain();
      if (!alive()) return null;
    }
    for (let y = y0; y < Math.min(GH, y0 + ROWS); y++) {
      const lat = -90 + ((y + 0.5) / GH) * 180;
      const cl = Math.cos(lat * DEG);
      const sl = Math.sin(lat * DEG);
      for (let x = 0; x < GW; x++) {
        const lon = -180 + ((x + 0.5) / GW) * 360;
        const i = (y * GW + x) * 4;
        const c = cover[y * GW + x];
        geo[i] = Math.round(terrainHeight(lat, lon) * 255);
        geo[i + 1] = lights && c > 0.02 ? Math.round(cityLight(cl * Math.sin(lon * DEG), sl, cl * Math.cos(lon * DEG)) * 255) : 0;
        geo[i + 2] = Math.round(c * 255);
        geo[i + 3] = Math.round(aridity(lat, lon) * 255);
      }
    }
  }

  const maskTex = new THREE.DataTexture(mask, W, H, THREE.RedFormat, THREE.UnsignedByteType);
  const geoTex = new THREE.DataTexture(geo, GW, GH, THREE.RGBAFormat, THREE.UnsignedByteType);
  for (const t of [maskTex, geoTex]) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
  }
  maskTex.unpackAlignment = 1;
  maskTex.anisotropy = 4;
  return { mask: maskTex, geo: geoTex };
}
