import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://terra-trek-3d.vercel.app/", lastModified: new Date("2026-10-12"), priority: 1 }];
}
