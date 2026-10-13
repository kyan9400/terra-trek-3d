/* Projection of the land polygons, climate zones, clouds and route arcs, computed at build time.
   Used by the no-WebGL / loading poster (and, below, the flat route map). The poster globe is drawn
   in perspective from the 3D hero camera (distance 4.3 radii, looking at 20° N 16° W), so it lines up
   with the canvas it cross-fades into. */

import { ROUTE } from "@/lib/route";
import { LAND_RAW, WATER_RAW, isLand } from "@/components/globe/land";
import { CLIMATE } from "@/components/globe/climate";
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
const D = 4.3; // camera distance in globe radii (the 3D hero framing)
const K = R * Math.sqrt(D * D - 1); // so the silhouette has radius R
const HORIZON = 1 / D; // facing value of the silhouette
const center = vec(20, -16);
const east = norm(cross([0, 1, 0], center));
const north = cross(center, east);
const f1 = (n: number) => Math.round(n * 10) / 10;

/** Perspective projection of a point (on or above the unit sphere). */
const project = (p: V) => {
  const s = K / (D - dot(p, center));
  return [C + dot(p, east) * s, C - dot(p, north) * s] as const;
};
/** Surface point, pushed onto the silhouette when it is round the back (clips filled shapes to the disc). */
const projectClamped = (v: V) => {
  if (dot(v, center) >= HORIZON) return project(v);
  const e = dot(v, east);
  const n = dot(v, north);
  const l = Math.hypot(e, n) || 1;
  return [C + (e / l) * R, C - (n / l) * R] as const;
};

/** A lon/lat ring as a closed path, edges densified to ~2° so clipped runs follow the rim. */
function ringPath(pts: number[]) {
  let d = "";
  let seen = false;
  let px = 1e9;
  let py = 1e9;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const lon0 = pts[i * 2];
    const lat0 = pts[i * 2 + 1];
    const lon1 = pts[((i + 1) % n) * 2];
    const lat1 = pts[((i + 1) % n) * 2 + 1];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(lon1 - lon0), Math.abs(lat1 - lat0)) / 2));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const v = vec(lat0 + (lat1 - lat0) * t, lon0 + (lon1 - lon0) * t);
      if (dot(v, center) > HORIZON) seen = true;
      const [fx, fy] = projectClamped(v);
      const x = Math.round(fx);
      const y = Math.round(fy);
      if (Math.abs(x - px) + Math.abs(y - py) < 2) continue;
      // relative moves: shorter HTML (integer units are ~1.4 px at the largest size)
      d += d ? `l${x - px} ${y - py}` : `M${x} ${y}`;
      px = x;
      py = y;
    }
  }
  return seen ? d + "Z" : "";
}

/** An ellipse in lat/lon degrees around (lat, lon). */
function blob(lat: number, lon: number, rLat: number, rLon: number) {
  const pts: number[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    pts.push(lon + Math.cos(a) * rLon, Math.max(-89, Math.min(89, lat + Math.sin(a) * rLat)));
  }
  return ringPath(pts);
}

export const LAND = LAND_RAW.map(ringPath).join("");
export const WATER = WATER_RAW.map(ringPath).join("");

/** Climate overlays (clipped to the land in the SVG): sand deserts, deep wet forests, polar tundra and ice. */
export const DESERTS = CLIMATE.filter((c) => c[4] >= 0.4)
  .map(([la, lo, rLa, rLo, amt]) => ({ d: blob(la, lo, rLa * 1.25, rLo * 1.25), o: Math.min(1, amt * 1.25) }))
  .filter((c) => c.d);
export const FORESTS = CLIMATE.filter((c) => c[4] <= -0.4)
  .map(([la, lo, rLa, rLo, amt]) => ({ d: blob(la, lo, rLa * 1.2, rLo * 1.2), o: Math.min(1, -amt) }))
  .filter((c) => c.d);
const cap = (lat: number) => {
  const pts: number[] = [];
  for (let lon = -180; lon < 180; lon += 6) pts.push(lon, lat);
  return ringPath(pts);
};
export const TUNDRA = cap(58);
export const ICE = cap(71) + blob(73, -41, 9, 17);

/** A few soft cloud banks: [lat, lon, length°, width°, tilt°, opacity] (ITCZ, mid-latitude storm tracks). */
const CLOUDS: [number, number, number, number, number, number][] = [
  [52, -32, 16, 4, -18, 0.75],
  [47, -18, 9, 3, 24, 0.6],
  [58, -8, 11, 3, -10, 0.55],
  [41, -50, 12, 3.5, 30, 0.55],
  [6, -30, 14, 2.5, 4, 0.5],
  [4, -6, 8, 2.5, -6, 0.45],
  [8, 14, 12, 3, 6, 0.4],
  [-4, -38, 7, 2.5, -12, 0.4],
  [-30, -20, 16, 4, -24, 0.55],
  [-38, 2, 12, 3, 18, 0.5],
  [30, -62, 8, 3, -30, 0.45],
  [64, -38, 10, 3, 8, 0.5],
];
export const CLOUD_ELLIPSES = CLOUDS.map(([la, lo, len, wid, tilt, o]) => {
  const v = vec(la, lo);
  const f = dot(v, center);
  if (f < HORIZON + 0.08) return null;
  const [x, y] = project(v);
  // local east/north on screen give the foreshortening and the heading
  const [ex, ey] = project(vec(la, lo + 1));
  const [nx, ny] = project(vec(la + 1, lo));
  const ang = (Math.atan2(ey - y, ex - x) * 180) / Math.PI - tilt;
  const sx = Math.hypot(ex - x, ey - y);
  const sy = Math.hypot(nx - x, ny - y);
  const rad = (ang * Math.PI) / 180;
  // three puffs along the bank: a big core and two smaller tails
  return [
    [0, 1, 1],
    [-0.62, 0.55, 0.8],
    [0.58, 0.6, 0.75],
  ].map(([k, sc, oo]) => {
    const dx = Math.cos(rad) * k * len * sx;
    const dy = Math.sin(rad) * k * len * sx;
    return { x: f1(x + dx), y: f1(y + dy + (k ? wid * sy * 0.3 : 0)), rx: f1(len * sx * sc), ry: f1(wid * sy * (k ? 0.9 : 1.2)), a: f1(ang), o: Math.round(o * oo * 100) / 100 };
  });
}).filter((c): c is NonNullable<typeof c> => c !== null).flat();

/* Night side for the hero sun (the 3D look: sun from the right and a little above, terminator on the left).
   The night is "the disc minus the region lit above a level" (even-odd fill), blurred in the SVG into a
   soft twilight band. Shading is orthographic, close enough at this size. */
const SUN = norm([0.8, 0.35, 0.55]); // screen space: x right, y up, z toward the viewer
const U = norm(cross(SUN, [0, 0, 1]));
const W = cross(SUN, U);
const DISC = `M${C - R} ${C}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0Z`;
function nightPath(level: number) {
  const r = Math.sqrt(1 - level * level);
  let d = "";
  for (let i = 0; i < 96; i++) {
    const t = (i / 96) * Math.PI * 2;
    const n: V = [
      SUN[0] * level + r * (Math.cos(t) * U[0] + Math.sin(t) * W[0]),
      SUN[1] * level + r * (Math.cos(t) * U[1] + Math.sin(t) * W[1]),
      SUN[2] * level + r * (Math.cos(t) * U[2] + Math.sin(t) * W[2]),
    ];
    let x = n[0];
    let y = n[1];
    if (n[2] < 0) {
      const l = Math.hypot(x, y) || 1;
      x /= l;
      y /= l;
    }
    d += `${d ? "L" : "M"}${f1(C + x * R)} ${f1(C - y * R)}`;
  }
  return DISC + d + "Z";
}
export const NIGHT = [nightPath(0.34), nightPath(0.1)];

/** Hidden when the sphere is between the camera and the point. */
const CAM: V = [center[0] * D, center[1] * D, center[2] * D];
function occluded(p: V) {
  const dir: V = [p[0] - CAM[0], p[1] - CAM[1], p[2] - CAM[2]];
  const a = dot(dir, dir);
  const b = 2 * dot(CAM, dir);
  const c = dot(CAM, CAM) - 1;
  const disc = b * b - 4 * a * c;
  if (disc <= 0) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t > 0 && t < 0.999;
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
      if (occluded(p)) {
        pen = false;
        continue;
      }
      const [x, y] = project(p);
      d += `${pen ? "L" : "M"}${f1(x)} ${f1(y)}`;
      pen = true;
    }
    if (d) paths.push(d);
  }
  return paths;
}

export const ARCS = buildArcs();
export const PINS = ROUTE.map((c) => ({ ...c, v: vec(c.lat, c.lon) }))
  .filter((c) => dot(c.v, center) > HORIZON + 0.08)
  .map((c) => ({ code: c.code, xy: project(c.v).map(f1) }));


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
