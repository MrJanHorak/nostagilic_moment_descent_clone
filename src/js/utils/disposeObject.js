// Entity-owned resources are disposed once; manager-owned caches survive sessions.
import { BufferGeometry, Material } from 'three';

/** @param {import('three').Object3D | null | undefined} object
 * @param {ReadonlySet<BufferGeometry>} [keepGeometries] @param {ReadonlySet<Material>} [keepMaterials]
 */
export default function disposeObject(object, keepGeometries = new Set(), keepMaterials = new Set()) {
  if (!object) return;
  /** @type {Set<BufferGeometry>} */
  const geometries = new Set();
  /** @type {Set<Material>} */
  const materials = new Set();
  /** @param {unknown} material */
  const collectMaterial = material => {
    if (material instanceof Material && !keepMaterials.has(material)) materials.add(material);
  };
  object.traverse((child) => {
    if ('geometry' in child && child.geometry instanceof BufferGeometry && !keepGeometries.has(child.geometry)) geometries.add(child.geometry);
    if ('material' in child) {
      if (Array.isArray(child.material)) child.material.forEach(collectMaterial);
      else collectMaterial(child.material);
    }
  });
  object.removeFromParent();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
