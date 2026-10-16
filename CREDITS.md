# Credits

The globe's surface, clouds and city lights are real NASA imagery (public domain, listed below). Everything else
visual in this project — land dots, continent outlines, flight arcs, markers, atmosphere, stars, the poster's
vector layers, the favicon and all icons — is drawn in code written for this project. The Open Graph / Twitter
share image (`src/app/opengraph-image.png`, `twitter-image.png`) is a screenshot of this site's own hero.
There are no 3D models, HDRIs or audio files, and no runtime requests to third-party CDNs: the maps are served
from this site (`public/textures/`).

## NASA imagery (public domain — US Government work, NASA media usage guidelines)

NASA imagery is not copyrighted; it is credited here as NASA asks. The maps were resized and packed into WebP for
this site (colour + ocean mask; clouds + city lights), and `poster-globe.webp` is rendered from them in the hero
camera's perspective. NASA does not endorse this project.

| file(s) | source | credit |
|---|---|---|
| `earth-surface-*.webp`, `poster-globe.webp` (colour) | Blue Marble Next Generation, December, with topography & bathymetry — https://visibleearth.nasa.gov/images/73909 ; ocean colour from https://visibleearth.nasa.gov/images/74218 | NASA Earth Observatory / Reto Stöckli, NASA GSFC |
| `earth-surface-*.webp` (ocean mask) | Blue Marble land/ocean/ice map — https://visibleearth.nasa.gov/images/57730 | NASA GSFC |
| `earth-data-*.webp` (clouds), `poster-globe.webp` | Blue Marble clouds — https://visibleearth.nasa.gov/images/57747 | NASA GSFC |
| `earth-data-*.webp` (city lights) | Black Marble 2016 (0.1°) — https://earthobservatory.nasa.gov/features/NightLights (image record 144898) | NASA Earth Observatory / Joshua Stevens, Miguel Román, NASA GSFC (Suomi NPP VIIRS) |

Continent outlines (printed map and flat map) are hand-plotted longitude/latitude polygons (geographic facts,
deliberately coarse). Terrain heights (marker lift): hand-placed coordinates (geographic facts).
City coordinates and airport codes are public geographic facts. Terra Trek and all prices, statistics and
itineraries are fictional.

## Fonts (Google Fonts, self-hosted at build time by `next/font`)

| Font | Designer | License |
|---|---|---|
| Newsreader | Production Type | SIL Open Font License 1.1 |
| Hanken Grotesk | Alfredo Marco Pradil | SIL Open Font License 1.1 |
| IBM Plex Mono | Mike Abbink, Bold Monday | SIL Open Font License 1.1 |

## Code snippets

- Shader hash function adapted from "Hash without Sine" by David Hoskins (MIT License) — https://www.shadertoy.com/view/4djSRW

## npm libraries

| Package | License |
|---|---|
| next | MIT |
| react, react-dom | MIT |
| three | MIT |
| @react-three/fiber | MIT |
| @react-three/drei | MIT |
| lenis | MIT |
| tailwindcss, @tailwindcss/postcss | MIT |
| typescript | Apache-2.0 |
| eslint, eslint-config-next | MIT |
| @types/* | MIT |

Exact versions are pinned in `package.json` / `package-lock.json`.

## CC0 assets

None used.
