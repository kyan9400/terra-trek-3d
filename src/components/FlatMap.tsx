/* ==========================================================================
   FLAT MAP — server-rendered SVG of the printed route map: the same
   equirectangular, Pacific-centred projection the 3D globe unrolls into.
   Visitors without the 3D (no WebGL, software renderer, lost context) see
   it in the unroll block; with the 3D it is hidden and the globe unrolls.
   ========================================================================== */

import { FLAT_DOTS, FLAT_PINS, FLAT_ROUTE, FLAT_STEP, MAP_VH, MAP_VW } from "@/lib/poster";

const LINES_LAT = [-60, -45, -30, -15, 0, 15, 30, 45, 60];
const LINES_LON = Array.from({ length: 23 }, (_, i) => (i + 1) * 30);

export default function FlatMap() {
  return (
    <svg viewBox={`0 0 ${MAP_VW} ${MAP_VH}`} aria-hidden="true" focusable="false">
      <rect width={MAP_VW} height={MAP_VH} fill="#e6dac4" />
      <g stroke="#1a1712" strokeOpacity="0.16" strokeWidth="0.75">
        {LINES_LAT.map((lat) => (
          <path key={lat} d={`M0 ${180 - lat * 2}H${MAP_VW}`} strokeOpacity={lat === 0 ? 0.3 : undefined} />
        ))}
        {LINES_LON.map((x) => (
          <path key={x} d={`M${x} 0V${MAP_VH}`} />
        ))}
      </g>
      {/* each land run is a segment; the dash pattern turns it into a row of dots */}
      <path
        d={FLAT_DOTS}
        stroke="#1a1712"
        strokeOpacity="0.82"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeDasharray={`0 ${FLAT_STEP}`}
        fill="none"
      />
      {FLAT_ROUTE.map((d, i) => (
        <path key={i} d={d} stroke="#a33b14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      ))}
      {FLAT_PINS.map((p) => (
        <g key={p.code}>
          <circle cx={p.x} cy={p.y} r="7" fill="#e6dac4" stroke="#a33b14" strokeWidth="1.6" />
          <circle cx={p.x} cy={p.y} r="2.6" fill="#a33b14" />
          <text x={p.x + 10} y={p.y - 8} className="flat-map__code">
            {p.code}
          </text>
        </g>
      ))}
      <rect x="0.5" y="0.5" width={MAP_VW - 1} height={MAP_VH - 1} fill="none" stroke="#1a1712" strokeOpacity="0.5" />
    </svg>
  );
}
