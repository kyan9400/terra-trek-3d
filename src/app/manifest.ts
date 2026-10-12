import type { MetadataRoute } from "next";

// "" on Vercel, "/terra-trek-3d" on the GitHub Pages mirror
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Terra Trek — Travel the long way round",
    short_name: "Terra Trek",
    description: "Concept project: slow, small-group and private journeys on an interactive route globe.",
    start_url: `${base}/`,
    display: "standalone",
    theme_color: "#0a0f1c",
    background_color: "#0a0f1c",
    icons: [{ src: `${base}/icon.svg`, sizes: "any", type: "image/svg+xml" }],
  };
}
