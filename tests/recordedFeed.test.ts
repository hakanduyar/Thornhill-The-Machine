// @vitest-environment jsdom
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Texture } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRecordedFeed, RECORDED_FEED } from "../src/player/recordedFeed";
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

describe("recorded feed lifecycle", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("leaves the authored mesh untouched and releases it on dispose when assets are unavailable", () => {
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")));
    const root = new Group();
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial({ map: new Texture() });
    const mesh = new Mesh(geometry, material);
    mesh.name = RECORDED_FEED.mesh;
    root.add(mesh);

    const feed = createRecordedFeed(root, document, () => {});
    feed.update(RECORDED_FEED.holdStart, undefined);
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.material).toBe(material);
    feed.dispose();
    feed.dispose();
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.material).toBe(material);
  });
});
