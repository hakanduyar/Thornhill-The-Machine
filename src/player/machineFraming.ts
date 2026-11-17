import { MathUtils, type PerspectiveCamera } from "three";
import { letterbox, type Rect } from "./letterbox";

const MAX_VERTICAL_FOV = 105;
const HAZE_COVERAGE_MARGIN = 1.02;

/**
 * Captures the source projection once. A portrait Machine viewport keeps the
 * source width and reveals more above and below the animated camera's view.
 */
export function createMachineFraming(
  camera: PerspectiveCamera,
  sourceAspect: number,
): (containerWidth: number, containerHeight: number) => Rect {
  const sourceFov = camera.fov;
  const sourceHorizontalHalfTangent = sourceAspect * Math.tan(MathUtils.degToRad(sourceFov / 2));
  const maxVerticalHalfTangent = Math.tan(MathUtils.degToRad(MAX_VERTICAL_FOV / 2));
  // The animated camera rig carries both the lens and the haze plane.
  const haze = camera.parent?.children.find((child) => child.name === "fx_haze_backdrop");
  const sourceHazeScaleY = haze?.scale.y ?? 1;

  return (containerWidth, containerHeight) => {
    const width = Number.isFinite(containerWidth) ? Math.max(0, Math.floor(containerWidth)) : 0;
    const height = Number.isFinite(containerHeight) ? Math.max(0, Math.floor(containerHeight)) : 0;
    const rect = letterbox(width, height, sourceAspect);
    let aspect = sourceAspect;
    let fov = sourceFov;

    if (
      width < height && rect.width > 0 && rect.height < height
      && sourceFov > 0 && sourceFov < MAX_VERTICAL_FOV
    ) {
      const maxHeight = Math.floor(rect.width * maxVerticalHalfTangent / sourceHorizontalHalfTangent);
      const expandedHeight = Math.min(height, maxHeight);
      if (expandedHeight > rect.height) {
        rect.height = expandedHeight;
        rect.y = Math.floor((height - expandedHeight) / 2);
        aspect = rect.width / expandedHeight;
        // aspect * tan(fov / 2) stays fixed, preserving horizontal framing.
        fov = MathUtils.radToDeg(2 * Math.atan(sourceHorizontalHalfTangent / aspect));
      }
    }

    if (camera.aspect !== aspect || camera.fov !== fov) {
      camera.aspect = aspect;
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    if (haze) {
      // The aspect ratio change also gives the vertical frustum expansion at the plane.
      haze.scale.y = fov === sourceFov
        ? sourceHazeScaleY
        : sourceHazeScaleY * (sourceAspect / aspect) * HAZE_COVERAGE_MARGIN;
    }
    return rect;
  };
}
