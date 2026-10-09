/* ==========================================================================
   GLOBE POSTER — a server-rendered SVG of the same globe, used as
   (a) the first paint while the 3D warms up, and
   (b) the permanent fallback without WebGL or after a lost context.
   Dots come from the same land mask as the 3D globe, projected
   orthographically at build time, so the poster and the canvas match.
   ========================================================================== */

import { ARCS, C, DOTS, PINS, R } from "@/lib/poster";

export default function GlobePoster() {
  return (
    <div className="globe-poster">
      <svg viewBox="0 0 600 600" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="pg-ocean" cx="58%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#11304a" />
            <stop offset="60%" stopColor="#0b1a2c" />
            <stop offset="100%" stopColor="#060c17" />
          </radialGradient>
          <radialGradient id="pg-halo" cx="50%" cy="50%" r="50%">
            <stop offset="78%" stopColor="#7cc6d9" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#7cc6d9" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={C} cy={C} r={R * 1.17} fill="url(#pg-halo)" />
        <circle cx={C} cy={C} r={R} fill="url(#pg-ocean)" />
        <path d={DOTS} stroke="#c9d3dc" strokeOpacity="0.75" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        {ARCS.map((d, i) => (
          <path key={i} d={d} stroke="#ff9f43" strokeWidth="1.6" strokeLinecap="round" fill="none" strokeDasharray="1 4" />
        ))}
        {PINS.map((p) => (
          <g key={p.code}>
            <circle cx={p.xy[0]} cy={p.xy[1]} r="9" fill="none" stroke="#ff9f43" strokeOpacity="0.6" />
            <circle cx={p.xy[0]} cy={p.xy[1]} r="3.2" fill="#ff9f43" />
          </g>
        ))}
        <circle cx={C} cy={C} r={R} fill="none" stroke="#7cc6d9" strokeOpacity="0.35" />
      </svg>
    </div>
  );
}
