"use client";

/* ==========================================================================
   GLOBE CANVAS — React Three Fiber host for GlobeScene.
   - frameloop "demand": a frame only renders when invalidate() is called.
     The loop switches to "always" only while something animates on its own
     (full motion + stage on screen + tab visible).
   - DPR starts at the tier cap; PerformanceMonitor (only mounted while the
     loop runs, so idle frames are not mistaken for slow ones) lowers it on
     decline and raises it again on incline.
   - The scene is built in slices (yielding between heavy steps), then its
     shaders are compiled with compileAsync before the canvas fades in.
   ========================================================================== */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useEffect, useState, useSyncExternalStore } from "react";
import type * as THREE from "three";
import { TIERS, type Tier, type TierSettings } from "@/lib/quality";
import { isReducedMotion, subscribeMotion } from "@/lib/motion";
import { stage, subscribeStage } from "@/lib/stage";
import { GlobeScene, yieldToMain } from "./GlobeScene";

function subscribeLoop(cb: () => void) {
  const offMotion = subscribeMotion(cb);
  const offStage = subscribeStage(cb);
  document.addEventListener("visibilitychange", cb);
  return () => {
    offMotion();
    offStage();
    document.removeEventListener("visibilitychange", cb);
  };
}
const loopSnapshot = () => !isReducedMotion() && stage.visible && document.visibilityState === "visible";
const loopServerSnapshot = () => false;

function useLooping() {
  return useSyncExternalStore(subscribeLoop, loopSnapshot, loopServerSnapshot);
}

type WorldProps = { settings: TierSettings; looping: boolean; onReady: () => void };

function World({ settings, looping, onReady }: WorldProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const [world, setWorld] = useState<GlobeScene | null>(null);

  // Build off the critical path: in slices, never in one long task
  useEffect(() => {
    let alive = true;
    let made: GlobeScene | null = null;
    void GlobeScene.create(settings, () => alive).then((w) => {
      if (!w) return;
      if (!alive) {
        w.dispose();
        return;
      }
      made = w;
      scene.add(w.root);
      setWorld(w);
    });
    return () => {
      alive = false;
      made?.dispose();
    };
  }, [scene, settings]);

  useEffect(() => {
    setFrameloop(looping ? "always" : "demand");
    invalidate();
  }, [looping, setFrameloop, invalidate]);

  useEffect(() => {
    if (!world) return;
    stage.invalidate = () => invalidate();
    stage.pick = (x, y) => world.pick(x, y, gl.domElement.clientWidth, gl.domElement.clientHeight);
    return () => {
      stage.invalidate = () => {};
      stage.pick = () => -1;
    };
  }, [gl, invalidate, world]);

  // Warm-up: compile every shader before the canvas is revealed
  useEffect(() => {
    if (!world) return;
    let cancelled = false;
    const el = gl.domElement;
    world.update(camera as THREE.PerspectiveCamera, el.clientWidth || 1, el.clientHeight || 1, 0, isReducedMotion(), gl.getPixelRatio());
    yieldToMain()
      .then(() => (cancelled ? undefined : gl.compileAsync(scene, camera)))
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        invalidate();
        // two frames: one to render, one to present
        requestAnimationFrame(() => requestAnimationFrame(() => !cancelled && onReady()));
      });
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, world, invalidate, onReady]);

  useFrame((state, delta) => {
    if (!world) return;
    world.update(
      state.camera as THREE.PerspectiveCamera,
      state.size.width,
      state.size.height,
      delta,
      isReducedMotion(),
      state.gl.getPixelRatio(),
    );
  });

  return null;
}

type Props = { tier: Tier; onReady: () => void; onLost: () => void };

export default function GlobeCanvas({ tier, onReady, onLost }: Props) {
  const settings = TIERS[tier];
  const cap = Math.min(window.devicePixelRatio || 1, settings.dprCap);
  const floor = Math.min(1, cap) * 0.75;
  const [dpr, setDpr] = useState(cap);
  const looping = useLooping();

  return (
    <Canvas
      frameloop="demand"
      dpr={dpr}
      linear
      flat
      gl={{ antialias: settings.antialias, alpha: true, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 34, near: 0.1, far: 200, position: [0, 0, 4.3] }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onLost();
        });
      }}
    >
      {looping && (
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setDpr((d) => Math.max(floor, Math.round((d - 0.25) * 100) / 100))}
          onIncline={() => setDpr((d) => Math.min(cap, Math.round((d + 0.25) * 100) / 100))}
          onFallback={() => setDpr(floor)}
        />
      )}
      <World settings={settings} looping={looping} onReady={onReady} />
    </Canvas>
  );
}
