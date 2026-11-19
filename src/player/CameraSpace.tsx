"use client";

import { useEffect, useRef, useState } from "react";
import {
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
const START = -0.9;
/** Minimum time between navigation steps, and the in-flight distance beyond which new input is ignored. */
const STEP_COOLDOWN_MS = 650;
const KEY_COOLDOWN_MS = 500;
const MAX_LEAD = 0.55;
const PANE_WIDTH = 18;
const slotOfId = new Map(CAMERA_SPACE_STOPS.map((stop) => [stop.id, stop.slot]));

/**
 * Segments (by starting stop) where the incoming pane flies up to the camera. Only the sign is used: the side of
 * the frame the pane settles toward (right/up, left/down, right/down); the magnitude is derived from the viewport
 * aspect so the pane always stays inside the frame.
 */
const APPROACH: Readonly<Record<number, readonly [number, number]>> = {
  1: [0.62, 0.3],
  4: [-0.62, -0.3],
  7: [0.62, -0.3],
};

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
    const paneBySlot: (Group | undefined)[] = [];
    const paneSlotOf = new Map<Group, number>();
    let displaced: Group | null = null;

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
      paneBySlot[stop.slot] = group;
      paneSlotOf.set(group, stop.slot);
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
    let fit = 15;
    // Geometric path profile per segment (route time keeps its own eased fraction f; all profiles are 0 at f=0 and 1 at f=1).
    // 0 traverse (lateral S-bow), 1 push-in (front-loaded), 2 crane (vertical leads), 3 settle (near-still ends, brisk middle).
    const shape = (i: number, f: number): readonly [number, number, number] => {
      switch (i % 4) {
        case 1: { const g = 1 - (1 - f) * (1 - f); return [g, g, g]; }
        case 2: return [smooth(clamp((f - 0.2) / 0.8, 0, 1)), smooth(clamp(f * 1.3, 0, 1)), f];
        case 3: { const g = smooth(smooth(f)); return [g, g, g]; }
        default: return [smooth(f), f, f];
      }
    };

    const pose = () => {
      const i = clamp(Math.floor(position), 0, LAST - 1);
      const t = position - i;
      const a = locations[i]!;
      const b = locations[i + 1]!;
      // Hold at each camera (exactly centred, facing straight down the field), then travel.
      const f = smooth(clamp((t - 0.12) / 0.76, 0, 1));
      // Approach segments: the camera stays parked on stop i while the incoming pane's whole group translates
      // toward it (first half), then the pane glides back to its catalog transform as the camera travels (second half).
      const approach = APPROACH[i];
      // The camera starts easing away while the pane is still arriving (no deliberate middle stop); the pane's peak
      // pose is camera-relative, so the two stay locked together through the handoff.
      let paneWeight = 0;
      let cf = f;
      if (approach) {
        paneWeight = f < 0.5 ? smooth(f / 0.5) : 1 - smooth((f - 0.5) / 0.5);
        cf = smooth(clamp((f - 0.35) / 0.65, 0, 1));
      }
      if (displaced && (!approach || displaced !== paneBySlot[i + 1])) {
        displaced.position.copy(locations[paneSlotOf.get(displaced)!]!);
        displaced.updateMatrixWorld(true);
        displaced = null;
      }
      const [gx, gy, gz] = shape(i, cf);
      const bow = approach ? 0 : Math.sin(Math.PI * f);
      eye.set(
        a.x + (b.x - a.x) * gx + (i % 4 === 0 ? (i % 8 === 0 ? 6 : -5) * bow : 0),
        a.y + (b.y - a.y) * gy + (i % 4 === 2 ? 4 * bow : 0),
        a.z + fit + (b.z - a.z) * gz,
      );
      // Heading stays parallel to the world; only a faint lean (zero at both holds) toward the next pane.
      aim.set(
        eye.x + clamp(b.x - a.x, -1, 1) * 5 * bow,
        eye.y + clamp(b.y - a.y, -1, 1) * 3 * bow,
        eye.z - 100,
      );
      // Overview: straight back along the view axis, level and centred on the first pane.
      if (position < 0) eye.z += -position * 150;
      const incoming = paneBySlot[i + 1];
      if (approach && incoming) {
        if (paneWeight > 0) {
          // Projection bound (heading is exactly -z on approach segments, bow = 0): at distance d a pane of half-size
          // (9, 5.0625) spans NDC |x| <= 9/(d*tanH) + |ox|/(d*tanH) and |y| <= 5.0625/(d*tan) + |oy|/(d*tan),
          // tanH = tan(fov/2)*aspect. d = 0.9*fit and the offsets are clamped so both stay <= 0.95 on any aspect.
          const tan = Math.tan((camera.fov * Math.PI) / 360);
          const tanH = tan * camera.aspect;
          const d = fit * 0.9;
          const ox = approach[0] > 0 ? 1 : -1;
          const oy = approach[1] > 0 ? 1 : -1;
          const offX = ox * Math.min(PANE_WIDTH * 0.1, Math.max(0, 0.95 - 9 / (d * tanH)) * d * tanH);
          const offY = oy * Math.min(PANE_WIDTH * 0.06, Math.max(0, 0.95 - 5.0625 / (d * tan)) * d * tan);
          const home = locations[i + 1]!;
          const frontX = eye.x + offX;
          const frontY = eye.y + offY;
          const frontZ = eye.z - d;
          // Depth first, lateral second: while below the crossing weight the pane stays at its catalog x/y (more than a
          // pane away from pane i on one axis, so it cannot touch it) and rises through pane i's plane; only then does
          // it slide laterally into the frame, always in front of pane i.
          const wc = 0.4;
          const planeZ = a.z + (frontZ - a.z) * 0.5;
          const sc = clamp((home.z - planeZ) / (home.z - frontZ), 0, 1);
          const zN = paneWeight < wc ? sc * (paneWeight / wc) : sc + (1 - sc) * smooth((paneWeight - wc) / (1 - wc));
          const xN = paneWeight < wc ? 0 : 1 - (1 - smooth((paneWeight - wc) / (1 - wc))) ** 2;
          const px = home.x + (frontX - home.x) * xN;
          const py = home.y + (frontY - home.y) * xN;
          const pz = home.z + (frontZ - home.z) * zN;
          // Final-pose bound, relative to the ACTUAL camera (axes are world-aligned on approach segments, bow = 0). With
          // depth dz = eye.z - pz (>= 0.9*fit, since the eye never gets closer than fit above home and the pane never
          // closer than 0.9*fit), the whole pane stays inside 95% of the viewport iff
          //   |px-eye.x| <= 0.95*dz*tanH - 9   and   |py-eye.y| <= 0.95*dz*tan - 5.0625.
          // Clamping the camera-relative offset to those limits holds for every pose in the visible approach and return;
          // it is the identity at the terminal (eye == home + fit, offsets 0). Fully on once the pane is in the
          // foreground (approach weight past the crossing, and throughout the return), blended in just before so a
          // distant, not-yet-visible pane is not pulled in unnaturally. Pure function of position, so reverse-safe.
          const w = f >= 0.5 ? 1 : smooth(clamp((paneWeight - wc) / 0.1, 0, 1));
          const dz = Math.max(eye.z - pz, 1e-3);
          const limX = Math.max(0, 0.95 * dz * tanH - 9);
          const limY = Math.max(0, 0.95 * dz * tan - 5.0625);
          const rx = px - eye.x;
          const ry = py - eye.y;
          incoming.position.set(
            eye.x + rx + (clamp(rx, -limX, limX) - rx) * w,
            eye.y + ry + (clamp(ry, -limY, limY) - ry) * w,
            pz,
          );
          displaced = incoming;
        } else {
          incoming.position.copy(locations[i + 1]!);
        }
        incoming.updateMatrixWorld(true);
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
      fit = distance();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();

    // Every input moves exactly one stop; ignored during the cooldown or while the previous step is still well in flight.
    let stepAt = 0;
    const jump = (direction: number, cooldown = STEP_COOLDOWN_MS) => {
      const now = performance.now();
      if (now - stepAt < cooldown || Math.abs(target - position) > MAX_LEAD) return;
      const next = direction > 0 ? Math.floor(target + 1e-3) + 1 : target <= 0 ? START : Math.ceil(target - 1e-3) - 1;
      const clamped = clamp(next, START, LAST);
      if (clamped === target) return;
      target = clamped;
      stepAt = now;
    };
    // Wheel: accumulate intent, fire one step per burst; inertial tails are absorbed until the wheel goes quiet.
    let wheelSum = 0;
    let wheelQuiet = 0;
    let wheelLocked = false;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      window.clearTimeout(wheelQuiet);
      wheelQuiet = window.setTimeout(() => { wheelLocked = false; wheelSum = 0; }, 180);
      if (wheelLocked) return;
      wheelSum += e.deltaY * unit;
      if (Math.abs(wheelSum) >= 90) {
        const before = target;
        jump(wheelSum > 0 ? 1 : -1);
        if (target !== before) wheelLocked = true;
        wheelSum = 0;
      }
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
        if (!e.repeat) jump(forward.includes(e.key) ? 1 : -1, KEY_COOLDOWN_MS);
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        if (!e.repeat) target = e.key === "Home" ? START : LAST;
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
          position += (target - position) * (1 - Math.exp(-dt * 2.4));
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
        // Orderly: planes stay parallel to the world; a minority take a small fixed yaw for rhythm.
        background.push({ x, y, z, w, texture: 0, shade, ry: rr < 0.12 ? -0.1 : rr > 0.88 ? 0.1 : 0, rx: 0, rz: 0 });
      };

      // 1) Continuous layered shells (near/mid/far) from behind the first camera to well past the last.
      const tiers = [
        { r0: 30, r1: 48, w0: 3.5, w1: 7, n: 3, shade: 0.7 },
        { r0: 46, r1: 86, w0: 6, w1: 12, n: 3, shade: 0.85 },
        { r0: 84, r1: 155, w0: 10, w1: 19, n: 3, shade: 1 },
        { r0: 150, r1: 270, w0: 15, w1: 28, n: 2, shade: 0.8 },
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
      window.clearTimeout(wheelQuiet);
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
