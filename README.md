# Terra Trek — the route globe

A concept website for **Terra Trek**, a fictional slow-travel agency. Its signature moment is an interactive 3D globe:
as you scroll, the camera flies the agency's 42-day route between six cities along glowing great-circle arcs, while a
boarding-pass card for each city scrolls past.

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

- **Land from code.** Continents are hand-plotted lon/lat polygons (`src/components/globe/land.ts`). Up to 60 000
  points on a Fibonacci sphere are tested against them; land points become an `InstancedMesh` of tiny discs with a
  custom shader (day/night colour, warm city lights on the night side, a glow around the focused city).
- **Ocean & atmosphere.** One sphere shader draws night/day shading, a 15° graticule, a sun glint and a fresnel rim;
  a back-face sphere adds the halo.
- **Flight arcs.** Each leg is a great-circle path lifted by its length, turned into a `TubeGeometry`. An additive
  shader draws the tube from 0 to 1 with a bright head; a glowing point rides the active arc.
- **Scroll → camera.** Scroll becomes one number `p` (−1 hero, 0…5 cities, 6 outro). The camera slerps between
  city directions and climbs mid-leg; framing uses `camera.setViewOffset`, so the globe sits beside the cards on
  desktop and above them on phones without moving the scene.
- **Click a marker** on the globe to fly to that city's card (screen-space picking, 26 px radius).

### Performance

- `frameloop="demand"`; a continuous loop runs only while full motion is on, the stage is on screen and the tab is visible.
- Quality tier (low / medium / high) chosen before the canvas exists from the GPU name; `?quality=` overrides.
  DPR cap 1 / 1.5 / 2, adapted at runtime by `PerformanceMonitor`.
- The 3D chunk loads after the page's `load` event when the main thread is idle, and only if a tiny GPU probe finds
  a hardware renderer (software renderers keep the poster; `?quality=` forces 3D on). The scene is built in slices
  and shaders are warmed with `compileAsync` before the canvas fades in over a server-rendered SVG poster of the same globe.
- No textures, no per-frame allocations, no React state per frame, no `backdrop-filter` near the canvas.
- Reduced motion is respected by default, with a "Turn on full motion" toggle (remembered; `?motion=full|reduced`).
  Reduced motion cuts between cities instead of flying.
- Without WebGL2, on a software renderer, or after a lost context, the poster stays and the page works fully.

Measured with `npm run build`: First Load JS for `/` ≈ 143 KB gzip for modern browsers (182 KB counting the
`noModule` polyfill); the lazily loaded 3D chunk is ≈ 245 KB gzip.

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
src/app/                 layout, page, 404, OG image, icon, robots, sitemap, globals.css
src/components/          header pieces, poster, scroll director, stage loader
src/components/globe/    GlobeScene (three.js), GlobeCanvas (R3F host), land mask
src/lib/                 route data, quality tiers, motion preference, shared stage state
SPEC.md                  concept, design system, copy and budgets
```

## Credits

See [CREDITS.md](CREDITS.md). Fonts are SIL OFL; libraries are MIT/Apache-2.0; everything visual is drawn in code.

## Copyright

© 2026 Alhassan Alfarran. All rights reserved — see [LICENSE](LICENSE).
