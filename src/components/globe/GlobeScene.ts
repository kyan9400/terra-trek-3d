/* ==========================================================================
   GLOBE SCENE — everything on the canvas, built in code.
     ocean      sphere + shader: night/day, twilight band, graticule, glitter
                sun path (value noise, high/medium), fresnel sky reflection
     land       instanced quads drawn as round SDF dots on a Fibonacci sphere,
                kept where land.ts says "land"; terrain relief, snow, metro
                city lights, focus glow
     arcs       camera-facing ribbons along lifted great-circle paths that draw
                themselves from 0..1 with a bright head and a short contrail
     markers    six shader quads (dot, ring, pulse) + instanced light pillars
     aircraft   a tiny chevron (medium/high) over a glow point
     atmosphere back-face halo + a thin front-face scattering shell
     stars      Points with a faint Milky Way band and optional twinkle
   Signature moment: past the outro the globe UNROLLS into a flat, printed
   route map (unroll.ts), every vertex shader shares the same formula.
   The class owns its objects; React adds `root` and calls update() once per
   rendered frame. update() allocates nothing.
   ========================================================================== */

import * as THREE from "three";
import { ROUTE } from "@/lib/route";
import type { TierSettings } from "@/lib/quality";
import { stage } from "@/lib/stage";
import { isLand } from "./land";
import { cityLight, terrainHeight, terrainSlope } from "./terrain";
import { MAP_H, MAP_LON0, MAP_W, UNROLL_GLSL, mapLon, paperProgress, swingProgress, unrollPoint, unrollProgress } from "./unroll";

const EMBER = new THREE.Color("#ff9f43");
const SAND = new THREE.Color("#f2e9da");
const GLACIER = new THREE.Color("#7cc6d9");
const DEEP_RED = new THREE.Color("#8a2b1a");
// Paper colours are written as-is (no colour conversion) so the 3D map matches the CSS paper exactly
const raw = (hex: number) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);
const SAND_2 = raw(0xe6dac4);
const INK = raw(0x1a1712);
const RUST = raw(0xa33b14);
const DEG = Math.PI / 180;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2));
const wrapPi = (a: number) => a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));

/** lat/lon (degrees) → unit vector. lon 0 faces +Z, east is +X, north is +Y. */
export function latLonToVec(lat: number, lon: number, out = new THREE.Vector3()) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return out.set(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}

/** Spherical interpolation between two unit vectors (great-circle path). */
function slerpUnit(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
  const d = clamp(a.dot(b), -1, 1);
  const ang = Math.acos(d);
  if (ang < 1e-4) return out.copy(a);
  const s = Math.sin(ang);
  const wa = Math.sin((1 - t) * ang) / s;
  const wb = Math.sin(t * ang) / s;
  return out.set(a.x * wa + b.x * wb, a.y * wa + b.y * wb, a.z * wa + b.z * wb);
}

/* ---------------------------------------------------------------- shaders */

const NOISE_GLSL = /* glsl */ `
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  vec3 vnoise3(vec3 x) {
    return vec3(vnoise(x), vnoise(x + 17.1), vnoise(x + 31.7)) - 0.5;
  }
`;

const OCEAN_VERT = /* glsl */ `
  uniform float uUnroll;
  ${UNROLL_GLSL}
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vP;
  varying vec2 vLL;
  varying vec2 vUv;
  void main() {
    // a plain uv grid: u spans the map from the seam (lon -45) eastwards, v from pole to pole
    float lat = (uv.y - 0.5) * UR_PI;
    float lonR = (uv.x - 0.5) * 2.0 * UR_PI;
    float lon = lonR + UR_LON0;
    vec3 nrm;
    vec3 p = unrollPos(lat, lonR, 0.0, 0.0, nrm);
    vec4 w = modelMatrix * vec4(p, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * nrm);
    vP = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)); // sphere point, for the glitter noise
    vLL = vec2(degrees(lat), degrees(lon));
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const OCEAN_FRAG = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uGlacier;
  uniform vec3 uEmber;
  uniform vec3 uDeep;
  uniform vec3 uSand2;
  uniform vec3 uInk;
  uniform float uTime;
  uniform float uPaper;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vP;
  varying vec2 vLL;
  varying vec2 vUv;
  ${NOISE_GLSL}

  float gridLine(float coord, float stepDeg) {
    float x = coord / stepDeg;
    float f = abs(fract(x - 0.5) - 0.5);
    float w = fwidth(x);
    return 1.0 - smoothstep(0.0, w * 1.2, f);
  }

  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(cameraPosition - vW);
    float ndl = dot(n, uSun);
    float day = smoothstep(-0.22, 0.5, ndl);

    vec3 night = vec3(0.022, 0.04, 0.075);
    vec3 dayc  = vec3(0.05, 0.13, 0.21);
    vec3 col = mix(night, dayc, day);

    // graticule every 15 degrees, a touch stronger at the equator
    float lat = vLL.x;
    float lon = vLL.y;
    float g = max(gridLine(lat, 15.0), gridLine(lon, 15.0));
    float eq = 1.0 - smoothstep(0.0, fwidth(lat) * 1.5, abs(lat));
    col += uGlacier * (g * 0.045 + eq * 0.05) * (0.4 + 0.6 * day);

    // sun glint, broken into a glitter path by noise-perturbed normals
    vec3 ns = n;
    #if OCEAN_OCT > 0
      ns = normalize(ns + vnoise3(vP * 38.0 + vec3(0.0, uTime * 0.12, 0.0)) * 0.36);
    #endif
    #if OCEAN_OCT > 1
      ns = normalize(ns + vnoise3(vP * 115.0 - vec3(uTime * 0.2, 0.0, 0.0)) * 0.24);
    #endif
    vec3 h = normalize(uSun + v);
    float glint = pow(max(dot(ns, h), 0.0), 90.0) * day;
    float sheen = pow(max(dot(n, h), 0.0), 16.0) * day;
    col += mix(uEmber, vec3(1.0, 0.93, 0.8), 0.5) * (glint * 0.5 + sheen * 0.06);

    // warm twilight band along the terminator
    float tw = exp(-pow(ndl / 0.12, 2.0));
    col += mix(uEmber, uDeep, 0.6) * tw * 0.07;

    // fresnel: sky reflection (night blue → glacier) and the rim
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    col += mix(vec3(0.03, 0.07, 0.15), uGlacier * 0.5, day) * fres * 0.45;
    col += mix(uGlacier, uEmber, 0.25 * day) * fres * (0.12 + 0.3 * day);

    // printed map: sand paper, ink graticule and a thin frame
    vec2 e = min(vUv, 1.0 - vUv) / max(fwidth(vUv), vec2(1e-6));
    float frame = 1.0 - smoothstep(0.0, 1.5, min(e.x, e.y));
    vec3 paper = mix(uSand2, uInk, clamp(g * 0.25 + eq * 0.12 + frame * 0.6, 0.0, 1.0));
    col = mix(col, paper, uPaper);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const DOT_VERT = /* glsl */ `
  attribute vec4 aGeo;   // lat, lon (radians), random, terrain height
  attribute vec3 aExtra; // uphill east, uphill north, city light
  uniform float uUnroll;
  uniform float uSize;
  ${UNROLL_GLSL}
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vEast;
  varying vec3 vNorth;
  varying vec4 vGeo;
  varying vec3 vExtra;
  void main() {
    float lat = aGeo.x;
    float lonR = mapLon(aGeo.y);
    float lift = 0.0015 + aGeo.w * 0.012;
    vec3 n;
    vec3 tmp;
    vec3 c = unrollPos(lat, lonR, lift, 0.002, n);
    // local east / north from tiny steps, so the dot stays flat on the surface while it unrolls
    vec3 e = normalize(unrollPos(lat, lonR + 0.01, lift, 0.002, tmp) - c);
    vec3 no = unrollPos(lat + 0.01, lonR, lift, 0.002, tmp) - c;
    no = normalize(no - dot(no, e) * e);
    float size = uSize * (0.75 + aGeo.z * 0.45) * (1.0 + 0.15 * aGeo.w);
    vec4 w = modelMatrix * vec4(c + (e * position.x + no * position.y) * size, 1.0);
    vUv = position.xy;
    vN = normalize(mat3(modelMatrix) * n);
    vW = w.xyz;
    vEast = e;
    vNorth = no;
    vGeo = aGeo;
    vExtra = aExtra;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const DOT_FRAG = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uFocus;
  uniform float uFocusAmt;
  uniform float uLights;
  uniform float uIntro;
  uniform float uTime;
  uniform float uPaper;
  uniform vec3 uSand;
  uniform vec3 uEmber;
  uniform vec3 uDeep;
  uniform vec3 uInk;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vEast;
  varying vec3 vNorth;
  varying vec4 vGeo;
  varying vec3 vExtra;
  void main() {
    // round SDF disc: alpha-to-coverage edge with MSAA, a hard discard without
    float d = length(vUv);
    #ifdef DOT_A2C
      float alpha = 1.0 - smoothstep(1.0 - fwidth(d) * 1.2, 1.0, d);
      if (alpha <= 0.0) discard;
    #else
      if (d > 1.0) discard;
      float alpha = 1.0;
    #endif

    float rnd = vGeo.z;
    float height = vGeo.w;
    vec3 n = normalize(vN);
    float ndl = dot(n, uSun);
    float day = smoothstep(-0.18, 0.4, ndl);
    vec3 dayCol = mix(vec3(0.55, 0.66, 0.76), uSand, 0.35 + rnd * 0.5);
    vec3 nightCol = vec3(0.13, 0.19, 0.29) + rnd * 0.04;
    vec3 col = mix(nightCol, dayCol, day);

    // relief: slopes that face away from the sun darken, sunny ones brighten a little
    vec2 sunEN = vec2(dot(uSun, vEast), dot(uSun, vNorth));
    float rel = dot(vExtra.xy, sunEN);
    col *= clamp(1.0 - rel * 0.6, 0.5, 1.3);
    // snow on the high ground, day side only
    col = mix(col, vec3(0.93, 0.95, 0.98), smoothstep(0.7, 0.95, height) * day * 0.85);

    // warm twilight band
    float tw = exp(-pow(ndl / 0.12, 2.0));
    col += mix(uEmber, uDeep, 0.5) * tw * 0.16;

    // metro lights on the night side; during the intro they switch on in a west → east wave
    float lonN = vGeo.y / 6.2831853 + 0.5;
    float front = mix(-0.1, 1.15, smoothstep(0.2, 0.85, uIntro)) - rnd * 0.05;
    float on = smoothstep(lonN, lonN + 0.06, front);
    float light = vExtra.z * (1.0 - day) * uLights * on;
    #ifdef FLICKER
      light *= 0.88 + 0.12 * sin(uTime * (2.0 + rnd * 3.0) + rnd * 60.0);
    #endif
    col = mix(col, uEmber * (0.9 + rnd * 0.5), clamp(light * 1.4, 0.0, 1.0));

    // land around the focused city glows
    float f = (1.0 - smoothstep(0.0, 0.32, distance(n, uFocus))) * uFocusAmt;
    col += uEmber * f * 0.5;

    // sink into the ocean rim near the limb (no alpha needed)
    float facing = dot(n, normalize(cameraPosition - vW));
    col *= smoothstep(-0.05, 0.35, facing);

    // printed map: ink dots
    col = mix(col, uInk, uPaper);
    gl_FragColor = vec4(col, alpha);
  }
`;

const ARC_VERT = /* glsl */ `
  attribute vec3 aA;   // start (unit vector)
  attribute vec3 aB;   // end (unit vector)
  attribute vec2 aArc; // lift, reference map longitude (keeps the line continuous)
  uniform float uUnroll;
  uniform float uRadius;
  ${UNROLL_GLSL}
  varying float vS;
  varying float vSide;
  vec3 arcPos(float t) {
    float ang = acos(clamp(dot(aA, aB), -1.0, 1.0));
    vec3 dir = normalize((sin((1.0 - t) * ang) * aA + sin(t * ang) * aB) / max(sin(ang), 1e-4));
    float lat = asin(clamp(dir.y, -1.0, 1.0));
    float d = mapLon(atan(dir.x, dir.z)) - aArc.y;
    float lonR = aArc.y + d - 2.0 * UR_PI * floor((d + UR_PI) / (2.0 * UR_PI));
    vec3 n;
    return unrollPos(lat, lonR, 0.004 + aArc.x * sin(UR_PI * t), 0.004, n);
  }
  void main() {
    float t = position.x;
    float side = position.y;
    vec3 c = arcPos(t);
    vec3 tg = arcPos(min(t + 0.004, 1.0)) - arcPos(max(t - 0.004, 0.0));
    vec3 view = cameraPosition - c;
    vec3 off = normalize(cross(tg, view));
    vS = t;
    vSide = side;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(c + off * side * uRadius, 1.0);
  }
`;

const ARC_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uPaperColor;
  uniform float uDraw;
  uniform float uGhost;
  uniform float uGhostDraw;
  uniform float uTime;
  uniform float uFlow;
  uniform float uIntensity;
  uniform float uTrail;
  uniform float uPaper;
  varying float vS;
  varying float vSide;
  void main() {
    float s = vS;
    float drawn = step(s, uDraw);
    float core = pow(max(1.0 - vSide * vSide, 0.0), 0.8);
    float dash = mix(1.0, 0.55 + 0.45 * sin(s * 90.0 - uTime * 4.0), uFlow);
    float live = step(0.002, uDraw) * step(uDraw, 0.998);
    float head = (1.0 - smoothstep(0.0, 0.05, abs(s - uDraw))) * live;
    float trail = smoothstep(uDraw - 0.06, uDraw, s) * drawn * live * uTrail; // short contrail behind the head
    float ends = smoothstep(0.0, 0.025, s) * smoothstep(1.0, 0.975, s);
    float ghost = (1.0 - drawn) * uGhost * step(0.55, fract(s * 70.0)) * step(s, uGhostDraw);
    float a = (drawn * dash * 0.85 + head * 1.6 + trail * 0.8 + ghost) * core * ends * uIntensity;
    vec3 col = mix(uColor, vec3(1.0, 0.94, 0.82), head * 0.8);
    // printed map: a solid rust line with soft edges
    float pa = drawn * (1.0 - smoothstep(0.55, 1.0, abs(vSide))) * ends;
    col = mix(col, uPaperColor, uPaper);
    a = clamp(mix(a, pa, uPaper), 0.0, 1.0);
    gl_FragColor = vec4(col * a, a); // premultiplied "over"
  }
`;

const MARKER_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MARKER_FRAG = /* glsl */ `
  uniform float uActive;
  uniform float uTime;
  uniform float uPulse;
  uniform float uPhase;
  uniform float uPaper;
  uniform vec3 uSand;
  uniform vec3 uEmber;
  uniform vec3 uRust;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.09, 0.14, d);
    float ring = 1.0 - smoothstep(0.0, 0.035, abs(d - 0.32));
    float pr = fract(uTime * 0.45 + uPhase);
    float pulse = (1.0 - smoothstep(0.0, 0.05, abs(d - mix(0.2, 0.95, pr)))) * (1.0 - pr) * uPulse;
    float a = core * (0.8 + 0.4 * uActive) + ring * (0.35 + 0.65 * uActive) + pulse * (0.25 + 0.75 * uActive);
    vec3 col = mix(uSand, uEmber, 0.25 + 0.75 * uActive);
    // printed map: rust rings
    float pa = core + (1.0 - smoothstep(0.0, 0.06, abs(d - 0.34)));
    col = mix(col, uRust, uPaper);
    a = clamp(mix(a, pa, uPaper), 0.0, 1.0);
    gl_FragColor = vec4(col * a, a);
  }
`;

const PILLAR_VERT = /* glsl */ `
  uniform vec3 uBase[6];
  uniform vec3 uNrm[6];
  uniform float uHeight[6];
  uniform float uGlow[6];
  uniform float uWidth;
  varying vec2 vUv;
  varying float vGlow;
  void main() {
    int i = gl_InstanceID;
    vec3 b = uBase[i];
    vec3 n = uNrm[i];
    vec3 view = normalize(cameraPosition - b);
    // cylindrical billboard around the surface normal
    vec3 side = cross(n, view);
    float l = length(side);
    side = l > 1e-4 ? side / l : vec3(0.0);
    vUv = position.xy;
    vGlow = uGlow[i] * clamp(l * 1.6, 0.0, 1.0); // fades when seen from straight above
    gl_Position = projectionMatrix * viewMatrix * vec4(b + n * position.y * uHeight[i] + side * position.x * uWidth, 1.0);
  }
`;

const PILLAR_FRAG = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vGlow;
  void main() {
    float across = 1.0 - abs(vUv.x);
    float a = across * across * pow(1.0 - vUv.y, 1.6) * vGlow;
    vec3 col = mix(uColor, vec3(1.0, 0.95, 0.85), across * across * 0.5);
    gl_FragColor = vec4(col * a, 1.0);
  }
`;

const POINT_VERT = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio / -mv.z;
  }
`;

const POINT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = pow(1.0 - smoothstep(0.0, 0.5, d), 2.0);
    float core = 1.0 - smoothstep(0.05, 0.12, d);
    vec3 col = mix(uColor, vec3(1.0, 0.96, 0.88), core);
    gl_FragColor = vec4(col * (glow + core) * uAlpha, 1.0);
  }
`;

const PLANE_VERT = /* glsl */ `
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PLANE_FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

const ATMO_VERT = /* glsl */ `
  varying vec3 vNV;
  varying vec3 vPV;
  varying vec3 vNW;
  varying vec3 vW;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vPV = mv.xyz;
    vNV = normalize(normalMatrix * normal);
    vNW = normalize(mat3(modelMatrix) * normal);
    vW = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMO_FRAG = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uGlacier;
  uniform vec3 uEmber;
  uniform vec3 uDeep;
  uniform float uFade;
  varying vec3 vNV;
  varying vec3 vPV;
  varying vec3 vNW;
  varying vec3 vW;
  void main() {
    float d = dot(normalize(vNV), normalize(-vPV)); // back faces: 0 at the outer edge, about -0.5 at the globe's limb
    float halo = pow(smoothstep(0.0, 0.52, -d), 2.4);
    float ndl = dot(normalize(vNW), uSun);
    float sunSide = smoothstep(-0.4, 0.8, ndl);
    float tw = exp(-pow(ndl / 0.2, 2.0)); // warm where the terminator meets the limb
    float fwd = pow(max(dot(uSun, -normalize(cameraPosition)), 0.0), 4.0); // sun just behind the globe
    vec3 col = mix(uGlacier * 0.55, mix(uGlacier, uEmber, 0.35), sunSide) + mix(uEmber, uDeep, 0.4) * tw * 0.55;
    gl_FragColor = vec4(col * halo * (0.35 + 0.65 * sunSide + fwd * 1.5) * uFade, 1.0);
  }
`;

const SHELL_FRAG = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uGlacier;
  uniform vec3 uEmber;
  uniform vec3 uDeep;
  uniform float uFade;
  varying vec3 vNW;
  varying vec3 vW;
  void main() {
    vec3 n = normalize(vNW);
    vec3 v = normalize(cameraPosition - vW);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.5); // near zero at the centre
    float ndl = dot(n, uSun);
    float day = smoothstep(-0.1, 0.6, ndl);
    float tw = exp(-pow(ndl / 0.16, 2.0));
    vec3 col = uGlacier * 0.5 * day + mix(uEmber, uDeep, 0.45) * tw * 0.85;
    gl_FragColor = vec4(col * rim * uFade, 1.0);
  }
`;

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aRand;
  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uTwinkle;
  uniform float uFade;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio;
    vA = 0.35 + 0.65 * aRand;
    vA *= mix(1.0, 0.55 + 0.45 * sin(uTime * (0.6 + aRand * 1.8) + aRand * 40.0), uTwinkle) * uFade;
  }
`;

const STAR_FRAG = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = 1.0 - smoothstep(0.15, 0.5, d);
    gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * a * vA, 1.0);
  }
`;

/* ------------------------------------------------------------------ scene */

type Leg = {
  a: THREE.Vector3;
  b: THREE.Vector3;
  angle: number;
  lift: number;
  lonRef: number;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
};

/** Glows add light but leave the canvas alpha alone, so they never paint dark pixels over the paper. */
const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const;

/** Premultiplied "over": additive-looking glow on the night, a proper ink line on the paper. */
const over = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
} as const;

/** Opaque draw that leaves the destination alpha alone (used with alpha-to-coverage). */
const keepAlpha = {
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.ZeroFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const;

/** Give the browser a chance to handle input / paint between heavy steps. */
export function yieldToMain(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

type LandData = { geo: Float32Array; extra: Float32Array; count: number };

/**
 * Fibonacci samples on the unit sphere that fall on land, with terrain height, slope and
 * city light per dot. Computed in slices (the land test is the costliest CPU step of the
 * build), yielding between them. Returns null if `alive()` turns false part-way.
 */
async function landData(n: number, lights: boolean, alive: () => boolean): Promise<LandData | null> {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const geo = new Float32Array(n * 4);
  const extra = new Float32Array(n * 3);
  const slope: [number, number] = [0, 0];
  let k = 0;
  const SLICE = 5000;
  for (let start = 0; start < n; start += SLICE) {
    if (start > 0) {
      await yieldToMain();
      if (!alive()) return null;
    }
    const end = Math.min(n, start + SLICE);
    for (let i = start; i < end; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const x = Math.cos(th) * r;
      const z = Math.sin(th) * r;
      const lat = Math.asin(y) / DEG;
      const lon = Math.atan2(x, z) / DEG;
      if (!isLand(lon, lat)) continue;
      const h = terrainHeight(lat, lon);
      if (h > 0) terrainSlope(lat, lon, slope);
      else slope[0] = slope[1] = 0;
      geo[k * 4] = lat * DEG;
      geo[k * 4 + 1] = lon * DEG;
      geo[k * 4 + 2] = Math.random();
      geo[k * 4 + 3] = h;
      extra[k * 3] = slope[0];
      extra[k * 3 + 1] = slope[1];
      extra[k * 3 + 2] = lights ? cityLight(x, y, z) : 0;
      k++;
    }
  }
  return { geo: geo.subarray(0, k * 4), extra: extra.subarray(0, k * 3), count: k };
}

/** A 6-point plane silhouette, extruded a little: about 20 triangles. */
function planeGeometry() {
  const pts: [number, number][] = [
    [0, 1], [0.9, -0.35], [0.16, -0.28], [0, -0.75], [-0.16, -0.28], [-0.9, -0.35],
  ];
  const hz = 0.12;
  const pos: number[] = [];
  const col: number[] = [];
  const top = [0.95, 0.91, 0.85];
  const belly = [0.85, 0.45, 0.15];
  const push = (p: [number, number], z: number, c: number[]) => {
    pos.push(p[0], p[1], z);
    col.push(c[0], c[1], c[2]);
  };
  // fan from the nose (the outline is star-shaped from it)
  for (let i = 1; i < pts.length - 1; i++) {
    push(pts[0], hz, top);
    push(pts[i], hz, top);
    push(pts[i + 1], hz, top);
    push(pts[0], -hz, belly);
    push(pts[i + 1], -hz, belly);
    push(pts[i], -hz, belly);
  }
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    push(a, hz, belly);
    push(b, hz, belly);
    push(b, -hz, belly);
    push(a, hz, belly);
    push(b, -hz, belly);
    push(a, -hz, belly);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Map centre in world space (the flat map lies in the plane through it, facing outwards). */
const MAP_DIR = latLonToVec(0, MAP_LON0);
const INTRO_SECONDS = 1.8;

export class GlobeScene {
  /** Builds the scene in slices so no single task blocks the main thread for long. */
  static async create(settings: TierSettings, alive: () => boolean): Promise<GlobeScene | null> {
    await yieldToMain();
    if (!alive()) return null;
    const land = await landData(settings.landSamples, settings.cityLights, alive);
    if (!land) return null;
    await yieldToMain();
    if (!alive()) return null;
    return new GlobeScene(settings, land);
  }

  readonly root = new THREE.Group();
  private readonly settings: TierSettings;
  private readonly disposables: { dispose: () => void }[] = [];

  private readonly cityDirs: THREE.Vector3[];
  private readonly cityLat: number[];
  private readonly cityLonR: number[];
  private readonly legs: Leg[] = [];
  private readonly markers: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = [];
  private readonly markerNrm: THREE.Vector3[] = [];
  /** Marker lift: always above the (terrain-lifted) land dots, so Cusco / Queenstown rings are not buried */
  private readonly markerLift: number[];
  private ambient: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;

  private readonly oceanMat: THREE.ShaderMaterial;
  private readonly dotMat: THREE.ShaderMaterial;
  private readonly arcMats: THREE.ShaderMaterial[] = [];
  private readonly atmo: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly shell: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly stars: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly glow: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly aircraft: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> | null = null;
  private readonly pillars: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial> | null = null;
  private readonly unrollUniform = { value: 0 };

  // scratch objects (reused every frame)
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly v3 = new THREE.Vector3();
  private readonly n1 = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly heroDir = new THREE.Vector3();
  private readonly outroDir = latLonToVec(4, -38);
  private readonly target = new THREE.Vector3();
  private readonly sun = new THREE.Vector3();
  private readonly proj = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();

  private motionTime = 0;
  private intro = 0;
  private introOn = false;
  private lastU = -1;
  private view = { w: 0, h: 0, fov: 0, ox: 0, oy: 0 };
  private camera: THREE.PerspectiveCamera | null = null;

  private constructor(settings: TierSettings, land: LandData) {
    this.settings = settings;
    this.cityDirs = ROUTE.map((c) => latLonToVec(c.lat, c.lon));
    this.cityLat = ROUTE.map((c) => c.lat * DEG);
    this.cityLonR = ROUTE.map((c) => mapLon(c.lon * DEG));
    this.markerLift = ROUTE.map((c) => 0.006 + terrainHeight(c.lat, c.lon) * 0.012);

    const sharedSun = { value: this.sun };
    const uUnroll = this.unrollUniform;

    /* ocean: a uv grid wrapped into a sphere by the shader (seam at lon −45°, so the map opens in the Atlantic) */
    this.oceanMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: OCEAN_VERT,
        fragmentShader: OCEAN_FRAG,
        defines: { OCEAN_OCT: settings.oceanNoise },
        uniforms: {
          uUnroll,
          uSun: sharedSun,
          uGlacier: { value: GLACIER },
          uEmber: { value: EMBER },
          uDeep: { value: DEEP_RED },
          uSand2: { value: SAND_2 },
          uInk: { value: INK },
          uTime: { value: 0 },
          uPaper: { value: 0 },
        },
        side: THREE.DoubleSide, // the inside shows while the sphere opens
      }),
    );
    const [sw, sh] = settings.oceanSeg;
    const ocean = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1, 1, sw, sh)), this.oceanMat);
    ocean.frustumCulled = false;
    this.root.add(ocean);

    /* land dots */
    const dotDefines: Record<string, string> = {};
    if (settings.antialias) dotDefines.DOT_A2C = "";
    if (settings.flicker) dotDefines.FLICKER = "";
    this.dotMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: DOT_VERT,
        fragmentShader: DOT_FRAG,
        defines: dotDefines,
        alphaToCoverage: settings.antialias,
        // A2C writes the soft edge alpha into the canvas; keep the ocean's alpha (1) so edges never show the page through
        ...(settings.antialias ? keepAlpha : {}),
        uniforms: {
          uUnroll,
          uSize: { value: Math.sqrt((4 * Math.PI) / settings.landSamples) * 0.36 },
          uSun: sharedSun,
          uFocus: { value: new THREE.Vector3(0, 0, 1) },
          uFocusAmt: { value: 0 },
          uLights: { value: settings.cityLights ? 1 : 0 },
          uIntro: { value: 0 },
          uTime: { value: 0 },
          uPaper: { value: 0 },
          uSand: { value: SAND },
          uEmber: { value: EMBER },
          uDeep: { value: DEEP_RED },
          uInk: { value: INK },
        },
      }),
    );
    this.root.add(this.buildLand(land));

    /* atmosphere: back-face halo + thin front-face scattering shell */
    const atmoUniforms = () => ({
      uSun: sharedSun,
      uGlacier: { value: GLACIER },
      uEmber: { value: EMBER },
      uDeep: { value: DEEP_RED },
      uFade: { value: 1 },
    });
    // segment counts keep the high tier within ~80k triangles (dots + ocean are ~71k of it)
    this.atmo = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(1.17, 64, 32)),
      this.track(
        new THREE.ShaderMaterial({
          vertexShader: ATMO_VERT,
          fragmentShader: ATMO_FRAG,
          uniforms: atmoUniforms(),
          side: THREE.BackSide,
          ...additive,
        }),
      ),
    );
    this.root.add(this.atmo);
    this.shell = new THREE.Mesh(
      this.track(new THREE.SphereGeometry(1.012, 40, 28)),
      this.track(
        new THREE.ShaderMaterial({ vertexShader: ATMO_VERT, fragmentShader: SHELL_FRAG, uniforms: atmoUniforms(), ...additive }),
      ),
    );
    this.shell.renderOrder = 1;
    this.root.add(this.shell);

    /* route arcs, one ribbon per leg */
    for (let i = 0; i < this.cityDirs.length - 1; i++) {
      const a = this.cityDirs[i];
      const b = this.cityDirs[i + 1];
      const angle = Math.acos(clamp(a.dot(b), -1, 1));
      const lift = 0.05 + 0.26 * (angle / Math.PI);
      const lonRef = this.midLon(a, b);
      const mat = this.arcMaterial(EMBER, 0.0042, 1);
      const mesh = new THREE.Mesh(this.track(this.ribbon([{ a, b, lift, lonRef }], 140)), mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      this.root.add(mesh);
      this.legs.push({ a, b, angle, lift, lonRef, mesh });
    }

    /* ambient network arcs from the Lisbon office (faint, glacier blue), merged into one draw */
    if (settings.ambientArcs) {
      const hub = latLonToVec(38.72, -9.14);
      const others: [number, number][] = [
        [40.71, -74.0], [-1.29, 36.82], [28.61, 77.2], [-34.6, -58.38], [1.35, 103.82],
        [55.75, 37.62], [19.43, -99.13], [-22.9, -43.2], [64.15, -21.94], [35.01, 135.77],
      ];
      const list = others.map(([lat, lon]) => {
        const b = latLonToVec(lat, lon);
        const angle = Math.acos(clamp(hub.dot(b), -1, 1));
        return { a: hub, b, lift: 0.05 + 0.26 * (angle / Math.PI), lonRef: this.midLon(hub, b) };
      });
      const mat = this.arcMaterial(GLACIER, 0.0022, 0.5);
      mat.uniforms.uDraw.value = 1;
      mat.uniforms.uTrail.value = 0;
      this.ambient = new THREE.Mesh(this.track(this.ribbon(list, 64)), mat);
      this.ambient.frustumCulled = false;
      this.ambient.renderOrder = 2;
      this.root.add(this.ambient);
    }

    /* markers */
    const markerGeo = this.track(new THREE.PlaneGeometry(0.085, 0.085));
    this.cityDirs.forEach((d, i) => {
      const mat = this.track(
        new THREE.ShaderMaterial({
          vertexShader: MARKER_VERT,
          fragmentShader: MARKER_FRAG,
          uniforms: {
            uActive: { value: 0 },
            uTime: { value: 0 },
            uPulse: { value: 1 },
            uPhase: { value: i * 0.17 },
            uPaper: { value: 0 },
            uSand: { value: SAND },
            uEmber: { value: EMBER },
            uRust: { value: RUST },
          },
          ...over,
        }),
      );
      const m = new THREE.Mesh(markerGeo, mat);
      m.renderOrder = 3;
      this.markers.push(m);
      this.markerNrm.push(d.clone());
      this.root.add(m);
    });
    this.placeMarkers(0);

    /* light pillars above the markers: one instanced draw */
    if (settings.pillars) {
      const base = new THREE.PlaneGeometry(2, 1).translate(0, 0.5, 0);
      const geo = this.track(new THREE.InstancedBufferGeometry());
      geo.index = base.index;
      geo.setAttribute("position", base.getAttribute("position"));
      geo.instanceCount = this.cityDirs.length;
      base.dispose();
      const mat = this.track(
        new THREE.ShaderMaterial({
          vertexShader: PILLAR_VERT,
          fragmentShader: PILLAR_FRAG,
          uniforms: {
            uBase: { value: this.markers.map((m) => m.position) },
            uNrm: { value: this.markerNrm },
            uHeight: { value: this.cityDirs.map(() => 0.06) },
            uGlow: { value: this.cityDirs.map(() => 0) },
            uWidth: { value: 0.006 },
            uColor: { value: EMBER },
          },
          ...additive,
        }),
      );
      this.pillars = new THREE.Mesh(geo, mat);
      this.pillars.frustumCulled = false;
      this.pillars.renderOrder = 3;
      this.root.add(this.pillars);
    }

    /* the aircraft: a glow point, plus a tiny chevron on medium / high */
    const glowGeo = this.track(new THREE.BufferGeometry());
    glowGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const glowMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: POINT_VERT,
        fragmentShader: POINT_FRAG,
        uniforms: { uSize: { value: 70 }, uPixelRatio: { value: 1 }, uColor: { value: EMBER }, uAlpha: { value: 1 } },
        ...additive,
      }),
    );
    this.glow = new THREE.Points(glowGeo, glowMat);
    this.glow.frustumCulled = false;
    this.glow.renderOrder = 4;
    this.glow.visible = false;
    this.root.add(this.glow);

    if (settings.aircraftMesh) {
      const mat = this.track(
        new THREE.ShaderMaterial({ vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG, side: THREE.DoubleSide }),
      );
      this.aircraft = new THREE.Mesh(this.track(planeGeometry()), mat);
      this.aircraft.matrixAutoUpdate = false;
      this.aircraft.frustumCulled = false;
      this.aircraft.renderOrder = 5;
      this.aircraft.visible = false;
      this.root.add(this.aircraft);
    }

    /* stars */
    this.stars = this.buildStars(settings.stars);
    this.root.add(this.stars);
  }

  private track<T extends { dispose: () => void }>(obj: T): T {
    this.disposables.push(obj);
    return obj;
  }

  /** Map longitude of the great-circle midpoint: the reference that keeps a ribbon continuous. */
  private midLon(a: THREE.Vector3, b: THREE.Vector3) {
    slerpUnit(a, b, 0.5, this.v1);
    return mapLon(Math.atan2(this.v1.x, this.v1.z));
  }

  private arcMaterial(color: THREE.Color, radius: number, intensity: number) {
    const mat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: ARC_VERT,
        fragmentShader: ARC_FRAG,
        uniforms: {
          uUnroll: this.unrollUniform,
          uRadius: { value: radius },
          uColor: { value: color },
          uPaperColor: { value: RUST },
          uDraw: { value: 0 },
          uGhost: { value: 0.22 },
          uGhostDraw: { value: 1 },
          uTime: { value: 0 },
          uFlow: { value: 1 },
          uIntensity: { value: intensity },
          uTrail: { value: 1 },
          uPaper: { value: 0 },
        },
        ...over,
      }),
    );
    this.arcMats.push(mat);
    return mat;
  }

  /** Ribbon strips: position = (t, side, 0); the shader rebuilds the lifted great-circle path. */
  private ribbon(list: { a: THREE.Vector3; b: THREE.Vector3; lift: number; lonRef: number }[], segs: number) {
    const per = (segs + 1) * 2;
    const n = list.length * per;
    const pos = new Float32Array(n * 3);
    const A = new Float32Array(n * 3);
    const B = new Float32Array(n * 3);
    const arc = new Float32Array(n * 2);
    const index: number[] = [];
    let v = 0;
    list.forEach((item, k) => {
      for (let s = 0; s <= segs; s++) {
        for (const side of [-1, 1]) {
          pos[v * 3] = s / segs;
          pos[v * 3 + 1] = side;
          A.set([item.a.x, item.a.y, item.a.z], v * 3);
          B.set([item.b.x, item.b.y, item.b.z], v * 3);
          arc[v * 2] = item.lift;
          arc[v * 2 + 1] = item.lonRef;
          v++;
        }
        if (s < segs) {
          const i0 = k * per + s * 2;
          index.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
        }
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aA", new THREE.BufferAttribute(A, 3));
    geo.setAttribute("aB", new THREE.BufferAttribute(B, 3));
    geo.setAttribute("aArc", new THREE.BufferAttribute(arc, 2));
    geo.setIndex(index);
    return geo;
  }

  private buildLand(land: LandData) {
    const quad = new THREE.PlaneGeometry(2, 2);
    const geo = this.track(new THREE.InstancedBufferGeometry());
    geo.index = quad.index;
    geo.setAttribute("position", quad.getAttribute("position"));
    geo.setAttribute("aGeo", new THREE.InstancedBufferAttribute(land.geo, 4));
    geo.setAttribute("aExtra", new THREE.InstancedBufferAttribute(land.extra, 3));
    geo.instanceCount = land.count;
    quad.dispose();
    const mesh = new THREE.Mesh(geo, this.dotMat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1; // after the ocean, so there is an alpha to keep
    return mesh;
  }

  private buildStars(count: number) {
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const rand = new Float32Array(count);
    const v = new THREE.Vector3();
    // a tilted great circle for a faint Milky Way band
    const bandN = new THREE.Vector3(0.35, 0.82, -0.45).normalize();
    const bandU = new THREE.Vector3(1, 0, 0).cross(bandN).normalize();
    const bandV = bandN.clone().cross(bandU);
    for (let i = 0; i < count; i++) {
      if (Math.random() < 0.35) {
        const a = Math.random() * Math.PI * 2;
        const spread = (Math.random() + Math.random() + Math.random() - 1.5) * 0.16;
        v.copy(bandU).multiplyScalar(Math.cos(a)).addScaledVector(bandV, Math.sin(a)).addScaledVector(bandN, spread).normalize();
      } else v.randomDirection();
      v.multiplyScalar(40 + Math.random() * 40);
      pos.set([v.x, v.y, v.z], i * 3);
      const r = Math.random();
      size[i] = 1 + Math.pow(r, 6) * 3.2;
      rand[i] = Math.random();
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
    const mat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: {
          uPixelRatio: { value: 1 },
          uTime: { value: 0 },
          uTwinkle: { value: this.settings.twinkle ? 1 : 0 },
          uFade: { value: 1 },
        },
        ...additive,
      }),
    );
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.renderOrder = -1;
    return pts;
  }

  /** Marker positions and facing for unroll progress u (CPU twin of the shader formula). */
  private placeMarkers(u: number) {
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i];
      unrollPoint(this.cityLat[i], this.cityLonR[i], this.markerLift[i], 0.005, u, m.position, this.markerNrm[i]);
      m.lookAt(this.v1.copy(m.position).add(this.markerNrm[i]));
    }
  }

  /** Point on leg i at t (same lift, wrap and unroll as the arc shader). */
  private legPoint(i: number, t: number, u: number, out: THREE.Vector3, nrm: THREE.Vector3) {
    const leg = this.legs[i];
    slerpUnit(leg.a, leg.b, clamp(t), this.v3).normalize();
    const lat = Math.asin(clamp(this.v3.y, -1, 1));
    const lonR = leg.lonRef + wrapPi(mapLon(Math.atan2(this.v3.x, this.v3.z)) - leg.lonRef);
    unrollPoint(lat, lonR, 0.004 + leg.lift * Math.sin(Math.PI * clamp(t)), 0.004, u, out, nrm);
    return out;
  }

  /* -------------------------------------------------------------- framing */

  /** Applies fov and view offset only when they change (no per-frame projection rebuild when still). */
  private applyView(camera: THREE.PerspectiveCamera, w: number, h: number, fov: number, ox: number, oy: number) {
    const v = this.view;
    if (w === v.w && h === v.h && fov === v.fov && ox === v.ox && oy === v.oy && camera.view) return;
    v.w = w;
    v.h = h;
    v.fov = fov;
    v.ox = ox;
    v.oy = oy;
    camera.fov = fov;
    camera.setViewOffset(w, h, ox, oy, w, h); // also updates the projection matrix
  }

  /** Called once the canvas is revealed: the "lights on" intro. */
  startIntro() {
    this.introOn = true;
  }

  /** Warm-up: everything visible so compileAsync sees every material. The next update() restores it. */
  showAllForCompile() {
    this.root.traverse((o) => (o.visible = true));
  }

  /* --------------------------------------------------------------- update */

  update(camera: THREE.PerspectiveCamera, w: number, h: number, delta: number, reduced: boolean, pixelRatio: number) {
    this.camera = camera;
    const dt = Math.min(delta, 0.1);
    if (!reduced) this.motionTime += dt;
    const time = this.motionTime;

    // intro: 0 → 1 over 1.8 s after the reveal (instant with reduced motion)
    if (reduced) this.intro = 1;
    else if (this.introOn && this.intro < 1) {
      this.intro = Math.min(1, this.intro + dt / INTRO_SECONDS);
      stage.wake();
    }
    const intro = this.intro;

    // desktop drag-to-rotate inertia (decays in about 1.2 s)
    if (stage.spinVel !== 0) {
      stage.spin += stage.spinVel * dt;
      stage.spinVel *= Math.exp(-dt * 3.2);
      if (Math.abs(stage.spinVel) < 0.5) stage.spinVel = 0;
      stage.wake();
    }

    // Reduced motion: cut to the nearest stop instead of flying (and to the flat map past 6.5)
    const rawP = stage.p;
    const p = reduced ? (rawP < -0.5 ? -1 : rawP >= 6.5 ? 7 : clamp(Math.round(rawP), 0, 6)) : clamp(rawP, -1, 7);
    const u = unrollProgress(p, reduced);
    const swing = swingProgress(p, reduced);
    const paper = paperProgress(u);
    this.unrollUniform.value = u;

    const aspect = w / h;
    const k = aspect < 0.85 ? clamp(0.7 / aspect, 1, 1.75) : 1;
    const HERO = 4.3 * k;
    const NEAR = 2.35 * k;
    const LIFT = 1.15 * k;

    const dirs = this.cityDirs;
    const last = dirs.length - 1;
    let dist = HERO;
    let focusAmt = 0;
    let activeLeg = -1;
    let legT = 0;

    if (p <= 0) {
      const heroLon = -16 + (reduced ? 0 : Math.sin(time * 0.11) * 38) + stage.spin;
      latLonToVec(20, heroLon, this.heroDir);
      const t = easeInOut(p + 1);
      slerpUnit(this.heroDir, dirs[0], t, this.dir);
      dist = HERO + (NEAR - HERO) * t;
      focusAmt = t;
    } else if (p < last) {
      const i = Math.floor(p);
      const f = p - i;
      const t = easeInOut(smooth(0.12, 0.88, f));
      slerpUnit(dirs[i], dirs[i + 1], t, this.dir);
      const flight = Math.sin(Math.PI * t);
      dist = NEAR + flight * LIFT * (0.45 + this.legs[i].angle / Math.PI);
      focusAmt = 1 - flight;
      activeLeg = i;
      legT = clamp((f - 0.1) / 0.8);
    } else {
      const t = easeInOut(clamp(p - last));
      slerpUnit(dirs[last], this.outroDir, t * 0.85, this.dir);
      dist = NEAR + (HERO * 1.04 - NEAR) * t;
      focusAmt = 1 - t;
    }

    // framing: globe beside the cards (wide) or above them (phones); centred for the map
    const baseFov = aspect < 0.85 ? 44 : 34;
    const fov = baseFov + (26 - baseFov) * swing;
    const ox = stage.wide ? -w * 0.2 * (1 - swing) : 0;
    const oy = stage.wide ? 0 : h * 0.17 * (1 - swing);
    this.applyView(camera, w, h, Math.round(fov * 100) / 100, Math.round(ox), Math.round(oy));

    // unroll: swing round to face the map and dolly back while the fov narrows (a gentle dolly zoom)
    this.target.set(0, 0, 0);
    if (swing > 0) {
      // the outro view and the map centre are almost antipodal, so swing explicitly eastward
      // (over Africa and the Indian Ocean) with a gentle rise, instead of an unstable slerp
      const lat0 = Math.asin(clamp(this.dir.y, -1, 1));
      const lon0 = Math.atan2(this.dir.x, this.dir.z);
      let dLon = MAP_LON0 * DEG - lon0;
      while (dLon < 0) dLon += Math.PI * 2;
      const lat = lat0 * (1 - swing) + Math.sin(Math.PI * swing) * 0.22;
      latLonToVec(lat / DEG, (lon0 + dLon * swing) / DEG, this.dir);
      const tan = Math.tan((13 * Math.PI) / 180);
      const fit = Math.max(MAP_W / (0.86 * 2 * tan * aspect), MAP_H / (0.8 * 2 * tan));
      dist += (fit - dist) * swing;
      this.target.copy(MAP_DIR).multiplyScalar(u);
    }

    // gentle pointer parallax (full motion only, not on the map)
    this.right.crossVectors(this.up, this.dir).normalize();
    if (!reduced && swing < 1) {
      const par = 1 - swing;
      this.dir
        .addScaledVector(this.right, stage.px * 0.035 * par)
        .addScaledVector(this.up, stage.py * 0.025 * par)
        .normalize();
    }
    camera.position.copy(this.dir).multiplyScalar(dist).add(this.target);
    camera.up.set(0, 1, 0);
    camera.lookAt(this.target);

    // sun from front-right-above; during the intro it sweeps in from the night side
    this.sun.copy(this.dir).multiplyScalar(0.55).addScaledVector(this.right, 0.8).addScaledVector(this.up, 0.35).normalize();
    const sweep = 1 - easeInOut(smooth(0, 0.75, intro));
    if (sweep > 0) this.sun.applyAxisAngle(this.up, sweep * 2.6);

    // ocean + land
    this.oceanMat.uniforms.uTime.value = time;
    this.oceanMat.uniforms.uPaper.value = paper;
    const du = this.dotMat.uniforms;
    (du.uFocus.value as THREE.Vector3).copy(this.dir);
    du.uFocusAmt.value = focusAmt * (1 - u);
    du.uIntro.value = intro;
    du.uTime.value = time;
    du.uPaper.value = paper;

    // arcs; the ghost route draws itself from Reykjavík during the intro
    const ghostDraw = smooth(0.5, 1, intro) * this.legs.length;
    for (let i = 0; i < this.legs.length; i++) {
      const un = this.legs[i].mesh.material.uniforms;
      let draw: number;
      if (reduced) draw = p >= i + 1 ? 1 : 0;
      else draw = p >= i + 1 ? 1 : i === activeLeg ? legT : 0;
      un.uDraw.value = draw;
      un.uTime.value = time;
      un.uFlow.value = reduced ? 0 : 1 - paper;
      un.uGhost.value = p < -0.2 ? 0.32 : 0.2;
      un.uGhostDraw.value = clamp(ghostDraw - i);
      un.uPaper.value = paper;
    }
    if (this.ambient) {
      const am = this.ambient.material.uniforms;
      const fade = (1 - smooth(0, 0.25, u)) * smooth(0.3, 1, intro);
      am.uTime.value = time * 0.6;
      am.uFlow.value = reduced ? 0 : 1;
      am.uIntensity.value = (0.18 + 0.32 * clamp(-p)) * fade; // strongest in the hero
      this.ambient.visible = fade > 0.001;
    }

    // aircraft: chevron along the arc tangent, glow under it, short contrail in the arc shader
    const flying = !reduced && activeLeg >= 0 && legT > 0.001 && legT < 0.999;
    this.glow.visible = flying;
    if (this.aircraft) this.aircraft.visible = flying;
    if (flying) {
      this.legPoint(activeLeg, legT, u, this.v2, this.n1);
      this.glow.position.copy(this.v2);
      this.glow.material.uniforms.uPixelRatio.value = pixelRatio;
      this.glow.material.uniforms.uSize.value = (this.aircraft ? 46 : 70) * (h / 900);
      if (this.aircraft) {
        const fwd = this.legPoint(activeLeg, legT + 0.004, u, this.v1, this.proj);
        fwd.sub(this.legPoint(activeLeg, legT - 0.004, u, this.v3, this.proj)).normalize();
        // "up" is the surface normal at the head (radial on the globe, the map normal on paper)
        this.n1.addScaledVector(fwd, -this.n1.dot(fwd)).normalize();
        this.right.crossVectors(fwd, this.n1);
        const s = 0.016;
        this.basis.makeBasis(this.right, fwd, this.n1).scale(this.v3.set(s, s, s));
        this.basis.setPosition(this.v2.addScaledVector(this.n1, 0.003));
        this.aircraft.matrix.copy(this.basis);
        this.aircraft.matrixWorldNeedsUpdate = true;
      }
    }

    // markers (+ pillars): pop in one by one during the intro
    if (u !== this.lastU) {
      this.lastU = u;
      this.placeMarkers(u);
    }
    const outro = clamp(p - last);
    const pillarFade = 1 - smooth(0, 0.3, u);
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i];
      const near = clamp(1 - Math.abs(p - i) * 1.6);
      const active = Math.max(0.15, near, outro * 0.55);
      const pop = easeOutBack(clamp((intro - 0.4 - i * 0.07) / 0.25));
      const mu = m.material.uniforms;
      mu.uActive.value = active;
      mu.uTime.value = time;
      mu.uPulse.value = reduced ? 0 : 1 - paper;
      mu.uPaper.value = paper;
      m.scale.setScalar((0.8 + 0.5 * active) * pop + 0.0001);
      if (this.pillars) {
        const pu = this.pillars.material.uniforms;
        (pu.uHeight.value as number[])[i] = (0.06 + 0.06 * near) * pop;
        (pu.uGlow.value as number[])[i] = (0.3 + 0.7 * active) * pop * pillarFade;
      }
    }
    if (this.pillars) this.pillars.visible = pillarFade > 0.001;

    // atmosphere and stars fade away as the paper takes over
    const airFade = 1 - smooth(0, 0.35, u);
    this.atmo.material.uniforms.uFade.value = airFade;
    this.shell.material.uniforms.uFade.value = airFade;
    this.atmo.visible = this.shell.visible = airFade > 0.001;
    const sm = this.stars.material.uniforms;
    sm.uPixelRatio.value = pixelRatio;
    sm.uTime.value = time;
    sm.uFade.value = 1 - smooth(0.1, 0.7, u);
    this.stars.visible = sm.uFade.value > 0.001;
  }

  /** Screen-space pick: nearest visible marker within 26 px of the pointer. */
  pick(clientX: number, clientY: number, w: number, h: number) {
    const camera = this.camera;
    if (!camera) return -1;
    let best = -1;
    let bestD = 26 * 26;
    for (let i = 0; i < this.markers.length; i++) {
      const pos = this.markers[i].position;
      // far side of the globe (or the back of the paper)
      if (this.v1.copy(camera.position).sub(pos).normalize().dot(this.markerNrm[i]) < 0.2) continue;
      this.proj.copy(pos).project(camera);
      const x = (this.proj.x * 0.5 + 0.5) * w;
      const y = (-this.proj.y * 0.5 + 0.5) * h;
      const d = (x - clientX) ** 2 + (y - clientY) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  dispose() {
    this.root.removeFromParent();
    this.disposables.forEach((d) => d.dispose());
  }
}
