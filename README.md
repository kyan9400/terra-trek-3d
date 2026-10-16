# Terra Trek — the route globe

A concept website for **Terra Trek**, a fictional slow-travel agency. Its signature moment is an interactive 3D globe:
as you scroll, the camera flies the agency's 42-day route between six cities along glowing great-circle arcs, while a
boarding-pass card for each city scrolls past — and at the end the globe unrolls into the printed route map.

Live: https://terra-trek-3d.vercel.app

> Concept project — fictional brand.

## Tech stack

- Next.js 16 (App Router, TypeScript strict, `src/` directory), React 19
- three.js 0.186 + React Three Fiber 9 + drei 10 (`PerformanceMonitor`)
- Lenis 1.3 for smooth scrolling (one smoothing layer)
- Tailwind CSS 4 (`@theme` tokens) + hand-written component CSS
- `next/font` (Newsreader, Hanken Grotesk, IBM Plex Mono)

GSAP and `@react-three/postprocessing` from the shared stack are intentionally **not installed**: scroll is mapped to
the camera with a few lines of math (no tweening needed), and the glow is done with additive shaders instead of a
bloom pass — less JavaScript and a cheaper GPU frame.

## The signature 3D technique

- **The real Earth.** The globe wears public-domain NASA imagery: the Blue Marble (topography and bathymetry, with
  an ocean mask so only water glitters), a gentle Black Marble city-light blend on the night side, and a subtle
  drifting layer from the Blue Marble cloud map that parts over each destination on the approach. The maps are
  packed offline into WebP (`public/textures/`, 2048 px on the high tier and 1024 px elsewhere, ≈0.9 MB for both
  sizes), loaded with the 3D chunk and decoded off the main thread (`createImageBitmap`). Close up, each city-light
  texel is split into points of light so cities read as clusters rather than blurred squares.
- **Ocean & atmosphere.** A uv grid wrapped into a sphere by its shader: night/day shading, a warm twilight band, a 15°
  graticule, a sun glint broken into glitter by value noise, a fresnel sky reflection; a thin front-face scattering
  shell plus a back-face halo.
- **Printed map from code.** Continents are also hand-plotted lon/lat polygons (`src/components/globe/land.ts`). Up to
  60 000 points on a Fibonacci sphere are tested against them; land points become one instanced draw of round SDF
  dots (alpha-to-coverage with MSAA) that grow in as halftone ink when the globe unrolls into the paper map.
- **Flight arcs.** Each leg is a camera-facing ribbon; the vertex shader rebuilds the lifted great-circle path, the
  fragment shader draws it from 0 to 1 with a bright head and a short contrail. A tiny chevron aircraft rides the
  tangent; light pillars mark the cities.
- **"Lights on" intro.** When the canvas is ready a loader curtain lifts, the terminator sweeps in, city lights switch
  on west → east, the markers pop in and the ghost route draws itself.
- **Scroll → camera.** Scroll becomes one number `p` (−1 hero, 0…5 cities, 6 outro, 7 map). The camera slerps between
  city directions and climbs mid-leg; framing uses `camera.setViewOffset`, so the globe sits beside the cards on
  desktop and above them on phones without moving the scene. Desktop: drag the hero globe to spin it.
- **The unroll.** From 6 to 7 the sphere peels open at the mid-Atlantic seam into a Pacific-centred flat map
  (`unroll.ts`, one formula in GLSL and TS), the camera swings round with a gentle dolly zoom and the palette turns
  from night to paper. Visitors without 3D get the same map as a server-rendered SVG.
- **Click a marker** on the globe to fly to that city's card (screen-space picking, 26 px radius).

### Performance

- `frameloop="demand"` always; an ambient ticker renders ~30 fps while full motion is on, the stage is on screen and
  the tab is visible, every frame for 1.5 s after scroll / pointer / intro activity, and 0 frames otherwise.
- Quality tier (low / medium / high) chosen before the canvas exists from the GPU name; `?quality=` overrides.
  DPR cap 1 / 1.5 / 2, adapted at runtime by `PerformanceMonitor`.
- The 3D chunk loads after the page's `load` event when the main thread is idle, and only if a tiny GPU probe finds
  a hardware renderer (software renderers keep the poster; `?quality=` forces 3D on). The scene is built in slices
  and shaders are warmed with `compileAsync` before the canvas fades in over a server-rendered SVG poster of the same
  globe (its Earth is a 50 KB pre-render of the same NASA map, from the hero camera).
- No per-frame allocations, no React state per frame, no `backdrop-filter` near the canvas.
  20 draw calls and about 80k triangles on the high tier.
- The 2D extras (section dots, reveals, magnetic buttons, cursor) are one module imported after `load` + idle; the
  hero headline reveal is CSS-only and transform-only, so the LCP text paints on the first frame.
- Full motion by default; the "Full motion" toggle (`aria-pressed`, remembered; `?motion=full|reduced`) switches
  to reduced motion. Reduced motion cuts between cities (and to the flat map) instead of flying.
- Without WebGL2, on a software renderer, or after a lost context, the poster stays and the page works fully.

Measured from the `npm run build` output: First Load JS for `/` ≈ 185 KB gzip counting the `noModule` polyfill
(+1.5 KB over the previous release); the lazily loaded 3D chunk is ≈ 253 KB gzip.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

Useful URL flags: `?quality=low|medium|high`, `?motion=full|reduced`.

## Project layout

```
src/app/                 layout, page, 404, OG image, icon, manifest, robots, sitemap, globals.css
src/components/          header pieces, poster, flat map, scroll director, stage loader, Polish (lazy 2D extras)
src/components/globe/    GlobeScene (three.js), GlobeCanvas (R3F host), NASA earth maps loader, land mask, terrain, unroll math
public/textures/         NASA Earth maps (WebP) and the poster's pre-rendered globe
src/lib/                 route data, quality tiers, motion preference, shared stage state
SPEC.md                  concept, design system, copy and budgets
```

## Credits

See [CREDITS.md](CREDITS.md). The Earth imagery is public-domain NASA data; fonts are SIL OFL; libraries are
MIT/Apache-2.0; everything else visual is drawn in code.

## Copyright

© 2026 Alhassan Alfarran. All rights reserved — see [LICENSE](LICENSE).
