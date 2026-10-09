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

export const metadata: Metadata = {
  metadataBase: new URL("https://terra-trek-3d.vercel.app"),
  title: { default: title, template: "%s · Terra Trek" },
  description,
  applicationName: "Terra Trek",
  authors: [{ name: "Alhassan Alfarran", url: "https://alhassan-portfolio-sigma.vercel.app" }],
  creator: "Alhassan Alfarran",
  keywords: ["slow travel", "small-group journeys", "private travel", "route planning", "3D globe"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${code.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
