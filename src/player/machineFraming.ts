import { MathUtils, type PerspectiveCamera } from "three";
import type { Rect } from "./letterbox";

/** Vertical FOV ceiling for very tall hosts; beyond it the sides are cropped instead of leaving bars. */
const MAX_VERTICAL_FOV = 140;
const HAZE_COVERAGE_MARGIN = 1.02;

/**
 * Interactive Machine framing: the canvas always fills the whole host (no bars).
 * The projection aspect equals the host aspect, so nothing is stretched or
 * cropped by CSS. The source frustum is always fully contained: a wider host
 * keeps the source vertical FOV and reveals more to the sides; a narrower one
 * keeps the source horizontal extent and reveals more above and below (until
 * the vertical ceiling, after which only the sides are trimmed). The exact
 * letterboxed reference remains the runtime fallback when this helper is not
 * created (non-interactive / non-Machine).
 */
export function createMachineFraming(
  camera: PerspectiveCamera,
  sourceAspect: number,
): (containerWidth: number, containerHeight: number) => Rect {
  const sourceFov = camera.fov;
  const sourceVerticalHalfTangent = Math.tan(MathUtils.degToRad(sourceFov / 2));
  const sourceHorizontalHalfTangent = sourceAspect * sourceVerticalHalfTangent;
  const maxVerticalHalfTangent = Math.tan(MathUtils.degToRad(MAX_VERTICAL_FOV / 2));
  const validSource = sourceFov > 0 && sourceFov < 180 && sourceAspect > 0;
  // The animated camera rig carries both the lens and the haze plane.
  const haze = camera.parent?.children.find((child) => child.name === "fx_haze_backdrop");
  const sourceHazeScaleX = haze?.scale.x ?? 1;
  const sourceHazeScaleY = haze?.scale.y ?? 1;

  return (containerWidth, containerHeight) => {
    const width = Number.isFinite(containerWidth) ? Math.max(0, Math.floor(containerWidth)) : 0;
    const height = Number.isFinite(containerHeight) ? Math.max(0, Math.floor(containerHeight)) : 0;
    if (width === 0 || height === 0 || !validSource) {
      // Nothing to draw into / unusable lens: leave the camera as last set.
      return { x: 0, y: 0, width, height };
    }

    const aspect = width / height;
    let verticalHalfTangent = sourceVerticalHalfTangent;
    let horizontalHalfTangent = aspect * verticalHalfTangent;
    if (aspect < sourceAspect) {
      // Keep the source width; the vertical extent grows (bounded), then sides are trimmed.
      verticalHalfTangent = Math.min(sourceHorizontalHalfTangent / aspect, maxVerticalHalfTangent);
      horizontalHalfTangent = aspect * verticalHalfTangent;
    }
    const fov = verticalHalfTangent === sourceVerticalHalfTangent
      ? sourceFov
      : MathUtils.radToDeg(2 * Math.atan(verticalHalfTangent));

    if (camera.aspect !== aspect || camera.fov !== fov) {
      camera.aspect = aspect;
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (haze) {
      // The finite plane must cover the enlarged frustum on both axes (never shrink below authored).
      const growX = Math.max(1, horizontalHalfTangent / sourceHorizontalHalfTangent);
      const growY = Math.max(1, verticalHalfTangent / sourceVerticalHalfTangent);
      haze.scale.x = growX > 1 ? sourceHazeScaleX * growX * HAZE_COVERAGE_MARGIN : sourceHazeScaleX;
      haze.scale.y = growY > 1 ? sourceHazeScaleY * growY * HAZE_COVERAGE_MARGIN : sourceHazeScaleY;
    }
    return { x: 0, y: 0, width, height };
  };
}
