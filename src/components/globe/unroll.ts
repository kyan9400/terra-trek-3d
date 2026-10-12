/* ==========================================================================
   UNROLL — the globe peels open into a flat, printed route map.
   One formula, written twice (GLSL for the vertex shaders, TS for markers,
   the aircraft and picking), so both always agree.
   - Pacific-centred map, seam at lon −45° (mid-Atlantic): all five legs stay
     continuous (Queenstown → Cusco crosses the antimeridian, not the seam).
   - Local frame: +Z points at lon 135°. For progress u (0 globe … 1 map):
       lonR = wrap(lon − 135°),  k = 1 − 0.999·u,  c = mix(cos lat, 1, u)
       x = c·sin(lonR·k)/k,  z = 1 + (c·cos(lonR·k) − 1)/k,  y = mix(sin lat, lat, u)
       x, y *= mix(1, 0.62, u)
     u = 0 is the unit sphere; u = 1 a 2:1 equirectangular plane at z = 1.
   - Height above the surface becomes a small lift that shrinks toward
     `paperLift` as the map flattens.
   No three.js here; the scroll → progress helpers live in lib/unroll-progress.ts.
   ========================================================================== */

export const MAP_LON0 = 135; // map centre longitude (degrees)
export const MAP_SCALE = 0.62;
/** Map size in world units at u = 1 */
export const MAP_W = 2 * Math.PI * MAP_SCALE;
export const MAP_H = Math.PI * MAP_SCALE;

const TAU = Math.PI * 2;
const FRAME_C = Math.cos((MAP_LON0 * Math.PI) / 180);
const FRAME_S = Math.sin((MAP_LON0 * Math.PI) / 180);

export { paperProgress, swingProgress, unrollProgress } from "@/lib/unroll-progress";

/** Longitude (radians) relative to the map centre, wrapped to (−π, π]. */
export function mapLon(lonRad: number) {
  let a = lonRad - (MAP_LON0 * Math.PI) / 180;
  a -= TAU * Math.floor((a + Math.PI) / TAU);
  return a;
}

type V3 = { x: number; y: number; z: number };

/**
 * TS twin of unrollPos() in GLSL. lat, lonR in radians (lonR from mapLon), lift above the surface.
 * Writes the world position into `out` and the surface normal into `nrm`.
 */
export function unrollPoint(lat: number, lonR: number, lift: number, paperLift: number, u: number, out: V3, nrm: V3) {
  const k = 1 - 0.999 * u;
  const cl = Math.cos(lat);
  const c = cl + (1 - cl) * u;
  const s = 1 + (MAP_SCALE - 1) * u;
  const a = lonR * k;
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  let x = ((c * sa) / k) * s;
  let y = (Math.sin(lat) + (lat - Math.sin(lat)) * u) * s;
  let z = 1 + (c * ca - 1) / k;
  let nx = sa * c;
  let ny = Math.sin(lat) * (1 - u);
  let nz = ca * c;
  const nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl;
  ny /= nl;
  nz /= nl;
  const h = lift + (paperLift - lift) * u;
  x += nx * h;
  y += ny * h;
  z += nz * h;
  // local frame → world (rotation about Y by the map centre longitude)
  out.x = x * FRAME_C + z * FRAME_S;
  out.y = y;
  out.z = -x * FRAME_S + z * FRAME_C;
  nrm.x = nx * FRAME_C + nz * FRAME_S;
  nrm.y = ny;
  nrm.z = -nx * FRAME_S + nz * FRAME_C;
}

/** GLSL twin. Needs `uniform float uUnroll;` declared by the including shader. */
export const UNROLL_GLSL = /* glsl */ `
  const float UR_PI = 3.14159265;
  const float UR_C = ${FRAME_C.toFixed(8)};
  const float UR_S = ${FRAME_S.toFixed(8)};
  const float UR_LON0 = ${((MAP_LON0 * Math.PI) / 180).toFixed(8)};

  float mapLon(float lon) {
    float a = lon - UR_LON0;
    return a - 2.0 * UR_PI * floor((a + UR_PI) / (2.0 * UR_PI));
  }
  vec3 urToWorld(vec3 v) {
    return vec3(v.x * UR_C + v.z * UR_S, v.y, -v.x * UR_S + v.z * UR_C);
  }
  // lat, lonR in radians; returns the world position, writes the world normal
  vec3 unrollPos(float lat, float lonR, float lift, float paperLift, out vec3 nrm) {
    float u = uUnroll;
    float k = 1.0 - 0.999 * u;
    float c = mix(cos(lat), 1.0, u);
    float s = mix(1.0, ${MAP_SCALE.toFixed(2)}, u);
    float a = lonR * k;
    vec3 p = vec3(c * sin(a) / k * s, mix(sin(lat), lat, u) * s, 1.0 + (c * cos(a) - 1.0) / k);
    vec3 n = normalize(vec3(sin(a) * c, sin(lat) * (1.0 - u), cos(a) * c));
    p += n * mix(lift, paperLift, u);
    nrm = urToWorld(n);
    return urToWorld(p);
  }
`;
