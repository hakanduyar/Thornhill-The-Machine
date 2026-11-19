import { Mesh, type Material, type Object3D } from "three";

/** Reversible photo-depth separation for the interactive Machine world. */
export function createMachinePhotoPresentation(root: Object3D) {
  const materials = new Map<Material, Material>();
  const swaps: Array<[Mesh, Material]> = [];
  const hidden: Array<[Object3D, boolean]> = [];
  root.traverse((object) => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return;
    const source = object.material;
    if (/^screen_0[1-8]_.+_tab_(red|white)$/.test(object.name)) {
      hidden.push([object, object.visible]);
      object.visible = false;
    }
    if (source.name !== "mat_field_nodes" && source.name !== "mat_macro_nodes") return;
    let material = materials.get(source);
    if (!material) {
      const clone: Material = source.clone();
      // The atlas photographs sit less than one depth-buffer step ahead of
      // their filled backing frames. Bias only the photo surface, retaining
      // its texture, mip filtering, opacity and authored geometry.
      clone.polygonOffset = true;
      clone.polygonOffsetFactor = -1;
      clone.polygonOffsetUnits = -2;
      materials.set(source, clone);
      material = clone;
    }
    swaps.push([object, source]);
    object.material = material;
  });
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [mesh, material] of swaps) mesh.material = material;
      for (const [object, visible] of hidden) object.visible = visible;
      for (const material of materials.values()) material.dispose();
      materials.clear();
      swaps.length = 0;
      hidden.length = 0;
    },
  };
}

export type MachinePhotoPresentation = ReturnType<typeof createMachinePhotoPresentation>;
