"use client";

import { useEffect, useRef, useState } from "react";
import {
  CatmullRomCurve3,
  Color,
  DataTexture,
  EdgesGeometry,
  FogExp2,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three";

import { assetPath } from "../contract/assetPath";
import {
  CAMERA_SPACE_ANCHORS,
  CAMERA_SPACE_EXTRAS,
  CAMERA_SPACE_STOPS,
  routeSeconds,
} from "./cameraSpaceFeeds";
import { createRecordedFeed, type RecordedFeedController } from "./recordedFeed";
import styles from "./CameraSpace.module.css";

const LAST = CAMERA_SPACE_STOPS.length - 1;
const START = -0.75;
const PANE_WIDTH = 18;
const slotOfId = new Map(CAMERA_SPACE_STOPS.map((stop) => [stop.id, stop.slot]));

const random = (n: number) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type Plane = { x: number; y: number; z: number; w: number; texture: number; ry: number; rx: number; rz: number; shade: number };

/**
 * Standalone camera-space route. Ten still panes sit at uneven depths along a
 * deep corridor, surrounded by about two thousand instanced background planes.
 * Recorded excerpts come from the shared recorded-feed controller and are
 * opt-in by simply being present: with reduced motion the posters stay still.
 */
export function CameraSpace() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("CONNECTING CAMERAS");
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let raf = 0;
    let last = 0;
    let position = START;
    let target = START;
    let active = -1;
    let feed: RecordedFeedController | null = null;
    let loaded = false;

    const scene = new Scene();
    const camera = new PerspectiveCamera(48, 1, 0.1, 1700);
    scene.background = new Color("#05090c");
    scene.fog = new FogExp2("#05090c", 0.0015);
    const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const textures: Texture[] = [];
    const geometries: PlaneGeometry[] = [];
    const materials: MeshBasicMaterial[] = [];
    const batches: InstancedMesh[] = [];
    const outlines: LineSegments[] = [];
    const groups: Group[] = [];

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motion.matches;

    const locations = CAMERA_SPACE_STOPS.map((stop) => new Vector3(...stop.position));

    const makePane = (stop: (typeof CAMERA_SPACE_STOPS)[number], texture: Texture) => {
      const geometry = new PlaneGeometry(PANE_WIDTH, (PANE_WIDTH * 9) / 16);
      const uv = geometry.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
      geometries.push(geometry);
      const material = new MeshBasicMaterial({ map: texture, color: "#e1e4de" });
      materials.push(material);
      // The group carries the catalog screen name and the mesh the catalog mesh name.
      const group = new Group();
      group.name = stop.screen;
      group.position.copy(locations[stop.slot]!);
      const pane = new Mesh(geometry, material);
      pane.name = stop.mesh;
      group.add(pane);
      const border = new LineSegments(
        new EdgesGeometry(geometry),
        new LineBasicMaterial({ color: "#8c9894", transparent: true, opacity: 0.65 }),
      );
      border.position.z = 0.015;
      group.add(border);
      outlines.push(border);
      scene.add(group);
      groups.push(group);
    };

    // Distance at which a pane fits both the width and height of the viewport (phones included).
    const distance = () => {
      const tan = Math.tan((camera.fov * Math.PI) / 360);
      return Math.max(15, Math.max(18 / (2 * tan * camera.aspect * 0.82), 10.125 / (2 * tan * 0.72)));
    };
    const eye = new Vector3();
    const aim = new Vector3();
    let curves: CatmullRomCurve3[] = [];
    const rebuildCurves = () => {
      const d = distance();
      curves = locations.slice(0, -1).map((a, i) => {
        const b = locations[i + 1]!;
        const c0 = a.clone().add(new Vector3(0, 0, d));
        const c3 = b.clone().add(new Vector3(0, 0, d));
        const side = i % 3 === 0 ? 8 : i % 3 === 1 ? -7 : 3;
        return new CatmullRomCurve3([
          c0,
          c0.clone().lerp(c3, 0.3).add(new Vector3(side, i % 2 ? 5 : -4, 10)),
          c0.clone().lerp(c3, 0.7).add(new Vector3(-side * 0.3, 0, 8)),
          c3,
        ]);
      });
    };

    const pose = () => {
      const i = clamp(Math.floor(position), 0, LAST - 1);
      const t = position - i;
      const a = locations[i]!;
      const b = locations[i + 1]!;
      // Hold briefly at each camera, then traverse a different lateral/vertical route.
      const f = smooth(clamp((t - 0.1) / 0.8, 0, 1));
      curves[i]!.getPoint(f, eye);
      aim.copy(a).lerp(b, f);
      if (position < 0) {
        // Overview: pull back and up before the first camera.
        eye.z += -position * 150;
        eye.y += -position * 20;
      }
      camera.position.copy(eye);
      camera.lookAt(aim);
      camera.updateMatrixWorld();
      feed?.update(routeSeconds(i, f), camera);
      const next = f > 0.5 ? i + 1 : i;
      if (next !== active) {
        active = next;
        setSelected(next);
      }
    };

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      rebuildCurves();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    // Keyboard/swipe step: from the in-flight target to the next/previous whole camera. Wheel never snaps.
    const jump = (direction: number) => {
      target = clamp(direction > 0 ? Math.floor(target + 1e-3) + 1 : Math.ceil(target - 1e-3) - 1, 0, LAST);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      target = clamp(target + clamp(e.deltaY * unit, -120, 120) * 0.0042, START, LAST);
    };
    // One gesture moves at most one camera, committed on crossing the threshold; taps and multi-touch do nothing.
    let gesture: { id: number; x: number; y: number; done: boolean } | null = null;
    const endGesture = (e?: PointerEvent) => {
      if (!gesture || (e && e.pointerId !== gesture.id)) return;
      try { el.releasePointerCapture(gesture.id); } catch { /* capture already released */ }
      gesture = null;
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (gesture) { gesture.done = true; return; }
      gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, done: false };
      try { el.setPointerCapture(e.pointerId); } catch { /* capture unavailable */ }
    };
    const move = (e: PointerEvent) => {
      if (!gesture || gesture.done || e.pointerId !== gesture.id) return;
      const dx = gesture.x - e.clientX;
      const dy = gesture.y - e.clientY;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const threshold = Math.max(40, Math.min(72, Math.min(window.innerWidth, window.innerHeight) * 0.1));
      if (Math.max(ax, ay) >= threshold && Math.max(ax, ay) > 1.2 * Math.min(ax, ay)) {
        gesture.done = true;
        jump((ay > ax ? dy : dx) > 0 ? 1 : -1);
      }
    };
    const forward = ["ArrowDown", "ArrowRight", "PageDown"];
    const backward = ["ArrowUp", "ArrowLeft", "PageUp"];
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (forward.includes(e.key) || backward.includes(e.key)) {
        e.preventDefault();
        jump(forward.includes(e.key) ? 1 : -1);
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        target = e.key === "Home" ? 0 : LAST;
      }
    };
    const reset = () => endGesture();
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", endGesture);
    el.addEventListener("pointercancel", endGesture);
    el.addEventListener("lostpointercapture", endGesture);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", reset);

    // Recordings only run when motion is allowed; otherwise the panes keep their still posters.
    const startFeed = () => {
      if (feed || reduced || !loaded || disposed) return;
      feed = createRecordedFeed(scene, document, () => {}, CAMERA_SPACE_ANCHORS, CAMERA_SPACE_EXTRAS, {
        annotate(ctx, { id, time, width, height }) {
          // Sized from the canvas shared with the picture, so legibility scales on every viewport.
          const slot = slotOfId.get(id) ?? 0;
          const fs = Math.max(18, Math.round(width / 33));
          const bar = Math.round(fs * 1.8);
          const m = Math.round(fs * 0.55);
          const base = height - Math.round(fs * 0.8);
          ctx.save();
          ctx.font = `${fs}px monospace`;
          ctx.fillStyle = "#070c10c8";
          ctx.fillRect(8, height - bar - 8, width - 16, bar);
          ctx.fillStyle = "#e4ebe5";
          ctx.fillText(`CAM ${String(slot + 1).padStart(2, "0")} / RECORDED`, m, base - 4);
          ctx.textAlign = "right";
          ctx.fillText(`${String(Math.floor(time / 60)).padStart(2, "0")}:${(time % 60).toFixed(2).padStart(5, "0")}`, width - m, base - 4);
          ctx.strokeStyle = "#b2bba577";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(m, height - 14);
          ctx.lineTo(width - m, height - 14);
          ctx.stroke();
          ctx.restore();
        },
      });
    };
    const stopFeed = () => { feed?.dispose(); feed = null; };
    const onMotion = () => {
      reduced = motion.matches;
      if (reduced) { stopFeed(); position = target; } else startFeed();
    };
    motion.addEventListener("change", onMotion);

    const tick = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (!document.hidden) {
        if (reduced) position = target;
        else {
          position += (target - position) * (1 - Math.exp(-dt * 3.1));
          if (Math.abs(target - position) < 0.0001) position = target;
        }
        pose();
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(tick);
    };

    const loader = new TextureLoader();
    const load = async () => {
      const loadedTextures = await Promise.all(CAMERA_SPACE_STOPS.map(async (stop) => {
        // One bounded retry per poster, then a neutral 1x1 fallback so a single failed poster never blocks the scene.
        let texture: Texture | null = null;
        for (let attempt = 0; attempt < 2 && !texture && !disposed; attempt++) {
          if (attempt > 0) await new Promise<void>((resolve) => setTimeout(resolve, 400));
          if (disposed) break;
          try {
            texture = await loader.loadAsync(assetPath(stop.poster));
          } catch {
            texture = null;
          }
        }
        if (disposed) { texture?.dispose(); return texture ?? new Texture(); }
        if (texture) {
          texture.colorSpace = SRGBColorSpace;
          texture.flipY = false;
        } else {
          texture = new DataTexture(new Uint8Array([8, 12, 15, 255]), 1, 1, RGBAFormat);
          texture.colorSpace = SRGBColorSpace;
          texture.flipY = false;
          texture.needsUpdate = true;
        }
        textures.push(texture);
        return texture;
      }));
      if (disposed) return;
      CAMERA_SPACE_STOPS.forEach((stop) => makePane(stop, loadedTextures[stop.slot]!));

      const background: Plane[] = [];
      const variants = loadedTextures.length;
      // Piecewise-linear traversal axis through the stops (clamped drift beyond both ends).
      const axisAt = (z: number) => {
        let i = 0;
        while (i < LAST - 1 && z < locations[i + 1]!.z) i++;
        const a = locations[i]!;
        const b = locations[i + 1]!;
        const t = clamp((a.z - z) / (a.z - b.z), -0.4, 1.4);
        return [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t] as const;
      };
      // Keep an elliptical corridor around the route clear so focal panes and the camera never meet close occluders.
      const add = (x: number, y: number, z: number, w: number, shade: number, minClear = 30) => {
        const [cx, cy] = axisAt(z);
        const ex = x - cx;
        const ey = y - cy;
        if (Math.hypot(ex / 1.25, ey / 0.95) < minClear + w * 0.45) return;
        const rr = random(x * 3.1 + y * 1.7 + z * 0.37);
        // Planes yaw and pitch gently toward the route so layers read as depth, not flat wallpaper.
        background.push({
          x, y, z, w, texture: 0, shade,
          ry: clamp(-ex / 170, -0.5, 0.5) + (rr - 0.5) * 0.12,
          rx: clamp(ey / 260, -0.3, 0.3),
          rz: (random(rr * 977) - 0.5) * 0.1,
        });
      };

      // 1) Continuous layered shells (near/mid/far) from behind the first camera to well past the last.
      const tiers = [
        { r0: 30, r1: 48, w0: 3.5, w1: 7, n: 3, shade: 0.7 },
        { r0: 46, r1: 86, w0: 6, w1: 12, n: 3, shade: 0.85 },
        { r0: 84, r1: 155, w0: 10, w1: 19, n: 3, shade: 1 },
      ];
      // Depth derives from the last stop: shells, backdrop and tail run at least 400 units beyond it and taper out.
      const tailZ = locations[LAST]!.z - 400;
      const shellSteps = Math.ceil((90 - tailZ) / 10.1);
      for (let s = 0; s < shellSteps; s++) {
        const z = 90 - s * 10.1 + (random(s + 9) - 0.5) * 5;
        tiers.forEach((tier, t) => {
          const count = tier.n + (random(s * 7 + t) < 0.5 ? 1 : 0);
          const base = s * 2.399 + t * 2.1 + (random(s + t * 50) - 0.5) * 1.1;
          for (let j = 0; j < count; j++) {
            const k = s * 31 + t * 9 + j;
            // Slow voids and clumps rather than uniform noise.
            if (random(k + 5000) < 0.16 * (1 + Math.sin(z * 0.021 + t * 2)) + Math.max(0, (s / shellSteps - 0.82) / 0.18) * 0.55) continue;
            const a = base + (j * Math.PI * 2) / count + (random(k + 11) - 0.5) * 0.5;
            const r = tier.r0 + (tier.r1 - tier.r0) * random(k + 23);
            const [cx, cy] = axisAt(z);
            add(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 0.95, z + (random(k + 37) - 0.5) * 6, tier.w0 + (tier.w1 - tier.w0) * random(k + 53), tier.shade * (0.6 + 0.4 * random(k + 71)));
          }
        });
      }
      // 2) Asymmetric inhabited clusters around every stop; the last is densest so the end is not a cliff.
      locations.forEach((p, k) => {
        const ba = k * 2.1 + 0.7;
        const ox = Math.cos(ba) * 34;
        const oy = Math.sin(ba) * 20;
        const count = 42 + (k % 3) * 8 + (k === LAST ? 56 : 0);
        for (let j = 0; j < count; j++) {
          const n = 4000 + k * 200 + j;
          add(p.x + ox + (random(n) + random(n + 7) - 1) * 40, p.y + oy + (random(n + 31) + random(n + 37) - 1) * 25, p.z + (random(n + 63) + random(n + 67) - 1) * 85, 3.5 + random(n + 95) * 6.5, 0.55 + 0.45 * random(n + 120), 27);
        }
      });
      // Tail: a loose cluster beyond the final camera so the last stop is not the edge of the field.
      {
        const p = locations[LAST]!;
        for (let j = 0; j < 34; j++) {
          const n = 9000 + j;
          add(p.x * 0.5 + (random(n) + random(n + 7) - 1) * 45, p.y * 0.5 + (random(n + 31) + random(n + 37) - 1) * 28, p.z - 170 + (random(n + 63) + random(n + 67) - 1) * 110, 3.5 + random(n + 95) * 6.5, 0.5 + 0.35 * random(n + 120), 27);
        }
      }
      // 3) Large dim far backdrop so long views stay filled in the distance.
      const backCount = Math.ceil((60 - tailZ) / 10.4);
      for (let i = 0; i < backCount; i++) {
        const z = 60 - (i / backCount) * (60 - tailZ) + (random(i + 300) - 0.5) * 10;
        const a = i * 2.399 + random(i + 400) * 0.6;
        const r = 150 + random(i + 500) * 130;
        const [cx, cy] = axisAt(z);
        add(cx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 0.9, z, 22 + random(i + 600) * 18, 0.5 + 0.2 * random(i + 700));
      }
      // Spatially hashed texture choice, re-rolled when a nearby plane shows the same picture.
      const hash = (a: number, b: number) => random(a * 12.9898 + b * 78.233);
      background.forEach((p, i) => {
        const near = background.slice(0, i).filter((q) => Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < 10 + (p.w + q.w) * 0.9);
        for (let salt = 0; salt < 8; salt++) {
          p.texture = Math.floor(hash(Math.floor(p.x / 7) * 131 + Math.floor(p.y / 7) * 17 + Math.floor(p.z / 7) * 3 + salt * 7.7, i + salt) * variants);
          if (!near.some((q) => q.texture === p.texture)) break;
        }
      });
      // One instanced draw batch per texture; no per-plane videos.
      const dummy = new Object3D();
      const tint = new Color();
      loadedTextures.forEach((texture, index) => {
        const entries = background.filter((p) => p.texture === index);
        if (!entries.length) return;
        const geometry = new PlaneGeometry(1, 9 / 16);
        const uv = geometry.getAttribute("uv");
        for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
        geometries.push(geometry);
        const material = new MeshBasicMaterial({ map: texture, color: "#9aa7a8" });
        materials.push(material);
        const mesh = new InstancedMesh(geometry, material, entries.length);
        entries.forEach((p, i) => {
          dummy.position.set(p.x, p.y, p.z);
          dummy.scale.setScalar(p.w);
          dummy.rotation.set(p.rx, p.ry, p.rz);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          mesh.setColorAt(i, tint.setScalar(p.shade));
        });
        mesh.frustumCulled = false;
        scene.add(mesh);
        batches.push(mesh);
      });

      loaded = true;
      startFeed();
      setStatus("");
      raf = requestAnimationFrame(tick);
    };
    void load().catch(() => {
      if (!disposed) setStatus("Unable to load cameras");
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      motion.removeEventListener("change", onMotion);
      stopFeed();
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", endGesture);
      el.removeEventListener("pointercancel", endGesture);
      el.removeEventListener("lostpointercapture", endGesture);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", reset);
      endGesture();
      batches.forEach((m) => { scene.remove(m); m.dispose(); });
      groups.forEach((g) => scene.remove(g));
      outlines.forEach((line) => { line.geometry.dispose(); (line.material as LineBasicMaterial).dispose(); });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main className={styles.shell} aria-label="Camera space">
      <div ref={host} className={styles.canvas} />
      <header className={styles.header}><span>CAMERA SPACE</span><span>CAM {String(selected + 1).padStart(2, "0")}</span></header>
      {status ? <div className={styles.loading} role="status">{status}</div> : null}
      <footer className={styles.footer}><span>SCROLL / SWIPE / KEYS TO TRAVERSE</span></footer>
    </main>
  );
}
