import type { NextConfig } from "next";

// GH_PAGES=1 builds a static mirror for GitHub Pages (served from /terra-trek-3d/).
// The default build (Vercel) is unchanged.
const pages = process.env.GH_PAGES === "1";
const base = "/terra-trek-3d";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BASE_PATH: pages ? base : "" },
  ...(pages
    ? {
        output: "export",
        basePath: base,
        assetPrefix: base,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        // Basic hardening (no CSP: the inline motion script would need a nonce, which forces dynamic rendering).
        // Static export has no server, so headers only apply on Vercel.
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
