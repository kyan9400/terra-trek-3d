/* ==========================================================================
   GLOBE POSTER — a server-rendered SVG of the same globe, used as
   (a) the stage behind the loader curtain while the 3D warms up
       (seen directly with reduced motion or without JS), and
   (b) the permanent fallback without WebGL or after a lost context.
   The Earth itself is a small pre-rendered image of the same NASA Blue
   Marble map the 3D globe uses (public/textures/poster-globe.webp, drawn
   offline in the hero camera's perspective); night side, rim light and the
   route arcs are vector, projected at build time from the same camera, so
   the poster lines up with the canvas.
   ========================================================================== */

import { ARCS, C, NIGHT, PINS, R } from "@/lib/poster";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function GlobePoster() {
  return (
    <div className="globe-poster">
      <svg viewBox="0 0 600 600" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="pg-halo" cx="50%" cy="50%" r="50%">
            <stop offset={R / (R * 1.14)} stopColor="#8fd0ff" stopOpacity="0.5" />
            <stop offset="0.93" stopColor="#5aa6e6" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#5aa6e6" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pg-halo-side" x1="1" y1="0.2" x2="0" y2="0.8">
            <stop offset="0.25" stopColor="#fff" />
            <stop offset="0.75" stopColor="#fff" stopOpacity="0.25" />
          </linearGradient>
          <mask id="pg-halo-mask">
            <rect width="600" height="600" fill="url(#pg-halo-side)" />
          </mask>
          <linearGradient id="pg-dusk-side" x1="0" y1="0.6" x2="1" y2="0.4">
            <stop offset="0.1" stopColor="#fff" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="pg-dusk-mask">
            <rect width="600" height="600" fill="url(#pg-dusk-side)" />
          </mask>
          <radialGradient id="pg-rim" cx="50%" cy="50%" r="50%">
            <stop offset="0.78" stopColor="#7cc0ff" stopOpacity="0" />
            <stop offset="0.97" stopColor="#9bd2ff" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#cfeaff" stopOpacity="0.55" />
          </radialGradient>
          <radialGradient id="pg-limb" cx="50%" cy="50%" r="50%">
            <stop offset="0.6" stopColor="#020611" stopOpacity="0" />
            <stop offset="100%" stopColor="#020611" stopOpacity="0.5" />
          </radialGradient>
          <filter id="pg-twilight" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="pg-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <clipPath id="pg-disc">
            <circle cx={C} cy={C} r={R} />
          </clipPath>
        </defs>
        {/* atmosphere glow, strongest on the lit side */}
        <circle cx={C} cy={C} r={R * 1.14} fill="url(#pg-halo)" mask="url(#pg-halo-mask)" />
        <g clipPath="url(#pg-disc)">
          {/* the Earth: NASA Blue Marble with clouds, pre-rendered from the hero camera */}
          <image href={`${BASE}/textures/poster-globe.webp`} x={C - R} y={C - R} width={R * 2} height={R * 2} />
          {/* night side and limb */}
          <g fill="#02060f" fillRule="evenodd" filter="url(#pg-twilight)">
            <path d={NIGHT[0]} opacity="0.55" />
            <path d={NIGHT[1]} />
          </g>
          <circle cx={C} cy={C} r={R} fill="url(#pg-limb)" />
          <circle cx={C} cy={C} r={R} fill="url(#pg-rim)" mask="url(#pg-halo-mask)" />
        </g>
        {/* dusk scattering on the night limb */}
        <circle cx={C} cy={C} r={R + 2} fill="none" stroke="#e0763a" strokeOpacity="0.5" strokeWidth="7" mask="url(#pg-dusk-mask)" filter="url(#pg-glow)" />
        {/* the signature route */}
        {ARCS.map((d, i) => (
          <path key={i} d={d} stroke="#ff9f43" strokeWidth="1.6" strokeLinecap="round" fill="none" strokeDasharray="1 4" />
        ))}
        {PINS.map((p) => (
          <g key={p.code}>
            <circle cx={p.xy[0]} cy={p.xy[1]} r="8" fill="none" stroke="#ff9f43" strokeOpacity="0.7" />
            <circle cx={p.xy[0]} cy={p.xy[1]} r="3" fill="#ff9f43" />
          </g>
        ))}
      </svg>
    </div>
  );
}
