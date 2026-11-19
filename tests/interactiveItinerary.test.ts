import { Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";

import manifest from "../public/assets/machine/manifest.json";
import apronTracking from "../public/assets/recorded-feeds/apron/tracking.json";
import shipTracking from "../public/assets/recorded-feeds/ship/tracking.json";
import { createInteractiveItinerary, ITINERARY_EXTRA_SECONDS, ITINERARY_INSERT_SECONDS } from "../src/player/interactiveItinerary";
import { RECORDED_CATALOG, resolveCatalog, selectPrepared, MAX_DECODERS } from "../src/player/recordedCatalog";
import { drawNeutralReticle, parseRecordedTracking, sampleHeads } from "../src/player/recordedTracking";

function build() {
  const root = new Group();
  const rig = new Group();
  const camera = new PerspectiveCamera();
  rig.add(camera);
  root.add(rig);
  const seek = (seconds: number) => {
    camera.position.set(seconds * 0.1, 0, 0);
    camera.updateMatrixWorld(true);
    return seconds;
  };
  seek(0);
  const itinerary = createInteractiveItinerary({
    root, camera, seek, sourceDuration: manifest.durationSeconds, anchors: manifest.anchors,
  });
  return { root, camera, seek, itinerary: itinerary! };
}

describe("extended itinerary virtual clock", () => {
  it("is refused unless the eight admitted anchors are present", () => {
    const { root, camera, seek } = build();
    expect(createInteractiveItinerary({ root, camera, seek, sourceDuration: manifest.durationSeconds, anchors: manifest.anchors.slice(0, 7) })).toBeNull();
  });

  it("adds exactly two eight-second inserts and maps virtual to source time", () => {
    const { itinerary } = build();
    expect(itinerary.duration).toBeCloseTo(manifest.durationSeconds + ITINERARY_EXTRA_SECONDS);
    expect(itinerary.toSource(10)).toBe(10);
    expect(itinerary.toSource(21.5 + 4)).toBe(21.5); // frozen during the first insert
    expect(itinerary.toSource(30 + 20)).toBeCloseTo(50 - ITINERARY_INSERT_SECONDS);
    expect(itinerary.toSource(49.5 + ITINERARY_INSERT_SECONDS + 3)).toBe(49.5);
    expect(itinerary.toSource(80)).toBeCloseTo(80 - ITINERARY_EXTRA_SECONDS);
    for (const s of [0, 12, 21.5, 30, 49.5, 70, 84]) expect(itinerary.toSource(itinerary.toVirtual(s))).toBeCloseTo(s);
  });

  it("keeps eight shifted authored holds and adds two, ordered and disjoint", () => {
    const { itinerary } = build();
    expect(itinerary.virtualHolds).toHaveLength(10);
    expect(itinerary.navigation.focusHolds).toHaveLength(10);
    itinerary.virtualHolds.forEach((hold, i, all) => {
      if (i > 0) expect(hold.holdStart).toBeGreaterThan(all[i - 1]!.holdEnd);
    });
    expect(itinerary.anchors.map((a) => a.screen)).toEqual(manifest.anchors.map((a) => a.screen));
    expect(itinerary.anchors[0]!.holdStart).toBe(manifest.anchors[0]!.holdStart); // before both cuts
    expect(itinerary.anchors[2]!.holdStart).toBeCloseTo(manifest.anchors[2]!.holdStart + ITINERARY_INSERT_SECONDS);
    expect(itinerary.anchors[7]!.holdStart).toBeCloseTo(manifest.anchors[7]!.holdStart + ITINERARY_EXTRA_SECONDS);
    expect(itinerary.extras.map((e) => e.id)).toEqual(["ship", "apron"]);
    expect(itinerary.extras[0]!.holdStart).toBeCloseTo(21.5 + 2.5);
    expect(itinerary.extras[1]!.holdStart).toBeCloseTo(49.5 + ITINERARY_INSERT_SECONDS + 2.5);
  });

  it("detours the camera in world space and returns to the exact authored pose", () => {
    const { itinerary, camera, seek } = build();
    const world = () => camera.getWorldPosition(new Vector3());
    const at = (virtual: number) => {
      itinerary.restore();
      seek(itinerary.toSource(virtual));
      itinerary.applyPose(virtual, camera);
      return world();
    };
    const base = at(21.5);
    expect(at(21.5 + 5.5).distanceTo(base)).toBeGreaterThan(3); // lateral detour at the pane
    expect(at(21.5 + 8).distanceTo(base)).toBeLessThan(1e-6); // exactly back
    expect(at(21.5 + 8 + 1).x).toBeCloseTo(0.1 * (21.5 + 1));
  });

  it("builds uv-flipped, mapped panes under the catalog's names and removes them on dispose", () => {
    const { itinerary, root, camera } = build();
    for (const id of ["ship", "apron"]) {
      const image = root.getObjectByName("itinerary_" + id)?.getObjectByName(`itinerary_${id}_image`) as Mesh;
      expect(image).toBeInstanceOf(Mesh);
      expect((image.material as MeshBasicMaterial).map).not.toBeNull();
      expect(image.geometry.getAttribute("uv").getY(0)).toBe(0); // top-left origin, as authored panes
    }
    itinerary.dispose();
    itinerary.dispose();
    expect(root.getObjectByName("itinerary_ship")).toBeUndefined();
    expect(root.getObjectByName("itinerary_apron")).toBeUndefined();
    expect(camera.position.x).toBe(0);
  });
});

describe("extended itinerary recorded pool", () => {
  it("keeps the original ids and adds ship and apron as stable ids 8 and 9 on the virtual clock", () => {
    const { itinerary } = build();
    const entries = resolveCatalog(itinerary.anchors, itinerary.extras);
    expect(entries).toHaveLength(9); // 7 MEVA + 2 NASA; slot 2 keeps its still
    expect(entries.map((e) => e.anchorIndex).sort((a, b) => a - b)).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(entries.filter((e) => e.anchorIndex < 8).map((e) => e.id).sort()).toEqual(RECORDED_CATALOG.map((e) => e.id).sort());
    expect(entries.find((e) => e.id === "ship")).toMatchObject({ mesh: "itinerary_ship_image", video: "/assets/recorded-feeds/ship/loop.mp4" });
    expect(entries.find((e) => e.anchorIndex === 7)!.mesh).toBe("focal_screen");
    for (let t = 0; t <= itinerary.duration; t += 0.25) expect(selectPrepared(entries, t).length).toBeLessThanOrEqual(MAX_DECODERS);
  });

  it("stays at the base seven without extras", () => {
    expect(resolveCatalog(manifest.anchors)).toHaveLength(7);
    expect(resolveCatalog(manifest.anchors).some((e) => e.anchorIndex >= 8)).toBe(false);
  });
});

describe("object markers and staged NASA tracking", () => {
  it("parses the staged files with their authored kinds and durations", () => {
    expect(parseRecordedTracking(shipTracking).duration).toBe(32);
    expect(parseRecordedTracking(apronTracking).duration).toBe(33);
    expect(sampleHeads(parseRecordedTracking(shipTracking), 1)[0]?.entityKind).toBe("watercraft");
    expect(sampleHeads(parseRecordedTracking(apronTracking), 1)[0]?.entityKind).toBe("aircraft");
    expect(() => parseRecordedTracking({ duration: 1, tracks: [{ id: "a", entityKind: "ufo", keyframes: [{ t: 0, x: 0, y: 0, w: 0.1, h: 0.1, visible: true }] }] })).toThrow();
  });

  function trace(head: Parameters<typeof drawNeutralReticle>[3]) {
    const points: number[][] = [];
    const styles: string[] = [];
    const ctx = {
      save() {}, restore() {}, translate() {}, beginPath() {}, moveTo(x: number, y: number) { points.push([x, y]); },
      lineTo(x: number, y: number) { points.push([x, y]); }, stroke(this: { strokeStyle: string }) { styles.push(String(this.strokeStyle)); },
      strokeRect() {}, setLineDash() {}, strokeStyle: "", lineWidth: 0, shadowColor: "", shadowBlur: 0, shadowOffsetY: 0,
    } as unknown as CanvasRenderingContext2D;
    drawNeutralReticle(ctx, 960, 540, head);
    return { points, styles };
  }

  it("draws a white diamond for watercraft and a modest green triangle for a wide aircraft box", () => {
    const ship = trace({ x: 0.425, y: 0.185, w: 0.36, h: 0.56, entityKind: "watercraft" });
    expect(ship.styles).toEqual(["#f0f1ec"]);
    expect(ship.points).toHaveLength(5);
    const aircraft = trace({ x: 0.015, y: 0.446, w: 0.815, h: 0.324, entityKind: "aircraft" });
    expect(aircraft.styles).toEqual(["#69bb77"]);
    const heightOf = Math.max(...aircraft.points.map((p) => p[1]!)) - Math.min(...aircraft.points.map((p) => p[1]!));
    expect(heightOf).toBeLessThanOrEqual(0.324 * 540 * 0.7 + 1e-6); // inside the box, not stretched by its width
  });

  it("keeps the neutral square for tracks without a kind", () => {
    const person = trace({ x: 0.4, y: 0.4, w: 0.1, h: 0.1 });
    expect(person.styles).toEqual(["#d9dcd3"]);
  });
});
