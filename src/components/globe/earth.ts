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
import { cityLight, terrainHeight } from "./terrain";

const DEG = Math.PI / 180;

/** [lat, lon, radius lat°, radius lon°, amount] — positive: drier, negative: wetter. */
const CLIMATE: [number, number, number, number, number][] = [
  // deserts and dry steppes
  [23, 8, 9, 24, 0.75], // Sahara
  [17, 20, 4, 18, 0.25], // Sahel edge
  [23, 47, 7, 10, 0.75], // Arabia
  [29, 60, 5, 10, 0.5], // Iran, Baluchistan
  [27, 71, 4, 4, 0.45], // Thar
  [40, 85, 4, 9, 0.7], // Taklamakan
  [43, 104, 4, 11, 0.55], // Gobi
  [46, 62, 6, 16, 0.4], // Central Asian steppe
  [-24, 18, 7, 7, 0.55], // Kalahari, Namib
  [-25, 130, 9, 16, 0.75], // Australian outback
  [-23, -69.5, 7, 2.2, 0.7], // Atacama
  [33, -112, 6, 9, 0.55], // US Southwest, Sonora
  [40, -103, 7, 6, 0.25], // Great Plains
  [-45, -68, 6, 4, 0.4], // Patagonian steppe
  [7, 46, 5, 6, 0.45], // Horn of Africa
  // wet forests
  [-4, -62, 10, 15, -0.85], // Amazon
  [0, 21, 7, 11, -0.85], // Congo
  [7, -6, 4, 10, -0.5], // West African coast
  [2, 110, 9, 16, -0.75], // Borneo, Sumatra, Malaya
  [-5, 142, 5, 8, -0.7], // New Guinea
  [22, 88, 6, 7, -0.45], // Bengal
  [28, 112, 8, 10, -0.45], // South China
  [36, 137, 5, 6, -0.4], // Japan
  [49, 6, 8, 16, -0.4], // Western Europe
  [37, -82, 9, 11, -0.4], // US East
  [12, -85, 6, 7, -0.5], // Central America
  [-20, -46, 7, 7, -0.4], // Atlantic forest
  [-28, 152, 7, 3, -0.45], // East Australian coast
  [-19, 48, 5, 3, -0.4], // East Madagascar
  [-42, 172, 5, 5, -0.45], // New Zealand
  [60, 100, 9, 45, -0.3], // Siberian taiga
  [55, -95, 8, 28, -0.3], // Canadian boreal forest
  [50, -125, 6, 6, -0.4], // Pacific Northwest
];

/** Aridity 0..1 at a lat/lon (degrees). */
function aridity(lat: number, lon: number) {
  const a = Math.abs(lat);
  // latitude belts: wet equator, dry subtropics (~24°), moderate mid-latitudes
  let v = 0.32 - 0.25 * Math.exp(-((lat / 9) ** 2)) + 0.28 * Math.exp(-(((a - 24) / 8) ** 2));
  for (let i = 0; i < CLIMATE.length; i++) {
    const [la, lo, rLa, rLo, amt] = CLIMATE[i];
    let dLon = lon - lo;
    if (dLon > 180) dLon -= 360;
    else if (dLon < -180) dLon += 360;
    const u = dLon / rLo;
    const w = (lat - la) / rLa;
    const d2 = u * u + w * w;
    if (d2 < 4) v += amt * Math.exp(-d2 * 1.6);
  }
  return Math.min(1, Math.max(0, v));
}

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
