"use client";

/* Starts the 3D only after the page has loaded and the main thread is idle,
   so the hero text paints first and the 3D download never competes with it. */

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const GlobeStage = dynamic(() => import("./GlobeStage"), { ssr: false, loading: () => null });

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export default function StageLoader() {
  const [go, setGo] = useState(false);

  useEffect(() => {
    const w = window as IdleWindow;
    let idleId = 0;
    let timer = 0;
    const start = () => setGo(true);
    const schedule = () => {
      if (w.requestIdleCallback) idleId = w.requestIdleCallback(start, { timeout: 1500 });
      else timer = window.setTimeout(start, 200);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (idleId && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
      window.clearTimeout(timer);
    };
  }, []);

  return go ? <GlobeStage /> : null;
}
