"use client";

/* ==========================================================================
   GLOBE CANVAS — React Three Fiber host for GlobeScene.
   - frameloop "demand" always: a frame only renders when invalidate() is called.
     While something animates on its own (full motion + stage on screen + tab
     visible) an ambient ticker asks for ~30 fps, or every frame for 1.5 s after
     scroll, pointer or intro activity (stage.wake). Off stage: 0 frames.
   - DPR starts at the tier cap; PerformanceMonitor (only mounted during the
     full-rate "hot" phases, so the 30 fps idle is not read as a decline)
     lowers it on decline and raises it again on incline.
   - The scene is built in slices (yielding between heavy steps), then its
     shaders are compiled with compileAsync before the canvas fades in.
   ========================================================================== */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
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

type WorldProps = { settings: TierSettings; looping: boolean; onReady: () => void; onHot: (hot: boolean) => void };

/** Idle frame spacing for the ambient ticker (~30 fps) */
const IDLE_MS = 32;

function World({ settings, looping, onReady, onHot }: WorldProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
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
      w.setShown(false); // stays hidden until its shaders are compiled (no synchronous compile in a frame)
      scene.add(w.root);
      setWorld(w);
    });
    return () => {
      alive = false;
      made?.dispose();
    };
  }, [scene, settings]);

  // Ambient ticker: ~30 fps when idle, every frame while "hot", stopped when not looping
  useEffect(() => {
    invalidate();
    if (!looping) return;
    let raf = 0;
    let last = 0;
    let wasHot = false;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const hot = now < stage.hotUntil;
      if (hot !== wasHot) {
        wasHot = hot;
        onHot(hot);
      }
      if (hot || now - last >= IDLE_MS) {
        last = now;
        invalidate();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (wasHot) onHot(false);
    };
  }, [looping, invalidate, onHot]);

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
    // hidden parts (aircraft, pillars…) are compiled too; the next update() hides them again
    yieldToMain()
      .then(() => {
        if (cancelled) return undefined;
        world.showAllForCompile();
        // programs are created now and compile in the background (KHR_parallel_shader_compile);
        // the root stays hidden meanwhile so the idle ticker's frames never wait on them
        const compiled = gl.compileAsync(scene, camera);
        world.setShown(false);
        return compiled;
      })
      .catch(() => undefined)
      .then(() => {
        if (cancelled) return;
        world.textures().forEach((t) => gl.initTexture(t));
        world.setShown(true);
        invalidate();
        // two frames: one to render, one to present; then the curtain lifts and the "lights on" intro starts
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (cancelled) return;
            world.startIntro();
            stage.wake();
            invalidate();
            onReady();
          }),
        );
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
  const [hot, setHot] = useState(false);
  const onHot = useCallback((h: boolean) => setHot(h), []);

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
      {looping && hot && (
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => setDpr((d) => Math.max(floor, Math.round((d - 0.25) * 100) / 100))}
          onIncline={() => setDpr((d) => Math.min(cap, Math.round((d + 0.25) * 100) / 100))}
          onFallback={() => setDpr(floor)}
        />
      )}
      <World settings={settings} looping={looping} onReady={onReady} onHot={onHot} />
    </Canvas>
  );
}
