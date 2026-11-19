import {
  CanvasTexture,
  Frustum,
  Matrix4,
  Mesh,
  SRGBColorSpace,
  TextureLoader,
  type BufferGeometry,
  type Camera,
  type Material,
  type MeshBasicMaterial,
  type Object3D,
  type Texture,
} from "three";

import { assetPath } from "../contract/assetPath";
import { drawNeutralReticle, parseRecordedTracking, sampleHeads, type RecordedTracking } from "./recordedTracking";

/**
 * Opt-in recorded-feed pilot for one authored screen. The screen's hold window
 * comes from the parent manifest anchor; the decoder prepares and plays on the
 * approach, and is released once the route has moved on.
 */
export const RECORDED_FEED = {
  screen: "screen_01_hallway",
  mesh: "screen_01_hallway_image",
  holdStart: 6.103677,
  holdEnd: 8.903677,
  video: "/assets/recorded-feeds/m05/loop.mp4",
  poster: "/assets/recorded-feeds/m05/poster.jpg",
  tracking: "/assets/recorded-feeds/m05/tracking.json",
} as const;

/** Route seconds before the hold at which the decoder is created and preloads. */
export const PREPARE_LEAD_SECONDS = 12;
/** Route seconds before the hold at which playback starts. */
export const PLAY_LEAD_SECONDS = 5;
/** Route seconds after the hold during which playback continues. */
export const TRAIL_SECONDS = 3;

export interface RecordedFeedController {
  /** Route time in seconds; camera is used for frustum visibility when given. */
  update(time: number, camera?: Camera): void;
  dispose(): void;
}

interface Session {
  setPlaying(playing: boolean): void;
  close(): void;
}

const NOOP: RecordedFeedController = { update() {}, dispose() {} };

export function createRecordedFeed(root: Object3D, doc: Document, invalidate: () => void): RecordedFeedController {
  const found = root.getObjectByName(RECORDED_FEED.mesh);
  if (!(found instanceof Mesh) || Array.isArray(found.material) || !(found.material as MeshBasicMaterial).map) return NOOP;
  const mesh: Mesh = found;

  const abort = new AbortController();
  const frustum = new Frustum();
  const projection = new Matrix4();
  const originalGeometry: BufferGeometry = mesh.geometry;
  const originalMaterial = mesh.material as MeshBasicMaterial;
  let posterGeometry: BufferGeometry | null = null;
  let posterMaterial: MeshBasicMaterial | null = null;
  let posterTexture: Texture | null = null;
  let tracking: RecordedTracking | null = null;
  let session: Session | null = null;
  let failed = false;
  let disposed = false;

  const wake = () => { if (!disposed) invalidate(); };

  function openSession(): Session {
    const video = doc.createElement("video");
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.loop = true;
    video.preload = "auto";
    video.src = assetPath(RECORDED_FEED.video);

    const canvas = doc.createElement("canvas");
    const context = canvas.getContext("2d");
    const texture = new CanvasTexture(canvas);
    // glTF-style top-left UVs: same convention as the loaded atlas texture.
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    const material = posterMaterial!.clone();
    material.map = texture;
    material.needsUpdate = true;

    let active = false;
    let released = false;
    let pending = false;
    let sized = false;
    let hasFrame = false;
    let frameHandle = 0;
    const frameCallbacks = typeof video.requestVideoFrameCallback === "function";

    // Video pixels and overlay share one canvas, so they cannot drift apart.
    const paint = (time: number) => {
      if (!context || released || video.seeking || video.readyState < 2) return;
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return;
      if (!sized) {
        // Sized once, before the first upload; the GPU texture is never resized.
        canvas.width = width;
        canvas.height = height;
        sized = true;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (tracking) for (const head of sampleHeads(tracking, time)) drawNeutralReticle(context, canvas.width, canvas.height, head);
      hasFrame = true;
      texture.needsUpdate = true;
      if (active) mesh.material = material;
      wake();
    };
    // mediaTime is the timestamp of the exact pixels that were decoded.
    const presented = (_now: number, metadata: VideoFrameCallbackMetadata) => {
      if (released) return;
      paint(metadata.mediaTime);
      frameHandle = video.requestVideoFrameCallback(presented);
    };
    const fallbackPaint = () => { if (!frameCallbacks) paint(video.currentTime); };
    const onSeeking = () => wake();
    const fail = () => {
      if (released) return;
      failed = true;
      close();
      wake();
    };
    const setPlaying = (playing: boolean) => {
      active = playing && !doc.hidden && !released;
      if (!active) { video.pause(); return; }
      fallbackPaint();
      if (hasFrame && !video.seeking) mesh.material = material;
      if (video.paused && !pending) {
        pending = true;
        void video.play()
          .then(() => { if (!active || released || doc.hidden) video.pause(); else wake(); })
          .catch(fail)
          .finally(() => { pending = false; });
      }
    };
    const ready = () => { fallbackPaint(); setPlaying(active); wake(); };

    if (frameCallbacks) frameHandle = video.requestVideoFrameCallback(presented);
    video.addEventListener("seeking", onSeeking);
    video.addEventListener("timeupdate", fallbackPaint);
    video.addEventListener("loadeddata", ready);
    video.addEventListener("seeked", ready);
    video.addEventListener("error", fail);
    video.load();

    function close() {
      if (released) return;
      released = true;
      active = false;
      if (frameCallbacks) video.cancelVideoFrameCallback(frameHandle);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("timeupdate", fallbackPaint);
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("seeked", ready);
      video.removeEventListener("error", fail);
      video.pause();
      if (posterMaterial) mesh.material = posterMaterial;
      // Dropping the source releases the decoder.
      video.removeAttribute("src");
      video.load();
      material.dispose();
      texture.dispose();
      if (session === handle) session = null;
    }
    const handle: Session = { setPlaying, close };
    return handle;
  }

  const onVisibility = () => {
    if (doc.hidden) session?.setPlaying(false);
    wake();
  };
  doc.addEventListener("visibilitychange", onVisibility);

  // Tracking is tiny and optional: playback never depends on it.
  void fetch(assetPath(RECORDED_FEED.tracking), { signal: abort.signal })
    .then((response) => { if (!response.ok) throw new Error("Tracking unavailable"); return response.json(); })
    .then((json) => { tracking = parseRecordedTracking(json); wake(); })
    .catch(() => { /* Video remains available without overlay. */ });

  // The poster is the fallback image. Only once it has loaded is the atlas
  // mapping replaced by a full-texture mapping, so a failure keeps the original.
  void new TextureLoader().loadAsync(assetPath(RECORDED_FEED.poster)).then((texture) => {
    const uv = mesh.geometry.getAttribute("uv");
    if (disposed || !uv) { texture.dispose(); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < uv.count; i++) {
      minX = Math.min(minX, uv.getX(i)); maxX = Math.max(maxX, uv.getX(i));
      minY = Math.min(minY, uv.getY(i)); maxY = Math.max(maxY, uv.getY(i));
    }
    if (!(maxX > minX && maxY > minY)) { texture.dispose(); return; }
    const geometry = mesh.geometry.clone();
    const cloned = geometry.getAttribute("uv");
    // Orientation is preserved; the atlas sub-rectangle is stretched to the full poster.
    for (let i = 0; i < cloned.count; i++) cloned.setXY(i, (cloned.getX(i) - minX) / (maxX - minX), (cloned.getY(i) - minY) / (maxY - minY));
    cloned.needsUpdate = true;
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    const material = originalMaterial.clone();
    material.map = texture;
    material.needsUpdate = true;
    posterGeometry = geometry;
    posterMaterial = material;
    posterTexture = texture;
    mesh.geometry = geometry;
    mesh.material = material;
    wake();
  }).catch(() => { /* Original atlas image remains. */ });

  const window_ = (time: number, lead: number) =>
    time >= RECORDED_FEED.holdStart - lead && time <= RECORDED_FEED.holdEnd + TRAIL_SECONDS;

  return {
    update(time, camera) {
      if (disposed || failed || !posterMaterial) return;
      if (!window_(time, PREPARE_LEAD_SECONDS)) { session?.close(); return; }
      let visible = window_(time, PLAY_LEAD_SECONDS) && mesh.visible && !doc.hidden;
      if (visible && camera) {
        camera.updateMatrixWorld();
        mesh.updateWorldMatrix(true, false);
        frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        visible = frustum.intersectsObject(mesh);
      }
      session ??= openSession();
      session.setPlaying(visible);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      doc.removeEventListener("visibilitychange", onVisibility);
      session?.close();
      mesh.geometry = originalGeometry;
      mesh.material = originalMaterial as Material;
      posterGeometry?.dispose();
      posterMaterial?.dispose();
      posterTexture?.dispose();
      posterGeometry = null; posterMaterial = null; posterTexture = null;
    },
  };
}
