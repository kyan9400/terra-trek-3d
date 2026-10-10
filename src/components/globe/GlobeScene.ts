/* ==========================================================================
   GLOBE SCENE — everything on the canvas, built in code.
     ocean      sphere + shader: night/day shading, graticule, fresnel rim, sun glint
     land       InstancedMesh of tiny discs on a Fibonacci sphere, kept where
                land.ts says "land"; day/night colour, city lights, focus glow
     arcs       TubeGeometry along lifted great-circle paths, additive shader
                that draws itself from 0..1 with a bright head
     markers    six shader quads: dot, ring and an expanding pulse
     plane      one glowing point that rides the active arc
     atmosphere back-face sphere with a soft halo
     stars      Points with optional twinkle
   The class owns its objects; React only adds `root` to the scene and calls
   update() once per rendered frame. update() allocates nothing.
   ========================================================================== */

import * as THREE from "three";
import { ROUTE } from "@/lib/route";
import type { TierSettings } from "@/lib/quality";
import { stage } from "@/lib/stage";
import { isLand } from "./land";

const EMBER = new THREE.Color("#ff9f43");
const SAND = new THREE.Color("#f2e9da");
const GLACIER = new THREE.Color("#7cc6d9");
const DEG = Math.PI / 180;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

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

const OCEAN_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const OCEAN_FRAG = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uGlacier;
  uniform vec3 uEmber;
  varying vec3 vN;
  varying vec3 vW;
  const float PI = 3.14159265;

  float gridLine(float coord, float stepDeg) {
    float x = coord / stepDeg;
    float f = abs(fract(x - 0.5) - 0.5);
    float w = fwidth(x);
    return 1.0 - smoothstep(0.0, w * 1.2, f);
  }

  void main() {
    vec3 n = normalize(vN);
    vec3 v = normalize(cameraPosition - vW);
    float ndl = dot(n, uSun);
    float day = smoothstep(-0.22, 0.5, ndl);

    vec3 night = vec3(0.022, 0.04, 0.075);
    vec3 dayc  = vec3(0.05, 0.13, 0.21);
    vec3 col = mix(night, dayc, day);

    // graticule every 15 degrees, a touch stronger at the equator
    float lat = degrees(asin(clamp(n.y, -1.0, 1.0)));
    float lon = degrees(atan(n.x, n.z));
    float g = max(gridLine(lat, 15.0), gridLine(lon, 15.0));
    float eq = 1.0 - smoothstep(0.0, fwidth(lat) * 1.5, abs(lat));
    col += uGlacier * (g * 0.045 + eq * 0.05) * (0.4 + 0.6 * day);

    // sun glint on the water
    vec3 h = normalize(uSun + v);
    float spec = pow(max(dot(n, h), 0.0), 70.0) * day;
    col += mix(uEmber, vec3(1.0, 0.93, 0.8), 0.5) * spec * 0.35;

    // fresnel rim
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    col += mix(uGlacier, uEmber, 0.25 * day) * rim * (0.18 + 0.4 * day);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const DOT_VERT = /* glsl */ `
  attribute float aRand;
  varying float vRand;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vN = normalize((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz);
    vW = w.xyz;
    vRand = aRand;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const DOT_FRAG = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uFocus;
  uniform float uFocusAmt;
  uniform float uLights;
  uniform vec3 uSand;
  uniform vec3 uEmber;
  varying float vRand;
  varying vec3 vN;
  varying vec3 vW;
  void main() {
    float day = smoothstep(-0.18, 0.4, dot(vN, uSun));
    vec3 dayCol = mix(vec3(0.55, 0.66, 0.76), uSand, 0.35 + vRand * 0.5);
    vec3 nightCol = vec3(0.13, 0.19, 0.29) + vRand * 0.04;
    vec3 col = mix(nightCol, dayCol, day);

    // warm city lights scattered over the night side
    float lights = step(0.87, vRand) * (1.0 - day) * uLights;
    col = mix(col, uEmber * (0.9 + vRand * 0.5), lights);

    // land around the focused city glows
    float f = (1.0 - smoothstep(0.0, 0.32, distance(vN, uFocus))) * uFocusAmt;
    col += uEmber * f * 0.5;

    // sink into the ocean rim near the limb (no alpha needed)
    float facing = dot(vN, normalize(cameraPosition - vW));
    col *= smoothstep(-0.05, 0.35, facing);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const ARC_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vFace;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 nv = normalize(normalMatrix * normal);
    vFace = abs(dot(nv, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

const ARC_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uDraw;
  uniform float uGhost;
  uniform float uTime;
  uniform float uFlow;
  uniform float uIntensity;
  varying vec2 vUv;
  varying float vFace;
  void main() {
    float s = vUv.x;
    float drawn = step(s, uDraw);
    float core = pow(vFace, 1.6);
    float dash = mix(1.0, 0.55 + 0.45 * sin(s * 90.0 - uTime * 4.0), uFlow);
    float head = (1.0 - smoothstep(0.0, 0.05, abs(s - uDraw))) * step(0.002, uDraw) * step(uDraw, 0.998);
    float ends = smoothstep(0.0, 0.025, s) * smoothstep(1.0, 0.975, s);
    float ghost = (1.0 - drawn) * uGhost * step(0.55, fract(s * 70.0));
    float a = (drawn * dash * 0.85 + head * 1.6 + ghost) * core * ends * uIntensity;
    vec3 col = mix(uColor, vec3(1.0, 0.94, 0.82), head * 0.8);
    gl_FragColor = vec4(col * a, 1.0);
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
  uniform vec3 uSand;
  uniform vec3 uEmber;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.09, 0.14, d);
    float ring = 1.0 - smoothstep(0.0, 0.035, abs(d - 0.32));
    float pr = fract(uTime * 0.45 + uPhase);
    float pulse = (1.0 - smoothstep(0.0, 0.05, abs(d - mix(0.2, 0.95, pr)))) * (1.0 - pr) * uPulse;
    float a = core * (0.8 + 0.4 * uActive) + ring * (0.35 + 0.65 * uActive) + pulse * (0.25 + 0.75 * uActive);
    vec3 col = mix(uSand, uEmber, 0.25 + 0.75 * uActive);
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

const ATMO_VERT = /* glsl */ `
  varying vec3 vNV;
  varying vec3 vPV;
  varying vec3 vNW;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vPV = mv.xyz;
    vNV = normalize(normalMatrix * normal);
    vNW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * mv;
  }
`;

const ATMO_FRAG = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uGlacier;
  uniform vec3 uEmber;
  varying vec3 vNV;
  varying vec3 vPV;
  varying vec3 vNW;
  void main() {
    float d = dot(normalize(vNV), normalize(-vPV)); // back faces: 0 at the outer edge, about -0.5 at the globe's limb
    float halo = pow(smoothstep(0.0, 0.52, -d), 2.4);
    float sunSide = smoothstep(-0.4, 0.8, dot(normalize(vNW), uSun));
    vec3 col = mix(uGlacier * 0.55, mix(uGlacier, uEmber, 0.35), sunSide);
    gl_FragColor = vec4(col * halo * (0.35 + 0.65 * sunSide), 1.0);
  }
`;

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aRand;
  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uTwinkle;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio;
    vA = 0.35 + 0.65 * aRand;
    vA *= mix(1.0, 0.55 + 0.45 * sin(uTime * (0.6 + aRand * 1.8) + aRand * 40.0), uTwinkle);
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

type Arc = {
  curve: THREE.CatmullRomCurve3;
  mesh: THREE.Mesh<THREE.TubeGeometry, THREE.ShaderMaterial>;
  angle: number;
};

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
} as const;

/** Give the browser a chance to handle input / paint between heavy steps. */
export function yieldToMain(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Fibonacci samples on the unit sphere that fall on land, computed in slices
 * (the land test is the costliest CPU step of the build), yielding between them.
 * Returns null if `alive()` turns false part-way.
 */
async function landPositions(n: number, alive: () => boolean): Promise<Float32Array | null> {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out = new Float32Array(n * 3);
  let k = 0;
  const SLICE = 6000;
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
      if (isLand(lon, lat)) {
        out[k++] = x;
        out[k++] = y;
        out[k++] = z;
      }
    }
  }
  return out.subarray(0, k);
}

export class GlobeScene {
  /** Builds the scene in slices so no single task blocks the main thread for long. */
  static async create(settings: TierSettings, alive: () => boolean): Promise<GlobeScene | null> {
    await yieldToMain();
    if (!alive()) return null;
    const land = await landPositions(settings.landSamples, alive);
    if (!land) return null;
    await yieldToMain();
    if (!alive()) return null;
    return new GlobeScene(settings, land);
  }

  readonly root = new THREE.Group();
  private readonly settings: TierSettings;
  private readonly disposables: { dispose: () => void }[] = [];

  private readonly cityDirs: THREE.Vector3[];
  private readonly arcs: Arc[] = [];
  private readonly markers: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = [];
  private readonly ambientMats: THREE.ShaderMaterial[] = [];

  private readonly oceanMat: THREE.ShaderMaterial;
  private readonly dotMat: THREE.ShaderMaterial;
  private readonly atmoMat: THREE.ShaderMaterial;
  private readonly starMat: THREE.ShaderMaterial;
  private readonly plane: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;

  // scratch objects (reused every frame)
  private readonly v1 = new THREE.Vector3();
  private readonly v2 = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly heroDir = new THREE.Vector3();
  private readonly outroDir = latLonToVec(4, -38);
  private readonly sun = new THREE.Vector3();
  private readonly proj = new THREE.Vector3();

  private motionTime = 0;
  private lastW = 0;
  private lastH = 0;
  private lastWide: boolean | null = null;
  private camera: THREE.PerspectiveCamera | null = null;

  private constructor(settings: TierSettings, land: Float32Array) {
    this.settings = settings;
    this.cityDirs = ROUTE.map((c) => latLonToVec(c.lat, c.lon));

    const sharedSun = { value: this.sun };

    /* ocean */
    this.oceanMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: OCEAN_VERT,
        fragmentShader: OCEAN_FRAG,
        uniforms: { uSun: sharedSun, uGlacier: { value: GLACIER }, uEmber: { value: EMBER } },
      }),
    );
    const ocean = new THREE.Mesh(this.track(new THREE.SphereGeometry(1, 96, 64)), this.oceanMat);
    this.root.add(ocean);

    /* land dots */
    this.dotMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: DOT_VERT,
        fragmentShader: DOT_FRAG,
        uniforms: {
          uSun: sharedSun,
          uFocus: { value: new THREE.Vector3(0, 0, 1) },
          uFocusAmt: { value: 0 },
          uLights: { value: settings.cityLights ? 1 : 0 },
          uSand: { value: SAND },
          uEmber: { value: EMBER },
        },
      }),
    );
    this.root.add(this.buildLand(land));

    /* atmosphere */
    this.atmoMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        uniforms: { uSun: sharedSun, uGlacier: { value: GLACIER }, uEmber: { value: EMBER } },
        side: THREE.BackSide,
        ...additive,
      }),
    );
    const atmo = new THREE.Mesh(this.track(new THREE.SphereGeometry(1.17, 64, 48)), this.atmoMat);
    this.root.add(atmo);

    /* route arcs */
    for (let i = 0; i < this.cityDirs.length - 1; i++) {
      this.arcs.push(this.buildArc(this.cityDirs[i], this.cityDirs[i + 1], 0.0042, EMBER, 1));
    }

    /* ambient network arcs from the Lisbon office (faint, glacier blue) */
    if (settings.ambientArcs) {
      const hub = latLonToVec(38.72, -9.14);
      const others: [number, number][] = [
        [40.71, -74.0], [-1.29, 36.82], [28.61, 77.2], [-34.6, -58.38], [1.35, 103.82],
        [55.75, 37.62], [19.43, -99.13], [-22.9, -43.2], [64.15, -21.94], [35.01, 135.77],
      ];
      for (const [lat, lon] of others) {
        const arc = this.buildArc(hub, latLonToVec(lat, lon), 0.0022, GLACIER, 0.5);
        arc.mesh.material.uniforms.uDraw.value = 1;
        this.ambientMats.push(arc.mesh.material);
      }
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
            uSand: { value: SAND },
            uEmber: { value: EMBER },
          },
          ...additive,
        }),
      );
      const m = new THREE.Mesh(markerGeo, mat);
      m.position.copy(d).multiplyScalar(1.006);
      m.lookAt(this.v1.copy(d).multiplyScalar(2));
      m.renderOrder = 3;
      this.markers.push(m);
      this.root.add(m);
    });

    /* the "aircraft" riding the active arc */
    const planeGeo = this.track(new THREE.BufferGeometry());
    planeGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0], 3));
    const planeMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: POINT_VERT,
        fragmentShader: POINT_FRAG,
        uniforms: { uSize: { value: 70 }, uPixelRatio: { value: 1 }, uColor: { value: EMBER }, uAlpha: { value: 1 } },
        ...additive,
      }),
    );
    this.plane = new THREE.Points(planeGeo, planeMat);
    this.plane.frustumCulled = false;
    this.plane.renderOrder = 4;
    this.plane.visible = false;
    this.root.add(this.plane);

    /* stars */
    this.starMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: { uPixelRatio: { value: 1 }, uTime: { value: 0 }, uTwinkle: { value: settings.twinkle ? 1 : 0 } },
        ...additive,
      }),
    );
    this.root.add(this.buildStars(settings.stars));
  }

  private track<T extends { dispose: () => void }>(obj: T): T {
    this.disposables.push(obj);
    return obj;
  }

  private buildLand(positions: Float32Array) {
    const spacing = Math.sqrt((4 * Math.PI) / this.settings.landSamples);
    const count = positions.length / 3;
    const geo = this.track(new THREE.CircleGeometry(spacing * 0.36, 6));
    const rand = new Float32Array(count);
    const mesh = new THREE.InstancedMesh(geo, this.dotMat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const zAxis = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < count; i++) {
      p.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
      q.setFromUnitVectors(zAxis, p);
      const r = Math.random();
      rand[i] = r;
      s.setScalar(0.75 + r * 0.45);
      m.compose(p.multiplyScalar(1.0015), q, s);
      mesh.setMatrixAt(i, m);
    }
    geo.setAttribute("aRand", new THREE.InstancedBufferAttribute(rand, 1));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    this.disposables.push({ dispose: () => mesh.dispose() });
    return mesh;
  }

  private buildArc(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: THREE.Color, intensity: number): Arc {
    const angle = Math.acos(clamp(a.dot(b), -1, 1));
    const lift = 0.05 + 0.26 * (angle / Math.PI);
    const pts: THREE.Vector3[] = [];
    const segs = 72;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const v = slerpUnit(a, b, t, new THREE.Vector3());
      pts.push(v.multiplyScalar(1.004 + lift * Math.sin(Math.PI * t)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = this.track(new THREE.TubeGeometry(curve, 220, radius, 6, false));
    const mat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: ARC_VERT,
        fragmentShader: ARC_FRAG,
        uniforms: {
          uColor: { value: color },
          uDraw: { value: 0 },
          uGhost: { value: 0.22 },
          uTime: { value: 0 },
          uFlow: { value: 1 },
          uIntensity: { value: intensity },
        },
        ...additive,
      }),
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    this.root.add(mesh);
    return { curve, mesh, angle };
  }

  private buildStars(count: number) {
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const rand = new Float32Array(count);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.randomDirection().multiplyScalar(40 + Math.random() * 40);
      pos.set([v.x, v.y, v.z], i * 3);
      const r = Math.random();
      size[i] = 1 + Math.pow(r, 6) * 3.2;
      rand[i] = Math.random();
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
    const pts = new THREE.Points(geo, this.starMat);
    pts.frustumCulled = false;
    pts.renderOrder = -1;
    return pts;
  }

  /* -------------------------------------------------------------- framing */

  private frame(camera: THREE.PerspectiveCamera, w: number, h: number) {
    const wide = stage.wide;
    if (w === this.lastW && h === this.lastH && wide === this.lastWide && camera.view) return;
    this.lastW = w;
    this.lastH = h;
    this.lastWide = wide;
    const aspect = w / h;
    camera.fov = aspect < 0.85 ? 44 : 34;
    // Shift the picture (not the scene): globe to the right of the cards, or above them on phones
    if (wide) camera.setViewOffset(w, h, -w * 0.2, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.17, w, h);
    camera.updateProjectionMatrix();
  }

  /* --------------------------------------------------------------- update */

  update(camera: THREE.PerspectiveCamera, w: number, h: number, delta: number, reduced: boolean, pixelRatio: number) {
    this.camera = camera;
    this.frame(camera, w, h);
    const dt = Math.min(delta, 0.1);
    if (!reduced) this.motionTime += dt;
    const time = this.motionTime;

    // Reduced motion: cut to the nearest stop instead of flying
    const raw = stage.p;
    const p = reduced ? (raw < -0.5 ? -1 : clamp(Math.round(raw), 0, 6)) : clamp(raw, -1, 6);

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
      const heroLon = -16 + (reduced ? 0 : Math.sin(time * 0.11) * 38);
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
      dist = NEAR + flight * LIFT * (0.45 + this.arcs[i].angle / Math.PI);
      focusAmt = 1 - flight;
      activeLeg = i;
      legT = clamp((f - 0.1) / 0.8);
    } else {
      const t = easeInOut(clamp(p - last));
      slerpUnit(dirs[last], this.outroDir, t * 0.85, this.dir);
      dist = NEAR + (HERO * 1.04 - NEAR) * t;
      focusAmt = 1 - t;
    }

    // gentle pointer parallax (full motion only)
    this.right.crossVectors(this.up, this.dir).normalize();
    if (!reduced) {
      this.dir.addScaledVector(this.right, stage.px * 0.035).addScaledVector(this.up, stage.py * 0.025).normalize();
    }
    camera.position.copy(this.dir).multiplyScalar(dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);

    // sun from front-right-above, so a terminator and the night side are always in view
    this.sun.copy(this.dir).multiplyScalar(0.55).addScaledVector(this.right, 0.8).addScaledVector(this.up, 0.35).normalize();

    // land focus glow follows the camera's target
    (this.dotMat.uniforms.uFocus.value as THREE.Vector3).copy(this.dir);
    this.dotMat.uniforms.uFocusAmt.value = focusAmt;

    // arcs
    for (let i = 0; i < this.arcs.length; i++) {
      const u = this.arcs[i].mesh.material.uniforms;
      let draw: number;
      if (reduced) draw = p >= i + 1 ? 1 : 0;
      else draw = p >= i + 1 ? 1 : i === activeLeg ? legT : 0;
      u.uDraw.value = draw;
      u.uTime.value = time;
      u.uFlow.value = reduced ? 0 : 1;
      u.uGhost.value = p < -0.2 ? 0.32 : 0.2;
    }
    for (const m of this.ambientMats) {
      m.uniforms.uTime.value = time * 0.6;
      m.uniforms.uFlow.value = reduced ? 0 : 1;
      m.uniforms.uIntensity.value = 0.18 + 0.32 * clamp(-p); // strongest in the hero
    }

    // aircraft
    const flying = !reduced && activeLeg >= 0 && legT > 0.001 && legT < 0.999;
    this.plane.visible = flying;
    if (flying) {
      this.arcs[activeLeg].curve.getPointAt(legT, this.v2);
      this.plane.position.copy(this.v2);
      this.plane.material.uniforms.uPixelRatio.value = pixelRatio;
      this.plane.material.uniforms.uSize.value = 70 * (h / 900);
    }

    // markers
    const outro = clamp(p - last);
    for (let i = 0; i < this.markers.length; i++) {
      const m = this.markers[i];
      const active = Math.max(0.15, 1 - Math.abs(p - i) * 1.6, outro * 0.55);
      m.material.uniforms.uActive.value = active;
      m.material.uniforms.uTime.value = time;
      m.material.uniforms.uPulse.value = reduced ? 0 : 1;
      m.scale.setScalar(0.8 + 0.5 * active);
    }

    this.starMat.uniforms.uPixelRatio.value = pixelRatio;
    this.starMat.uniforms.uTime.value = time;
  }

  /** Screen-space pick: nearest visible marker within 26 px of the pointer. */
  pick(clientX: number, clientY: number, w: number, h: number) {
    const camera = this.camera;
    if (!camera) return -1;
    let best = -1;
    let bestD = 26 * 26;
    this.v1.copy(camera.position).normalize();
    for (let i = 0; i < this.cityDirs.length; i++) {
      if (this.cityDirs[i].dot(this.v1) < 0.2) continue; // far side
      this.proj.copy(this.markers[i].position).project(camera);
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
