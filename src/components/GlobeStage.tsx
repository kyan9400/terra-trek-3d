"use client";

/* Small client chunk: probes WebGL + GPU tier first, and only then downloads the heavy 3D chunk.
   Without WebGL (or after a lost context) nothing renders here and the server-rendered poster stays. */

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useState, type ReactNode } from "react";
import { probeQuality } from "@/lib/quality";

const GlobeCanvas = dynamic(() => import("./globe/GlobeCanvas"), { ssr: false, loading: () => null });

type State = "loading" | "ready" | "failed";

/* If the renderer cannot be created (driver blocklist, out of memory), fall back to the poster. */
class CanvasBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function GlobeStage() {
  const [probe] = useState(() => probeQuality());
  const [state, setState] = useState<State>(probe.webgl ? "loading" : "failed");

  useEffect(() => {
    document.documentElement.dataset.globe = state;
  }, [state]);

  const onReady = useCallback(() => setState("ready"), []);
  const onLost = useCallback(() => setState("failed"), []);

  if (state === "failed") return null;
  return (
    <div className="globe-canvas" data-tier={probe.tier}>
      <CanvasBoundary onError={onLost}>
        <GlobeCanvas tier={probe.tier} onReady={onReady} onLost={onLost} />
      </CanvasBoundary>
    </div>
  );
}
