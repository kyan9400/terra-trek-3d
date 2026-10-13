/* Coarse climate geography shared by the 3D earth texture and the SVG poster (no three.js here). */

/** [lat, lon, radius lat°, radius lon°, amount] — positive: drier, negative: wetter. */
export const CLIMATE: [number, number, number, number, number][] = [
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
export function aridity(lat: number, lon: number) {
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
