// Base class for enemy mesh builders
class MeshBuilder {
  // Default implementation - should be overridden by subclasses
  buildMesh(body, enemyType) {
    console.warn(
      'Base MeshBuilder.buildMesh() called. This should be overridden.'
    );
  }

  // Helper method to dispose of resources
  disposeMaterial(material) {
    if (!material) return;

    // Dispose textures
    const propertiesToCheck = [
      'map',
      'lightMap',
      'bumpMap',
      'normalMap',
      'specularMap',
      'envMap',
      'emissiveMap',
      'roughnessMap',
      'metalnessMap',
      'alphaMap',
    ];

    propertiesToCheck.forEach((prop) => {
      if (material[prop]) {
        material[prop].dispose();
      }
    });

    material.dispose();
  }
}

export default MeshBuilder;
