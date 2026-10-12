/* Orthographic projection of the land mask and route arcs, computed at build time.
   Used by the no-WebGL poster (and, below, the flat route map). */

import { ROUTE } from "@/lib/route";
import { isLand } from "@/components/globe/land";
import { MAP_LON0, mapLon } from "@/components/globe/unroll";

type V = [number, number, number];
const DEG = Math.PI / 180;
const vec = (lat: number, lon: number): V => [
  Math.cos(lat * DEG) * Math.sin(lon * DEG),
  Math.sin(lat * DEG),
  Math.cos(lat * DEG) * Math.cos(lon * DEG),
];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export const R = 250;
export const C = 300;
const center = vec(20, -16);
const east = norm(cross([0, 1, 0], center));
const north = cross(center, east);
const project = (v: V) => [C + dot(v, east) * R, C - dot(v, north) * R] as const;

function buildDots() {
  const n = 9000;
  const golden = Math.PI * (3 - Math.sqrt(5));
  let d = "";
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const v: V = [Math.cos(golden * i) * r, y, Math.sin(golden * i) * r];
    const facing = dot(v, center);
    if (facing < 0.15) continue; // the limb dots are hidden by the rim anyway
    if (!isLand(Math.atan2(v[0], v[2]) / DEG, Math.asin(y) / DEG)) continue;
    const [x, py] = project(v);
    d += `M${x.toFixed(0)} ${py.toFixed(0)}h0`; // integer coords: smaller HTML, same look at 600×600
  }
  return d;
}

function buildArcs() {
  const paths: string[] = [];
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const a = vec(ROUTE[i].lat, ROUTE[i].lon);
    const b = vec(ROUTE[i + 1].lat, ROUTE[i + 1].lon);
    const ang = Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
    const lift = 0.05 + 0.26 * (ang / Math.PI);
    let d = "";
    let pen = false;
    for (let s = 0; s <= 48; s++) {
      const t = s / 48;
      const wa = Math.sin((1 - t) * ang) / Math.sin(ang);
      const wb = Math.sin(t * ang) / Math.sin(ang);
      const h = 1.004 + lift * Math.sin(Math.PI * t);
      const p: V = [(a[0] * wa + b[0] * wb) * h, (a[1] * wa + b[1] * wb) * h, (a[2] * wa + b[2] * wb) * h];
      // hidden when behind the globe's disc
      const side = Math.hypot(dot(p, east), dot(p, north));
      const visible = dot(p, center) > 0 || side > 1;
      if (!visible) {
        pen = false;
        continue;
      }
      const [x, y] = project(p);
      d += `${pen ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      pen = true;
    }
    if (d) paths.push(d);
  }
  return paths;
}

export const DOTS = buildDots();
export const ARCS = buildArcs();
export const PINS = ROUTE.map((c) => ({ ...c, v: vec(c.lat, c.lon) }))
  .filter((c) => dot(c.v, center) > 0.1)
  .map((c) => ({ code: c.code, xy: project(c.v) }));


/* --------------------------------------------------------------------------
   Flat map (equirectangular, Pacific-centred, seam at lon −45°: the same
   projection the 3D globe unrolls into). Shown in the unroll block to every
   visitor without the 3D, so everyone ends on the printed route map.
   -------------------------------------------------------------------------- */

export const MAP_VW = 720;
export const MAP_VH = 360;
const mapX = (lonR: number) => Math.round(((lonR + Math.PI) / (2 * Math.PI)) * MAP_VW);
const mapY = (latRad: number) => Math.round((0.5 - latRad / Math.PI) * MAP_VH);

/** Halftone rows: one short segment per run of land, drawn as dots by a "0 6" dash pattern. */
export const FLAT_STEP = 6; // px between dots = 3° of longitude / latitude
function buildFlatDots() {
  let d = "";
  for (let y = FLAT_STEP / 2; y < MAP_VH; y += FLAT_STEP) {
    const lat = (0.5 - y / MAP_VH) * 180;
    let run = -1;
    for (let x = FLAT_STEP / 2; x <= MAP_VW; x += FLAT_STEP) {
      const lon = (x / MAP_VW) * 360 - 180 + MAP_LON0;
      const land = x < MAP_VW && isLand(((lon + 540) % 360) - 180, lat);
      if (land && run < 0) run = x;
      if (!land && run >= 0) {
        d += `M${run} ${y}h${x - FLAT_STEP - run}`;
        run = -1;
      }
    }
  }
  return d;
}

function buildFlatRoute() {
  const paths: string[] = [];
  for (let i = 0; i < ROUTE.length - 1; i++) {
    const a = vec(ROUTE[i].lat, ROUTE[i].lon);
    const b = vec(ROUTE[i + 1].lat, ROUTE[i + 1].lon);
    const ang = Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
    let d = "";
    for (let s = 0; s <= 48; s++) {
      const t = s / 48;
      const wa = Math.sin((1 - t) * ang) / Math.sin(ang);
      const wb = Math.sin(t * ang) / Math.sin(ang);
      const p = norm([a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb]);
      d += `${s ? "L" : "M"}${mapX(mapLon(Math.atan2(p[0], p[2])))} ${mapY(Math.asin(p[1]))}`;
    }
    paths.push(d);
  }
  return paths;
}

export const FLAT_DOTS = buildFlatDots();
export const FLAT_ROUTE = buildFlatRoute();
export const FLAT_PINS = ROUTE.map((c) => ({ code: c.code, x: mapX(mapLon(c.lon * DEG)), y: mapY(c.lat * DEG) }));
