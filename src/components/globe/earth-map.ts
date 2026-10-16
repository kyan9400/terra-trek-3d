/* ==========================================================================
   EARTH MAPS — real NASA imagery (public domain), packed offline into two
   equirectangular WebP maps per size (see CREDITS.md):
     earth-surface  rgb  Blue Marble colour (topography + bathymetry shading)
                    a    ocean mask (1 = water), for the sun glitter
     earth-data     r    Blue Marble clouds
                    g    Black Marble city lights
   Served from the site itself and loaded with the 3D chunk (never on the
   critical path). createImageBitmap decodes them off the main thread with
   straight alpha and no colour conversion: the shaders read raw values.
   u = 0 is lon −180°, v = 0 is the south pole (the globe's vTex layout).
   ========================================================================== */

import * as THREE from "three";

export type EarthMaps = { surface: THREE.Texture; data: THREE.Texture };

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function loadMap(file: string): Promise<THREE.Texture> {
  const loader = new THREE.ImageBitmapLoader();
  loader.setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none" });
  return loader.loadAsync(`${BASE}/textures/${file}`).then((bitmap: ImageBitmap) => {
    const tex = new THREE.Texture(bitmap);
    tex.flipY = false; // already flipped by createImageBitmap
    tex.colorSpace = THREE.NoColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  });
}

/** width: 2048 (high tier) or 1024. Resolves to null if a download fails. */
export function loadEarthMaps(width: number): Promise<EarthMaps | null> {
  return Promise.all([loadMap(`earth-surface-${width}.webp`), loadMap(`earth-data-${width}.webp`)]).then(
    ([surface, data]) => ({ surface, data }),
    () => null,
  );
}
