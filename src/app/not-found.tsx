import type { Metadata } from "next";
import Link from "next/link";
import { Arrow } from "@/components/icons";

export const metadata: Metadata = {
  title: "Off the map",
  description: "This page drifted off our routes.",
};

export default function NotFound() {
  return (
    <main className="lost" id="main">
      <div>
        <svg aria-hidden="true" width="120" height="120" viewBox="0 0 120 120" fill="none" style={{ margin: "0 auto" }}>
          <circle cx="60" cy="60" r="44" stroke="#7cc6d9" strokeOpacity="0.5" strokeWidth="1.5" />
          <circle cx="60" cy="60" r="30" stroke="#7cc6d9" strokeOpacity="0.25" strokeDasharray="2 6" />
          <path d="M60 22 68 60 60 98 52 60z" fill="#ff9f43" fillOpacity="0.9" />
          <path d="M60 60 68 60 60 98 52 60z" fill="#f2e9da" fillOpacity="0.85" />
          <circle cx="60" cy="60" r="4" fill="#0a0f1c" stroke="#ff9f43" strokeWidth="2" />
        </svg>
        <p className="eyebrow" style={{ marginTop: 24 }}>
          00°00′N 00°00′E · Null Island
        </p>
        <h1 className="display">
          Off the <em>map.</em>
        </h1>
        <p>This page drifted off our routes. Let’s get you back to familiar coordinates.</p>
        <div className="cta-row" style={{ justifyContent: "center" }}>
          <Link className="btn btn-ember" href="/">
            Back to the globe <Arrow />
          </Link>
        </div>
        <p style={{ marginTop: 48, fontSize: 14 }}>© 2026 Alhassan Alfarran · Concept project — fictional brand.</p>
      </div>
    </main>
  );
}
