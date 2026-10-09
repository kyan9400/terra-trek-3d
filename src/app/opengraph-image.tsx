import { ImageResponse } from "next/og";
import { ARCS, C, DOTS, PINS, R } from "@/lib/poster";

export const alt = "Terra Trek — Travel the long way round. A dotted night globe with ember flight arcs.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "radial-gradient(ellipse at 75% 45%, #143452 0%, #0a0f1c 60%)",
          color: "#f2e9da",
          fontFamily: "serif",
          position: "relative",
        }}
      >
        <svg
          width="640"
          height="640"
          viewBox="0 0 600 600"
          style={{ position: "absolute", right: -20, top: -5 }}
        >
          <circle cx={C} cy={C} r={R * 1.12} fill="#7cc6d9" fillOpacity="0.08" />
          <circle cx={C} cy={C} r={R} fill="#0d1d30" stroke="#7cc6d9" strokeOpacity="0.4" />
          <path d={DOTS} stroke="#c9d3dc" strokeOpacity="0.8" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          {ARCS.map((d, i) => (
            <path key={i} d={d} stroke="#ff9f43" strokeWidth="3" strokeLinecap="round" fill="none" />
          ))}
          {PINS.map((p) => (
            <circle key={p.code} cx={p.xy[0]} cy={p.xy[1]} r="5" fill="#ff9f43" />
          ))}
        </svg>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 72px", width: 640 }}>
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 6, color: "#ff9f43", fontFamily: "monospace" }}>
            TERRA TREK · SLOW ROUTES
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 96, lineHeight: 1, marginTop: 28 }}>
            <span>Travel the</span>
            <span style={{ color: "#ff9f43", fontStyle: "italic" }}>long way</span>
            <span>round.</span>
          </div>
          <div style={{ display: "flex", fontSize: 26, marginTop: 32, color: "#a9b4c4", fontFamily: "sans-serif" }}>
            Six cities · five flights · forty-two days
          </div>
        </div>
      </div>
    ),
    size,
  );
}
