/* ==========================================================================
   TERRAIN + CITY LIGHTS — hand-placed, deliberately coarse geographic facts.
   - RANGES: soft ellipses for the big mountain ranges and ice domes. The globe
     lifts and lightly grows land dots by this height and shades their slopes.
   - METROS: large metro areas; dots near them glow on the night side, so the
     night shows real coasts (Europe, Japan, US East) instead of random sparks.
   Plain math, no three.js; used once while the globe is built.
   ========================================================================== */

/** [lat, lon, radius lat°, radius lon°, height 0..1, rotation° (counter-clockwise)] */
type Range = [number, number, number, number, number, number];

const RANGES: Range[] = [
  // Himalaya, Karakoram, Tibetan plateau
  [29, 84, 2.6, 13, 1, -21],
  [33, 88, 5, 12, 0.72, 0],
  [36.2, 74, 2.6, 5, 0.85, 10],
  // Andes (north → south), Altiplano near Cusco
  [7, -73.5, 6, 2.2, 0.55, 15],
  [-3, -78.3, 6, 2, 0.62, 0],
  [-15.5, -70.5, 7, 3.4, 0.9, -15],
  [-27, -68.6, 7, 2.4, 0.85, 0],
  [-39, -71, 6, 1.8, 0.6, 0],
  [-49, -73.2, 5, 1.6, 0.45, 0],
  // Rockies, Alaska Range, Sierra Madre
  [41, -107.5, 8, 4.5, 0.6, -10],
  [52, -119, 6, 3, 0.55, -30],
  [62, -148, 2.5, 8, 0.6, 0],
  [23, -104, 6, 2.8, 0.4, -25],
  // Alps, Atlas, Caucasus, Iranian plateau
  [46.3, 9.5, 1.3, 5, 0.65, 10],
  [31.6, -6, 1.5, 7, 0.5, 18],
  [42.8, 44, 1.2, 5, 0.5, -20],
  [32, 53, 4, 7, 0.4, -35],
  // East African highlands (Ethiopia, Kenya / Kilimanjaro), Drakensberg, Cape Fold belt
  [9, 39, 5, 4, 0.6, 0],
  [-2, 37, 4, 3, 0.55, 0],
  [-29.5, 29.5, 2, 1.5, 0.42, 30],
  [-33.6, 20.5, 1, 3, 0.32, 0],
  // Southern Alps NZ, Japanese Alps
  [-43.8, 170.3, 3.5, 1.4, 0.62, -40],
  [36.2, 137.6, 1.8, 1.2, 0.45, 0],
  // Iceland highlands, Greenland ice dome
  [64.8, -18.5, 0.9, 3, 0.4, 0],
  [72, -40, 10, 16, 0.72, 0],
];

const DEG = Math.PI / 180;

/** Height 0..1 at a lat/lon (degrees). Smooth, overlapping ranges take the maximum. */
export function terrainHeight(lat: number, lon: number) {
  let h = 0;
  for (let i = 0; i < RANGES.length; i++) {
    const [la, lo, rLa, rLo, height, rot] = RANGES[i];
    let dLon = lon - lo;
    if (dLon > 180) dLon -= 360;
    else if (dLon < -180) dLon += 360;
    // local flat frame around the range centre (degrees, east compressed by latitude)
    const x = dLon * Math.cos(la * DEG);
    const y = lat - la;
    const c = Math.cos(rot * DEG);
    const s = Math.sin(rot * DEG);
    const u = (x * c + y * s) / rLo;
    const v = (-x * s + y * c) / rLa;
    const d2 = u * u + v * v;
    if (d2 >= 1) continue;
    const f = (1 - d2) * (1 - d2);
    if (height * f > h) h = height * f;
  }
  return h;
}

/** Uphill direction (east, north), roughly -1..1: used to shade slopes against the sun. */
export function terrainSlope(lat: number, lon: number, out: [number, number]) {
  const e = 0.6;
  const cosLat = Math.max(0.2, Math.cos(lat * DEG));
  const dx = (terrainHeight(lat, lon + e / cosLat) - terrainHeight(lat, lon - e / cosLat)) / (2 * e);
  const dy = (terrainHeight(lat + e, lon) - terrainHeight(lat - e, lon)) / (2 * e);
  let gx = dx * 3;
  let gy = dy * 3;
  const l = Math.hypot(gx, gy);
  if (l > 1) {
    gx /= l;
    gy /= l;
  }
  out[0] = gx;
  out[1] = gy;
  return out;
}

/** [lat, lon, weight] — large metro areas (public geographic facts). */
const METROS: [number, number, number][] = [
  // Europe
  [51.5, -0.13, 1], [48.86, 2.35, 1], [52.52, 13.4, 0.8], [40.42, -3.7, 0.8], [41.9, 12.5, 0.7], [45.46, 9.19, 0.8],
  [50.85, 4.35, 0.8], [52.37, 4.9, 0.7], [53.48, -2.24, 0.6], [55.75, 37.62, 1], [59.94, 30.31, 0.6], [50.45, 30.52, 0.6],
  [52.23, 21.01, 0.6], [48.21, 16.37, 0.6], [41.39, 2.17, 0.7], [38.72, -9.14, 0.6], [37.98, 23.73, 0.6], [41.01, 28.98, 1],
  [51.23, 6.78, 0.9], [59.33, 18.07, 0.4],
  // Middle East, Africa
  [30.04, 31.24, 1], [33.57, -7.59, 0.6], [6.52, 3.38, 0.9], [-26.2, 28.05, 0.8], [-33.92, 18.42, 0.5], [-1.29, 36.82, 0.5],
  [9.03, 38.74, 0.5], [25.2, 55.27, 0.7], [24.71, 46.68, 0.6], [35.69, 51.39, 0.8], [33.31, 44.36, 0.5],
  // South & East Asia
  [28.61, 77.2, 1], [19.08, 72.88, 1], [22.57, 88.36, 0.9], [12.97, 77.59, 0.8], [13.08, 80.27, 0.7], [24.86, 67.0, 0.8],
  [31.55, 74.34, 0.6], [23.81, 90.41, 0.9], [39.9, 116.4, 1], [31.23, 121.47, 1], [23.13, 113.26, 1], [22.32, 114.17, 0.8],
  [30.57, 104.07, 0.7], [34.26, 108.94, 0.6], [37.57, 126.98, 1], [35.68, 139.69, 1], [34.69, 135.5, 0.9], [35.18, 136.91, 0.6],
  [33.59, 130.4, 0.5], [13.76, 100.5, 0.8], [14.6, 120.98, 0.8], [-6.2, 106.85, 0.9], [1.35, 103.82, 0.6], [10.82, 106.63, 0.6],
  // Americas
  [40.71, -74.0, 1], [42.36, -71.06, 0.7], [38.9, -77.04, 0.7], [41.88, -87.63, 0.9], [43.65, -79.38, 0.7], [45.5, -73.57, 0.5],
  [33.75, -84.39, 0.6], [25.76, -80.19, 0.6], [29.76, -95.37, 0.7], [32.78, -96.8, 0.7], [34.05, -118.24, 1], [37.77, -122.42, 0.7],
  [47.61, -122.33, 0.5], [19.43, -99.13, 1], [-23.55, -46.63, 1], [-22.9, -43.2, 0.8], [-34.6, -58.38, 0.8], [4.71, -74.07, 0.6],
  [-12.05, -77.04, 0.6], [-33.45, -70.67, 0.6],
  // Oceania
  [-33.87, 151.21, 0.7], [-37.81, 144.96, 0.6], [-36.85, 174.76, 0.4],
];

const METRO_VECS = METROS.map(([lat, lon, w]) => {
  const la = lat * DEG;
  const lo = lon * DEG;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo), w] as const;
});

/** City-light strength 0..1 for a point on the unit sphere. */
export function cityLight(x: number, y: number, z: number) {
  let l = 0;
  // falloff ~2.3° around each metro (chord² ≈ angle² for small angles)
  const inv = 1 / (0.04 * 0.04);
  for (let i = 0; i < METRO_VECS.length; i++) {
    const m = METRO_VECS[i];
    const dx = x - m[0];
    const dy = y - m[1];
    const dz = z - m[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > 0.012) continue;
    l += m[3] * Math.exp(-d2 * inv);
  }
  return Math.min(1, l);
}
