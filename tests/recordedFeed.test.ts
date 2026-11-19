// @vitest-environment jsdom
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRecordedFeed } from "../src/player/recordedFeed";
import { MAX_DECODERS, RECORDED_CATALOG, resolveCatalog, selectPrepared } from "../src/player/recordedCatalog";
import manifest from "../public/assets/machine/manifest.json";
import { sampleHeads, type RecordedTracking } from "../src/player/recordedTracking";

const frame = (t: number, x: number, visible = true) => ({ t, x, y: 0.2, w: 0.1, h: 0.1, visible });

describe("recorded tracking interpolation", () => {
  const data: RecordedTracking = {
    duration: 10,
    tracks: [{ id: "a", keyframes: [frame(2, 0.1), frame(4, 0.5), frame(6, 0.5, false), frame(8, 0.7)] }],
  };

  it("interpolates linearly between visible keyframes and never extrapolates", () => {
    expect(sampleHeads(data, 3)[0]?.x).toBeCloseTo(0.3);
    expect(sampleHeads(data, 1)).toEqual([]);
    expect(sampleHeads(data, 9)).toEqual([]);
  });

  it("draws nothing across a gap that ends invisible", () => {
    expect(sampleHeads(data, 5)).toEqual([]);
    expect(sampleHeads(data, 4)).toHaveLength(1);
  });
});

describe("recorded catalog", () => {
  const anchors = manifest.anchors;

  it("maps seven media to the original eight-screen order and leaves anchor 1 as the still", () => {
    const entries = resolveCatalog(anchors);
    expect(entries.map((e) => e.anchorIndex)).toEqual([0, 2, 3, 4, 5, 6, 7]);
    expect(entries.map((e) => e.id)).toEqual(["m05", "m06", "m04", "m07", "m01", "m02", "m03"]);
    expect(entries.find((e) => e.anchorIndex === 1)).toBeUndefined();
    expect(entries[6]?.mesh).toBe("focal_screen");
    expect(entries[2]?.holdStart).toBe(anchors[3]!.holdStart);
  });

  it("skips entries whose anchor is missing or names a different screen", () => {
    expect(resolveCatalog(undefined)).toEqual([]);
    expect(resolveCatalog(anchors.slice(0, 2))).toHaveLength(1);
    const swapped = anchors.map((a, i) => (i === 2 ? { ...a, screen: "other" } : a));
    expect(resolveCatalog(swapped).map((e) => e.id)).not.toContain("m06");
  });

  it("never prepares more than the current and nearest upcoming decoder", () => {
    const entries = resolveCatalog(anchors);
    for (let t = 0; t <= 90; t += 0.25) {
      const chosen = selectPrepared(entries, t);
      expect(chosen.length).toBeLessThanOrEqual(MAX_DECODERS);
    }
    const at = selectPrepared(entries, anchors[3]!.holdStart + 0.5);
    expect(at[0]?.id).toBe("m04");
    expect(selectPrepared(entries, 1000)).toEqual([]);
  });

  it("covers every catalog entry with an existing manifest anchor", () => {
    expect(RECORDED_CATALOG.every((e) => anchors[e.anchorIndex]?.screen === e.screen)).toBe(true);
  });
});

describe("recorded feed lifecycle", () => {
  afterEach(() => vi.unstubAllGlobals());

  function build() {
    const root = new Group();
    const parts = anchors().map(({ screen }, index) => {
      const group = new Group();
      group.name = screen;
      const geometry = new BoxGeometry();
      const material = new MeshBasicMaterial({ map: new Texture() });
      const mesh = new Mesh(geometry, material);
      mesh.name = index === 7 ? "focal_screen" : `${screen}_image`;
      group.add(mesh);
      root.add(group);
      return { mesh, geometry, material };
    });
    return { root, parts };
  }
  const anchors = () => manifest.anchors;

  it("leaves every authored mesh untouched and restores it on repeated dispose when assets are unavailable", () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const { root, parts } = build();
    const feed = createRecordedFeed(root, document, () => {}, anchors());
    feed.update(anchors()[0]!.holdStart, undefined);
    feed.update(anchors()[7]!.holdStart, undefined);
    feed.dispose();
    feed.dispose();
    for (const { mesh, geometry, material } of parts) {
      expect(mesh.geometry).toBe(geometry);
      expect(mesh.material).toBe(material);
    }
  });

  it("is inert without matching anchors", () => {
    const { root } = build();
    const feed = createRecordedFeed(root, document, () => {}, undefined);
    feed.update(0, undefined);
    feed.dispose();
  });
});
