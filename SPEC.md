# Terra Trek — SPEC

## 1. Concept

**Terra Trek** is a fictional slow-travel agency based in Lisbon. It designs small-group and private journeys that link a
handful of extraordinary places with fewer flights, longer stays and local guides. The site sells one idea: *the long way
round*. Its signature product is a 42-day route through six cities, and the site lets you fly that route on a 3D globe.

Look and feel: a **night-flight cockpit meets a travel journal**. The top of the page is a dark night sky with a dotted,
sun-lit globe and ember-coloured flight arcs; the lower half turns into warm paper, like the printed route map the agency
mails to travellers. Serif display type with italics, a clean grotesque for reading, and a monospace for airport codes and
coordinates (boarding-pass detail).

## 2. Audience

- Curious, time-rich travellers (35–65) who want depth over box-ticking and are willing to pay for it.
- People planning a sabbatical or a once-in-a-decade trip; they browse on phones in the evening, decide on laptops.
- Studio portfolio visitors (creative directors, recruiters) who should remember the globe.

## 3. Sections (in order)

1. **Header** — wordmark, anchor links (Routes, Approach, Ways to go, Questions), "Plan a route" CTA, motion toggle.
2. **Hero** — headline, intro, two CTAs, four stats. Globe sits to the right (desktop) / above (mobile), slowly turning.
3. **Routes (signature)** — "The Long Way Round": six city cards scroll past; the camera flies each leg on the globe,
   then the globe unrolls into the printed route map and the outro panel arrives on it.
4. **Approach** — four numbered steps of how a route is designed.
5. **Ways to go** — three products with prices and inclusions.
6. **Field principles** — four numbers that explain how the agency travels.
7. **Questions** — five FAQs (native `<details>`).
8. **Plan** — closing CTA.
9. **Footer** — disclaimer, copyright, credit.

## 4. Signature 3D moment — the route globe

**What you see.** A night-blue globe made of ~6k–17k round land dots (continents plotted in code from hand-made
lon/lat outlines), with hand-placed terrain relief (Himalaya, Andes, Rockies, Alps, Atlas, East African highlands,
Southern Alps, Japanese Alps, Iceland, the Greenland ice dome): high ground lifts, grows a little, shades its slopes
against the sun and turns snow-white on the day side. A soft cartographic graticule on the ocean, a sun glint broken
into a glitter path, a fresnel sky reflection, a warm twilight band along the terminator, a thin scattering shell and a
back-face halo. On the night side, metro areas light up (~80 hand-listed cities), so Europe, Japan and the US East Coast
read at night. Six destinations carry pulsing ring markers with thin light pillars (they read even at the limb). Ember
arcs (real great-circle paths lifted by distance) connect them in route order. Stars include a faint Milky Way band.

**Intro — "lights on".** When the canvas is ready, a loader curtain behind the hero text lifts and, over 1.8 s, the
terminator sweeps in from the night side, city lights switch on in a west → east wave, the six markers pop in one after
another and the ghost route draws itself from Reykjavík. Reduced motion: everything is on at once.

**What scroll does.** The canvas is fixed behind the hero and the Routes section. Scroll position is turned into one
continuous number `p` (−1 = hero, 0…5 = city cards, 6 = outro, 7 = flat map):
- hero → first card: the camera leaves its slow orbit and descends to Reykjavík (desktop: drag the hero globe to spin
  it, with inertia that decays in ~1.2 s; never on touch, so it cannot fight scrolling);
- between cards: the camera flies a great-circle path to the next city, climbing mid-leg (distance curve `sin(πt)`);
  the active arc draws itself in sync with a short contrail, a tiny chevron aircraft rides the tangent over a glow;
- outro: the camera pulls back to show the whole route lit;
- **6 → 7, the unforgettable moment: the globe unrolls into the printed route map.** The sphere peels open at the
  mid-Atlantic seam (lon −45°) into a Pacific-centred 2:1 equirectangular map, so all five legs stay continuous. The
  camera swings east over Africa and the Indian Ocean to face the map while the field of view narrows 34° → 26° (a
  gentle dolly zoom), the view offset centres, and the palette turns from night to paper: ocean → sand, land → ink
  dots, arcs → solid rust lines, markers → rust rings; stars and atmosphere fade out. A paper backdrop behind the
  transparent canvas fades in, and the perforated top edge of the Approach section continues the paper.
Land dots near the focused city brighten (focus uniform). Clicking a marker scrolls to that city's card (screen-space
picking with a 26 px radius → ≥ 44 px tap target).

**Technique.** React Three Fiber canvas (`frameloop="demand"`), scene built imperatively in plain three.js
(`GlobeScene` class): land dots are one instanced draw of 4-vertex quads shaded as SDF discs (alpha-to-coverage with
MSAA, discard without); the ocean is a uv grid wrapped into a sphere by its vertex shader; arcs are camera-facing
ribbons that rebuild the lifted great-circle path in the vertex shader; markers are shader quads, pillars one
instanced cylindrical billboard draw. The unroll formula lives in `unroll.ts` twice — as GLSL for the ocean, dot and
arc vertex shaders and as a TS twin for markers, aircraft and picking. Terrain heights, slopes and metro lights are
precomputed per dot (`terrain.ts`) while the scene is built in slices. Camera framing uses `setViewOffset` so the globe
sits beside the cards without moving the 3D scene. Scroll is read by one Lenis instance (`lerp 0.1`) — the camera maps
scroll directly (no second smoothing layer).

**Quality tiers** (decided before the Canvas exists; GPU name via `WEBGL_debug_renderer_info`; `?quality=` overrides):

| tier | DPR cap | land samples (≈ dots) | ocean seg | dot AA | ocean noise | city lights | pillars | aircraft | stars |
|---|---|---|---|---|---|---|---|---|---|
| high | 2 | 60 000 (≈ 17.6k) | 160×112 | alpha-to-coverage | 2 octaves | metro clusters + flicker | yes | chevron + glow | 2 400, twinkle |
| medium | 1.5 | 36 000 (≈ 10.6k) | 128×96 | alpha-to-coverage | 1 octave | metro clusters | yes | chevron + glow | 1 200 |
| low | 1 | 20 000 (≈ 5.9k) | 96×64 | discard | none | off | yes | glow point | 500 |

Ambient Lisbon arcs on high and medium. The unroll runs on every tier. The optional cloud shell was left out: it would
push the high tier past its triangle budget.

Software renderers (SwiftShader, llvmpipe, softpipe, Microsoft Basic Render, or a context that fails
`failIfMajorPerformanceCaveat`) → no 3D at all: the 3D chunk is never requested and the poster stays (`?quality=` still
forces the 3D on). Intel/AMD integrated, Mali, Adreno, PowerVR, touch devices → at most medium. drei
`<PerformanceMonitor>` (mounted only during full-rate phases) steps DPR down on decline and back up on incline.

**Render loop.** Always `frameloop="demand"`. While full motion is on, the stage is on screen and the tab is visible,
an ambient ticker asks for ~30 fps (the globe turns, arcs flow, markers pulse); for 1.5 s after any scroll, pointer
move, drag or the intro it renders every frame (`stage.wake()`). Off stage, hidden tab or reduced motion with nothing
moving: 0 frames. The scene is built in slices (the land-dot sampling yields to the main thread every few thousand
samples) and shaders compile with `gl.compileAsync` behind the loader curtain before the canvas is revealed.

**Reduced motion** (OS setting respected by default; "Full motion" toggle in the header with `aria-pressed`, stored in
localStorage, `?motion=full|reduced` overrides): no autonomous rotation, no pulsing, no flowing dashes, no pointer
parallax, no intro, no loader curtain, no 2D reveals / magnetic buttons / custom cursor. The camera **cuts** to the city
whose card is closest to the viewport centre instead of flying; passed arcs are drawn complete; the globe cuts to the
flat map past `p = 6.5`.

**No WebGL / context lost.** A code-made SVG poster (globe disc, dotted land, dotted route, pins) is rendered by the
server behind the canvas; it stays if WebGL is missing, the renderer is software-only, or the context is lost. The
unroll block also carries a server-rendered SVG of the flat route map (same projection, halftone land rows, rust route,
labelled pins; `role="img"` with a label), so every visitor ends on the printed map. The page is fully usable without 3D.

## 5. Design system

**Palette**

| token | hex | use |
|---|---|---|
| `night` | `#0A0F1C` | page background (top), text on ember |
| `night-2` | `#0E1A2B` | ocean, raised dark surfaces |
| `panel` | `rgba(13,22,38,0.88)` | cards over the canvas (solid tint, never backdrop-filter) |
| `line` | `#24344D` | hairlines on dark |
| `sand` | `#F2E9DA` | text on dark, paper background, the 3D map's backdrop |
| `sand-2` | `#E6DAC4` | paper raised surfaces, the 3D map's ocean |
| `mist` | `#A9B4C4` | secondary text on dark (≈ 9:1 on night) |
| `ink` | `#1A1712` | text on paper, land dots on the map |
| `ink-2` | `#5A5246` | secondary text on paper (≈ 6.4:1) |
| `ember` | `#FF9F43` | arcs, primary buttons, accents on dark, progress bar, cursor |
| `rust` | `#A33B14` | accent text on paper (≈ 5.4:1), route on the map |
| `glacier` | `#7CC6D9` | atmosphere, secondary accent on dark |

**Fonts** (Google Fonts, SIL OFL, self-hosted by `next/font`): *Newsreader* (display, 400 + italic),
*Hanken Grotesk* (body/UI, variable), *IBM Plex Mono* (codes, coordinates, labels, 400/500). Only the two hero fonts
are preloaded; no extra weights, no `opsz` axis.

**Type scale**: 12 / 14 / 16 / 18 / 22 / 28 / 40 / 56 / 88 / 136 px (display sizes fluid with `clamp`; the hero
headline is up to 8.5 rem, line-height 0.9, tracking −0.025 em, max 10 ch). Headings use `text-wrap: balance`,
paragraphs `pretty`; numbers are tabular lining figures. Eyebrows carry a 24 px ember hairline.

**Spacing scale** (4 px base): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192. Sections use 96–192 vertical rhythm,
16 px phone gutter, 32–64 px desktop gutter, max content width 1240 px.

**Radius**: 4 (stamps, map), 6 (chips), 14 (cards), 999 (pills). **Focus**: 3 px ember outline + 3 px offset on dark,
rust on paper.

**Motion (2D)**, transform and opacity only:
- Hero: a CSS-only split-line reveal — each headline line rises 45 % inside its own clip, no opacity, so the headline
  (the LCP) is painted on the first frame; eyebrow, intro, CTAs and the stats strip fade up after it.
- A loader curtain (night fill, ember horizon line, static mono `ACQUIRING ROUTE…` label; no animated counter, transform/opacity only; dropped after 12 s if the 3D never gets ready) covers only the stage layer,
  behind the text, and lifts like a curtain when the 3D is ready; removed instantly when the poster stays.
- A 2 px ember scroll-progress bar under the header; six section dots on the left edge (desktop, fine pointer) — real
  links with 44 px hit areas, the active one an ember pill (`aria-current`), mono labels on hover / focus.
- Hero stats as a boarding-pass strip (four cells, 1 px rules, Plex Mono labels) and a mono flight strip.
- Night → paper hand-off: a perforated top edge on the Approach section.
- Loaded after `load` + idle in one lazy module (`Polish.tsx`), full motion + fine pointer only: section reveals
  (rise 24 px + fade, 70 ms stagger, gated by `html.has-reveal` so nothing is hidden without it), magnetic buttons
  (≤ 6 px), a dot + easing ring cursor that grows to "FLY" over globe markers.
- Featured plan: ember outline and a rotated mono "stamp" badge; plans lift 4 px on hover; FAQ `+` turns into `×`.

## 6. Final copy

### Header
Wordmark "Terra Trek". Links: Routes · Approach · Ways to go · Questions. Button: "Plan a route". Toggle: "Full motion"
(a switch with `aria-pressed`). Skip link: "Skip to content".

### Hero
- Eyebrow: `TERRA TREK · SLOW ROUTES SINCE 2014 · LISBON`
- H1: "Travel the *long way* round."
- Intro: "We design small-group and private journeys that link a few extraordinary places with fewer flights, longer
  stays and local people who know every back road. Scroll down and fly our signature route."
- CTAs: "Fly the route" (→ #routes), "Plan a journey" (→ #plan)
- Stats: "38 — countries routed" · "4.6 — nights, average stay per stop" · "12 — travellers, largest group" ·
  "62% — legs by rail, road or sea"

### Routes
- Eyebrow: `SIGNATURE ROUTE · 2027 SEASON`
- H2: "The Long Way Round"
- Intro: "Six cities, five flights, forty-two days. Every arc on the globe is a true great-circle path — scroll and the
  camera flies each leg with you."
- Cards (H3 = city; leg line generated from coordinates: "Leg n of 5 · AAA → BBB · distance · est. flight time"):
  1. **Reykjavík**, Iceland · KEF · Days 1–6 — "Start where the plates pull apart." — "Soak in a geothermal lagoon at
     midnight, then walk the rift valley at Þingvellir with a geologist who grew up on the farm next door." —
     Rift-valley walk · Northern-lights watch · Westfjords fish supper
  2. **Marrakech**, Morocco · RAK · Days 7–13 — "Lose the map in the medina." — "A riad behind an unmarked door, a dawn
     spice run with a third-generation trader, and two nights under canvas in the Agafay hills." — Medina at dawn ·
     Atlas foothill trek · Desert camp
  3. **Cape Town**, South Africa · CPT · Days 14–20 — "Two oceans, one table." — "Climb Lion's Head for sunrise, cook
     with a Bo-Kaap family and drive the peninsula to where the Atlantic meets the Indian Ocean." — Lion's Head sunrise ·
     Bo-Kaap kitchen · Cape Point drive
  4. **Kyoto**, Japan · KIX · Days 21–28 — "Quiet hours in an old capital." — "Walk Fushimi before the crowds, learn to
     pack a bento with a ryokan chef and take the slow train into the cedar valleys of Kurama." — Fushimi at first
     light · Ryokan kitchen · Kurama forest trail
  5. **Queenstown**, New Zealand · ZQN · Days 29–35 — "Mountains that make you go quiet." — "Kayak Milford Sound at first
     light, walk a section of the Routeburn with a local guide and sleep at a high-country sheep station." — Milford
     Sound kayak · Routeburn day walk · Sheep-station stay
  6. **Cusco**, Peru · CUZ · Days 36–42 — "Finish above the clouds." — "Acclimatise in the Sacred Valley, trek the
     quieter Lares trail with Quechua weavers and reach Machu Picchu on the first morning bus." — Sacred Valley ·
     Lares trail · Machu Picchu at opening
- Outro (at the end of the unroll block, on the printed map): "42 days · 5 flights · {total} km." — "Long legs, long stays. Every flight on the route is matched with
  twice its carbon in verified removal." Link: "See ways to travel it" (→ #ways)

### Approach
- Eyebrow: `HOW WE ROUTE` — H2: "Every journey starts with a map and a long conversation."
- 01 **Listen** — "A 45-minute call with a route designer. We ask what you want to feel, not only where you want to go."
- 02 **Route** — "We sketch three possible lines across the map, each with honest trade-offs: time, cost, flights and pace."
- 03 **Ground** — "Every stop is run by people who live there. We pay guides above local rates and publish what they earn."
- 04 **Return** — "Back home, you get a printed map of the trip you actually took — detours, wrong turns and all."

### Ways to go
- Eyebrow: `WAYS TO GO` — H2: "Three ways to travel with us"
- **Wayfarer** · Self-guided · "from $3,900 per person · 14 days" — Hand-drawn route and daily notes · Rail and ferry
  legs booked for you · 24/7 local contact line
- **Expedition** · Small group, max 12 · "from $8,400 per person · 21 days" — Expert leader throughout · All stays and
  most meals · Carbon removal included (badge: "Most booked")
- **The Long Way Round** · Private · "from $24,800 per person · 42 days" — Private guides in all six cities · Any start
  date, any direction · A route designer on call
- Button per card: "Ask about {name}" (→ #plan)

### Field principles
- Eyebrow: `FIELD PRINCIPLES` — H2: "Fewer flights. Longer stays. Fair pay."
- "62%" — "of our legs travel by rail, road or sea."
- "4.6" — "nights, our average stay per stop."
- "100%" — "of guides paid at or above living-wage benchmarks."
- "2×" — "carbon removal for every flight we book."

### Questions
- H2: "Good questions"
- *How fit do I need to be?* — "If you can walk 10 km on a mixed path, you can do every route we run. Harder options
  (Lares, the Routeburn) always have a gentler alternative on the same day."
- *Can I start the route somewhere else?* — "Yes. The Long Way Round is a loop on paper; privately, we can start in any
  of the six cities and fly it in either direction."
- *What is included in the price?* — "Stays, guides, every ground and rail leg, most meals and carbon removal. Long-haul
  flights are quoted separately so you can use your own miles."
- *How do you handle flight emissions?* — "We measure each flight, then buy twice that amount in verified removal — not
  avoidance credits — and send you the certificates."
- *Can I travel solo?* — "Many of our travellers do. Expedition groups have no single supplement on shared-room dates."

### Plan
- H2: "Where should your line *begin*?"
- Body: "Tell us a city you have always wanted to wake up in. A route designer replies within two working days with a
  first sketch — free and without obligation."
- Button: "Start a route" (mailto) · Secondary text: "Or fly the signature route again" (→ #routes)

### Footer
"Terra Trek" · "Concept project — fictional brand." · "© 2026 Alhassan Alfarran" · "Design & development: Alhassan
Alfarran" (→ portfolio) · GitHub link.

### 404
H1 "Off the map." — "This page drifted off our routes. Let's get you back to familiar coordinates." — Button "Back to
the globe". Coordinates line `00°00′N 00°00′E · NULL ISLAND`.

## 7. Assets & licenses

| asset | source | license |
|---|---|---|
| Globe, land dots, arcs, markers, atmosphere, stars | written in code (`src/components/globe/*`) | own work |
| Continent outlines | hand-plotted lon/lat polygons in code (geographic facts) | own work |
| No-WebGL poster | inline SVG in code | own work |
| OG image | static PNG screenshot of the live hero (`opengraph-image.png`) | own work |
| Favicon | `src/app/icon.svg` | own work |
| Newsreader, Hanken Grotesk, IBM Plex Mono | Google Fonts via `next/font` | SIL OFL 1.1 |

Zero downloaded images, models, HDRIs or audio. No runtime CDN requests.

## 8. Performance budget

- First-load JS for `/` < 250 KB gzip, excluding the lazily loaded 3D chunk (target ≈ 150 KB). New 2D effects live in
  one module imported after `load` + idle, so the first-load bundle stays within 2 KB of the pre-upgrade build.
- 3D chunk (three + R3F + scene) loaded with `next/dynamic({ ssr: false })` only after window `load` +
  `requestIdleCallback` (2.5 s timeout) and the GPU probe, never during hydration; ≈ 255 KB gzip (≤ 270 KB).
- No textures at all (everything procedural); draw calls < 25 (20 on high); ≤ 80k triangles on high.
- Idle hero ≤ 30 fps, paper sections 0 frames; full rate only for 1.5 s after activity.
- No per-frame allocations, no React state per frame; card highlighting updates the DOM only when the index changes.
- Fonts: 3 families, `display: swap`, mono not preloaded.
- LCP element is the hero heading (server-rendered HTML, painted on the first frame; its reveal is transform-only);
  the canvas is revealed after shader warm-up. The poster SVG uses integer coordinates to keep the HTML small.
- Security headers: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` (no CSP: the inline motion
  script would need a nonce, which forces dynamic rendering).
- PageSpeed mobile: Performance ≥ 95 (LCP < 2.5 s, CLS 0), Accessibility / Best Practices / SEO 100.
