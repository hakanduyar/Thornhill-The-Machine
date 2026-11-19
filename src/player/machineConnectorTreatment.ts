import { Mesh, MeshBasicMaterial, type Object3D } from "three";

const CONNECTOR_NODE = "cluster_04_armed_corridor_web";
const TINT: readonly [number, number, number] = [0.8, 0.85, 0.95];
const OPACITY_SCALE = 0.18 / 0.863723;

/**
 * Subdues the bright armed-corridor connector with one owned material clone.
 * The tint multiplies the original RGB and opacity; vertex colors, vertex alpha
 * and all other material settings are preserved. Missing nodes or anything other
 * than a single basic material is a harmless no-op. The returned disposer is
 * idempotent: it restores the original material and frees only the clone.
 */
export function applyMachineConnectorTreatment(root: Object3D): () => void {
  const node = root.getObjectByName(CONNECTOR_NODE);
  if (!(node instanceof Mesh)) return () => {};
  const source = node.material;
  if (Array.isArray(source) || !(source instanceof MeshBasicMaterial)) return () => {};

  const clone = source.clone();
  clone.color.setRGB(source.color.r * TINT[0], source.color.g * TINT[1], source.color.b * TINT[2]);
  clone.opacity = Math.min(1, source.opacity * OPACITY_SCALE);
  node.material = clone;

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    if (node.material === clone) node.material = source;
    clone.dispose();
  };
}
