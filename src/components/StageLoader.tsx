"use client";

/* Starts the 3D only after the page has loaded and the main thread is idle,
   so the hero text paints first and the 3D download never competes with it.
   Then a tiny GPU probe (no three.js) decides whether the 3D is worth it at all:
   without WebGL2, or on a software renderer (SwiftShader, llvmpipe, …), the
   3D chunk is never requested and the server-rendered poster stays.
   ?quality=low|medium|high forces the 3D on. */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { probeQuality, type Probe } from "@/lib/quality";

const GlobeStage = dynamic(() => import("./GlobeStage"), { ssr: false, loading: () => null });

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export default function StageLoader() {
  const [probe, setProbe] = useState<Probe | null>(null);

  useEffect(() => {
    const w = window as IdleWindow;
    let idleId = 0;
    let timer = 0;
    const start = () => {
      const result = probeQuality();
      if (!result.webgl) {
        document.documentElement.dataset.globe = "failed";
      } else if (result.software && !result.forced) {
        document.documentElement.dataset.globe = "off";
      } else {
        setProbe(result);
      }
    };
    const schedule = () => {
      if (w.requestIdleCallback) idleId = w.requestIdleCallback(start, { timeout: 2500 });
      else timer = window.setTimeout(start, 1200);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idleId && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
      window.clearTimeout(timer);
    };
  }, []);

  return probe ? <GlobeStage probe={probe} /> : null;
}
