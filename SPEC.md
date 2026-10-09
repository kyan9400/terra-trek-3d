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
3. **Routes (signature)** — "The Long Way Round": six city cards scroll past; the camera flies each leg on the globe.
4. **Approach** — four numbered steps of how a route is designed.
5. **Ways to go** — three products with prices and inclusions.
6. **Field principles** — four numbers that explain how the agency travels.
7. **Questions** — five FAQs (native `<details>`).
8. **Plan** — closing CTA.
9. **Footer** — disclaimer, copyright, credit.

## 4. Signature 3D moment — the route globe

**What you see.** A night-blue globe made of ~6k–17k land dots (continents plotted in code from hand-made lon/lat
outlines), a soft cartographic graticule on the ocean, a sun-lit day side with a terminator, warm "city light" sparks on
the night side, a fresnel atmosphere halo and a star field. Six destinations carry pulsing ring markers. Ember arcs (real
great-circle paths lifted by distance) connect them in route order.

**What scroll does.** The canvas is fixed behind the hero and the Routes section. Scroll position is turned into one
continuous number `p` (−1 = hero, 0…5 = city cards, 6 = outro):
- hero → first card: the camera leaves its slow orbit and descends to Reykjavík;
- between cards: the camera flies a great-circle path to the next city, climbing mid-leg (distance curve `sin(πt)`);
  the active arc draws itself in sync, with a glowing "aircraft" head travelling along it;
- outro: the camera pulls back to show the whole route lit.
Land dots near the focused city brighten (focus uniform). Clicking/tapping a marker scrolls to that city's card
(screen-space picking with a 24 px radius → ≥ 44 px tap target).

**Technique.** React Three Fiber canvas (`frameloop="demand"`), scene built imperatively in plain three.js
(`GlobeScene` class): `InstancedMesh` dots with a custom shader, a `ShaderMaterial` ocean, additive `TubeGeometry` arcs
with a draw-progress shader, an additive back-face atmosphere, `Points` stars. Camera framing uses `setViewOffset` so the
globe sits beside the cards without moving the 3D scene. Scroll is read by one Lenis instance (`lerp 0.1`) — the camera
maps scroll directly (no second smoothing layer).

**Quality tiers** (decided before the Canvas exists; GPU name via `WEBGL_debug_renderer_info`; `?quality=` overrides):

| tier | DPR cap | land samples (≈ dots) | stars | antialias | extras |
|---|---|---|---|---|---|
| high | 2 | 60 000 (≈ 17k) | 2 400 | yes | twinkling stars, ambient arcs, city lights |
| medium | 1.5 | 36 000 (≈ 10k) | 1 200 | yes | city lights |
| low | 1 | 20 000 (≈ 6k) | 500 | no | static stars, no ambient arcs |

Software renderers → low; Intel/AMD integrated, Mali, Adreno, PowerVR, touch devices → at most medium. drei
`<PerformanceMonitor>` steps DPR down on decline and back up on incline.

**Render loop.** Continuous only while the stage is on screen, the tab is visible and full motion is on (the arcs flow,
markers pulse, the globe turns). Otherwise on-demand: scroll / resize call `invalidate()`. Shaders compile with
`gl.compileAsync` before the canvas fades in over the poster.

**Reduced motion** (OS setting respected by default; "Turn on full motion" toggle in the header, stored in localStorage,
`?motion=full|reduced` overrides): no autonomous rotation, no pulsing, no flowing dashes, no pointer parallax. The camera
**cuts** to the city whose card is closest to the viewport centre instead of flying; passed arcs are drawn complete.

**No WebGL / context lost.** A code-made SVG poster (globe disc, graticule, dotted route, six labelled pins) is rendered by
the server behind the canvas; it stays if WebGL is missing or the context is lost. The page is fully usable without 3D.

## 5. Design system

**Palette**

| token | hex | use |
|---|---|---|
| `night` | `#0A0F1C` | page background (top), text on ember |
| `night-2` | `#0E1A2B` | ocean, raised dark surfaces |
| `panel` | `rgba(13,22,38,0.88)` | cards over the canvas (solid tint, never backdrop-filter) |
| `line` | `#24344D` | hairlines on dark |
| `sand` | `#F2E9DA` | text on dark, paper background |
| `sand-2` | `#E6DAC4` | paper raised surfaces |
| `mist` | `#A9B4C4` | secondary text on dark (≈ 9:1 on night) |
| `ink` | `#1A1712` | text on paper |
| `ink-2` | `#5A5246` | secondary text on paper (≈ 6.4:1) |
| `ember` | `#FF9F43` | arcs, primary buttons, accents on dark |
| `rust` | `#A33B14` | accent text on paper (≈ 5.4:1) |
| `glacier` | `#7CC6D9` | atmosphere, secondary accent on dark |

**Fonts** (Google Fonts, SIL OFL, self-hosted by `next/font`): *Newsreader* (display, 400 + italic),
*Hanken Grotesk* (body/UI, variable), *IBM Plex Mono* (codes, coordinates, 400/500).

**Type scale**: 12 / 14 / 16 / 18 / 22 / 28 / 40 / 56 / 80 / 112 px (display sizes fluid with `clamp`).

**Spacing scale** (4 px base): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192. Sections use 96–192 vertical rhythm,
16 px phone gutter, 32–64 px desktop gutter, max content width 1240 px.

**Radius**: 6 (chips), 14 (cards), 999 (pills). **Focus**: 3 px ember outline + 3 px offset on dark, rust on paper.

## 6. Final copy

### Header
Wordmark "Terra Trek". Links: Routes · Approach · Ways to go · Questions. Button: "Plan a route". Toggle: "Reduce motion" /
"Turn on full motion". Skip link: "Skip to content".

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
- Outro: "42 days · 5 flights · {total} km." — "Long legs, long stays. Every flight on the route is matched with
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
| OG image | `next/og` `ImageResponse` | own work |
| Favicon | `src/app/icon.svg` | own work |
| Newsreader, Hanken Grotesk, IBM Plex Mono | Google Fonts via `next/font` | SIL OFL 1.1 |

Zero downloaded images, models, HDRIs or audio. No runtime CDN requests.

## 8. Performance budget

- First-load JS for `/` < 250 KB gzip, excluding the lazily loaded 3D chunk (target ≈ 150 KB).
- 3D chunk (three + R3F + scene) loaded after hydration with `next/dynamic({ ssr: false })`; ≈ 250 KB gzip.
- No textures at all (everything procedural); draw calls < 25; ≤ 80k triangles on high.
- No per-frame allocations, no React state per frame; card highlighting updates the DOM only when the index changes.
- Fonts: 3 families, `display: swap`, mono not preloaded.
- LCP element is the hero heading (server-rendered HTML); the canvas fades in over the poster after shader warm-up.
- Lighthouse mobile: Performance ≥ 85, Accessibility / Best Practices / SEO ≥ 95.
