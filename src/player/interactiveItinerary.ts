import {
  BufferGeometry, DataTexture, DoubleSide, EdgesGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments,
  Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, RGBAFormat, SRGBColorSpace, Vector3,
  type Object3D, type PerspectiveCamera,
} from "three";
import { createHoldMap, type Hold } from "./holdMapping";
import rests from "./holdRestAdmission.json";
import type { RecordedExtraHold } from "./recordedCatalog";

/**
 * Opt-in extended itinerary (`?recordedFeed=1&itinerary=extended`, Machine only).
 *
 * The authored clip, manifest and frozen hold admission are never modified. This
 * module owns a *virtual* navigation clock: at two cuts in the authored route the
 * authored clock freezes for INSERT seconds while the camera makes a world-space
 * detour to a new fixed pane and back to the exact sampled authored pose.
 * The virtual clock is never written back to the authored clock; callers map it
 * with `toSource` before every authored seek.
 */
export const ITINERARY_INSERT_SECONDS = 8;
export const ITINERARY_EXTRA_SECONDS = ITINERARY_INSERT_SECONDS * 2;
const APPROACH = 2.5;
const HOLD = 3;
const PANE_DISTANCE = 2.69; // same camera-relative distance as the authored panes
const PANE_W = 1.6;
const PANE_H = 0.87882;
/**
 * Source-time cuts (between authored holds 2/3 and 5/6) and the side the detour takes. The detour is a
 * lateral glide with only a restrained heading (|yaw| = 8 degrees, toward the side travelled) so the
 * Neural view does not whip; the pane sits ahead of the final heading, so it stays face-on.
 */
const STOPS = [
  { id: "ship", feedIndex: 8, cut: 21.5, lateral: -4, yaw: 8, before: 1, after: 2 },
  { id: "apron", feedIndex: 9, cut: 49.5, lateral: 5, yaw: -8, before: 4, after: 5 },
] as const;

type Anchor = { screen: string; anchorNode: string; holdStart: number; holdEnd: number };
export type ItineraryHold = Hold & { screen: string; anchorNode: string };
export interface InteractiveItinerary {
  /** Virtual duration: source duration plus both inserts. */
  readonly duration: number;
  /** Hold map over virtual time; focusHolds are the ten virtual holds. */
  readonly navigation: ReturnType<typeof createHoldMap>;
  readonly virtualHolds: readonly ItineraryHold[];
  /** The eight authored anchors in their original order, with hold times on the virtual clock. */
  readonly anchors: readonly ItineraryHold[];
  /** The two new panes on the virtual clock; stable feed ids 8 (ship) and 9 (apron). */
  readonly extras: readonly RecordedExtraHold[];
  toSource(virtual: number): number;
  toVirtual(source: number): number;
  /** Restore the authored camera-local transform; call before every authored seek. */
  restore(): void;
  /** Call after the authored seek. Offsets the camera in world space during inserts. */
  applyPose(virtual: number, camera: PerspectiveCamera): void;
  dispose(): void;
}

const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * t * (t * (t * 6 - 15) + 10); };

export function createInteractiveItinerary(input: {
  root: Object3D;
  camera: PerspectiveCamera;
  seek: (seconds: number) => number;
  sourceDuration: number;
  anchors: readonly Anchor[];
}): InteractiveItinerary | null {
  const { root, camera, seek, sourceDuration, anchors } = input;
  const [a, b] = [STOPS[0].cut, STOPS[1].cut];
  // Only on the already-admitted eight-hold baseline, with each cut inside its authored gap.
  if (anchors.length !== 8 || !camera.parent) return null;
  if (!(a > anchors[1]!.holdEnd && a < anchors[2]!.holdStart && b > anchors[4]!.holdEnd && b < anchors[5]!.holdStart && b < sourceDuration)) return null;
  if (!anchors.every((h, i) => i === 0 || h.holdStart > anchors[i - 1]!.holdEnd)) return null;

  const cameraPosition = camera.position.clone(), cameraQuaternion = camera.quaternion.clone();
  const restore = () => { camera.position.copy(cameraPosition); camera.quaternion.copy(cameraQuaternion); };

  // Sample authored base poses once (rig seek), then restore the camera.
  const scale = new Vector3();
  const sample = (time: number) => {
    restore();
    seek(time);
    camera.updateWorldMatrix(true, false);
    const p = new Vector3(), q = new Quaternion(), s = new Vector3();
    camera.matrixWorld.decompose(p, q, s);
    scale.copy(s);
    return { p, q: q.normalize() };
  };
  const yAxis = new Vector3(0, 1, 0);
  const plans = STOPS.map((stop, k) => {
    const base = sample(stop.cut);
    const hq = base.q.clone().multiply(new Quaternion().setFromAxisAngle(yAxis, (stop.yaw * Math.PI) / 180));
    const hp = base.p.clone().add(new Vector3(stop.lateral, 0, 0).applyQuaternion(base.q));
    const pane = hp.clone().add(new Vector3(0, 0, -PANE_DISTANCE).applyQuaternion(hq));
    const start = stop.cut + k * ITINERARY_INSERT_SECONDS; // virtual start of the insert
    return { stop, base, hq, hp, pane, start };
  });
  restore();
  seek(0);

  const toSource = (v: number) => (v <= a ? v : v <= a + ITINERARY_INSERT_SECONDS ? a : v <= b + ITINERARY_INSERT_SECONDS ? v - ITINERARY_INSERT_SECONDS : v <= b + ITINERARY_EXTRA_SECONDS ? b : v - ITINERARY_EXTRA_SECONDS);
  const toVirtual = (s: number) => (s <= a ? s : s <= b ? s + ITINERARY_INSERT_SECONDS : s + ITINERARY_EXTRA_SECONDS);
  const duration = sourceDuration + ITINERARY_EXTRA_SECONDS;

  // Authored holds shifted by their number of preceding inserts, plus the two new ones.
  const shift = (h: Anchor) => (h.holdStart < a ? 0 : h.holdStart < b ? ITINERARY_INSERT_SECONDS : ITINERARY_EXTRA_SECONDS);
  const shifted: ItineraryHold[] = anchors.map((h) => ({ screen: h.screen, anchorNode: h.anchorNode, holdStart: h.holdStart + shift(h), holdEnd: h.holdEnd + shift(h) }));
  const added: ItineraryHold[] = plans.map(({ stop, start }) => ({ screen: `itinerary_${stop.id}`, anchorNode: "", holdStart: start + APPROACH, holdEnd: start + APPROACH + HOLD }));
  const extras: RecordedExtraHold[] = plans.map(({ stop }, i) => ({ id: stop.id, holdStart: added[i]!.holdStart, holdEnd: added[i]!.holdEnd }));
  const virtualHolds = [...shifted, ...added].sort((x, y) => x.holdStart - y.holdStart);
  const navigation = {
    ...createHoldMap(duration, [rests.opening, ...virtualHolds, { holdStart: rests.end.holdStart + ITINERARY_EXTRA_SECONDS, holdEnd: duration }]),
    focusHolds: virtualHolds as readonly Hold[],
  };

  // Fixed-world panes with the same size and camera-relative pose as the authored panes.
  root.updateWorldMatrix(true, false);
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert();
  const rootQuaternion = root.getWorldQuaternion(new Quaternion()).invert();
  const toLocal = (world: Vector3) => world.clone().applyMatrix4(rootInverse);
  const placeholder = new DataTexture(new Uint8Array([8, 12, 15, 255]), 1, 1, RGBAFormat);
  placeholder.colorSpace = SRGBColorSpace; placeholder.needsUpdate = true;
  const owned: Array<{ dispose(): void }> = [placeholder];
  const groups: Group[] = [];
  const lines: LineSegments[] = [];
  for (const plan of plans) {
    const group = new Group();
    group.name = `itinerary_${plan.stop.id}`;
    group.position.copy(toLocal(plan.pane));
    group.quaternion.copy(rootQuaternion).multiply(plan.hq);
    const imageGeometry = new PlaneGeometry(PANE_W, PANE_H);
    const uv = imageGeometry.getAttribute("uv");
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); // glTF-style top-left UV, matching authored panes
    // The placeholder map keeps the pane eligible for the recorded-feed pool; it is replaced by the poster.
    const imageMaterial = new MeshBasicMaterial({ map: placeholder, side: DoubleSide });
    const image = new Mesh(imageGeometry, imageMaterial);
    image.name = `itinerary_${plan.stop.id}_image`;
    const frameGeometry = new PlaneGeometry(PANE_W + 0.05, PANE_H + 0.05);
    const frameMaterial = new MeshBasicMaterial({ color: "#070b0e", side: DoubleSide });
    const frame = new Mesh(frameGeometry, frameMaterial);
    frame.name = `itinerary_${plan.stop.id}_frame`; frame.position.z = -0.004;
    const edgeGeometry = new EdgesGeometry(frameGeometry);
    const edgeMaterial = new LineBasicMaterial({ color: "#8c9894", transparent: true, opacity: 0.7 });
    const edges = new LineSegments(edgeGeometry, edgeMaterial);
    edges.position.z = -0.003;
    group.add(frame, edges, image);
    root.add(group);
    groups.push(group);
    owned.push(imageGeometry, imageMaterial, frameGeometry, frameMaterial, edgeGeometry, edgeMaterial);

    // Bounded tethers to the neighbouring authored route clusters. They leave from the pane's side edge,
    // swing out *behind* the pane plane, and any segment that would still cross the front silhouette is dropped,
    // so no line is ever drawn across video content. Depth testing is left on.
    const points: number[] = [];
    const inverseQuaternion = plan.hq.clone().invert();
    const toPane = (world: Vector3) => world.clone().sub(plan.pane).applyQuaternion(inverseQuaternion);
    const fromPane = (local: Vector3) => local.clone().applyQuaternion(plan.hq).add(plan.pane);
    const halfW = PANE_W / 2 + 0.06, halfH = PANE_H / 2 + 0.06;
    for (const index of [plan.stop.before, plan.stop.after]) {
      const node = root.getObjectByName(anchors[index]!.anchorNode);
      if (!node) continue;
      const end = toPane(node.getWorldPosition(new Vector3()));
      const side = end.x >= 0 ? 1 : -1;
      const start = new Vector3(side * (PANE_W / 2 + 0.02), 0, -0.04);
      const control = new Vector3(side * (halfW + 1.2), -0.6, -1.4);
      const inFront = (p: Vector3) => p.z > -0.02 && Math.abs(p.x) < halfW && Math.abs(p.y) < halfH;
      let previous = start;
      for (let i = 1; i <= 16; i++) {
        const t = i / 16, u = 1 - t;
        const point = start.clone().multiplyScalar(u * u).add(control.clone().multiplyScalar(2 * u * t)).add(end.clone().multiplyScalar(t * t));
        const middle = previous.clone().add(point).multiplyScalar(0.5);
        if (!inFront(previous) && !inFront(point) && !inFront(middle)) {
          const from = toLocal(fromPane(previous)), to = toLocal(fromPane(point));
          points.push(from.x, from.y, from.z, to.x, to.y, to.z);
        }
        previous = point;
      }
    }
    if (points.length) {
      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new Float32BufferAttribute(points, 3));
      const material = new LineBasicMaterial({ color: "#7aa6c8", transparent: true, opacity: 0.42, depthWrite: false });
      const tether = new LineSegments(geometry, material);
      tether.name = `itinerary_${plan.stop.id}_tether`;
      tether.frustumCulled = false;
      root.add(tether);
      lines.push(tether);
      owned.push(geometry, material);
    }
  }
  root.updateMatrixWorld(true);

  // The wider yaw exposes the finite haze plane's edge: hide only that node for the adapter's lifetime.
  const haze = root.getObjectByName("fx_haze_backdrop");
  const hazeVisible = haze?.visible;
  if (haze) haze.visible = false;

  const desired = new Matrix4(), local = new Matrix4(), unusedScale = new Vector3();
  let disposed = false;
  return {
    duration, navigation, virtualHolds, anchors: shifted, extras, toSource, toVirtual, restore,
    applyPose(virtual, cam) {
      if (disposed) return;
      for (const plan of plans) {
        const tau = virtual - plan.start;
        if (tau <= 0 || tau >= ITINERARY_INSERT_SECONDS) continue;
        const w = tau < APPROACH ? ease(tau / APPROACH) : tau < APPROACH + HOLD ? 1 : ease(1 - (tau - APPROACH - HOLD) / APPROACH);
        if (w <= 0) return;
        desired.compose(plan.base.p.clone().lerp(plan.hp, w), plan.base.q.clone().slerp(plan.hq, w), scale);
        const parent = cam.parent!;
        parent.updateWorldMatrix(true, false); // account for the animated parent chain
        local.copy(parent.matrixWorld).invert().multiply(desired).decompose(cam.position, cam.quaternion, unusedScale);
        cam.updateMatrixWorld(true);
        return;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      restore();
      if (haze && hazeVisible !== undefined) haze.visible = hazeVisible;
      for (const object of [...groups, ...lines]) object.removeFromParent();
      for (const resource of owned) resource.dispose();
      groups.length = 0; lines.length = 0;
    },
  };
}
