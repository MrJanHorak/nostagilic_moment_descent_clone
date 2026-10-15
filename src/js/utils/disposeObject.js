// Entity-owned resources are disposed once; manager-owned caches survive sessions.
export default function disposeObject(object, keepGeometries = new Set(), keepMaterials = new Set()) {
  if (!object) return;
  const geometries = new Set(), materials = new Set();
  object.traverse((child) => {
    if (child.geometry && !keepGeometries.has(child.geometry)) geometries.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      if (material && !keepMaterials.has(material)) materials.add(material);
    }
  });
  object.removeFromParent();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
