import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const display = Newsreader({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const code = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-code",
  display: "swap",
  preload: false,
});

const title = "Terra Trek — Travel the long way round";
const description =
  "Slow, small-group and private journeys that link a few extraordinary places with fewer flights and longer stays. Fly our 42-day signature route on an interactive globe.";

// The GitHub Pages mirror resolves OG images on its own host; canonical always points at Vercel
const pages = Boolean(process.env.NEXT_PUBLIC_BASE_PATH);
const canonical = "https://terra-trek-3d.vercel.app/";

export const metadata: Metadata = {
  metadataBase: new URL(pages ? "https://kyan9400.github.io" : "https://terra-trek-3d.vercel.app"),
  title: { default: title, template: "%s · Terra Trek" },
  description,
  applicationName: "Terra Trek",
  authors: [{ name: "Alhassan Alfarran", url: "https://alhassan-portfolio-sigma.vercel.app" }],
  creator: "Alhassan Alfarran",
  keywords: ["slow travel", "small-group journeys", "private travel", "route planning", "3D globe"],
  alternates: { canonical: pages ? canonical : "/" },
  openGraph: {
    type: "website",
    url: pages ? canonical : "/",
    siteName: "Terra Trek",
    title,
    description,
    locale: "en_GB",
  },
  twitter: { card: "summary_large_image", title, description },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0f1c",
  width: "device-width",
  initialScale: 1,
};

// Runs before first paint so CSS and the 3D agree on the motion setting from the start
const motionScript = `try{var q=new URLSearchParams(location.search).get("motion"),s=null;try{s=localStorage.getItem("terra-trek-motion")}catch(e){}var c=q==="full"||q==="reduced"?q:s,r=c==="full"?false:c==="reduced"?true:matchMedia("(prefers-reduced-motion: reduce)").matches;if(r)document.documentElement.classList.add("reduce-motion")}catch(e){}`;

// WebSite structured data only: the brand is fictional, so no agency / offer markup
const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Terra Trek",
  url: "https://terra-trek-3d.vercel.app/",
  description: "Terra Trek is a concept project: a fictional slow-travel agency with an interactive 3D route globe.",
  inLanguage: "en-GB",
  author: { "@type": "Person", name: "Alhassan Alfarran" },
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${code.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
