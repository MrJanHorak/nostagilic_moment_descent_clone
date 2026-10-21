import * as THREE from 'three';

/** Small local repeating textures; no remote images or asynchronous asset loads.
 * Each world's texture is disposed by its first owning material.
 * @returns {(definition: import('../levelDocument.js').SolidDefinition) => THREE.MeshStandardMaterial} */
export default function surfaceMaterials() {
  /** @type {Map<string, THREE.DataTexture>} */ const textures = new Map();
  return definition => {
    const material = new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.9, metalness: 0.1 });
    if (definition.pattern === 'panels') { material.roughness = 0.72; material.metalness = 0.38; }
    const fluid = definition.pattern === 'lava' || definition.pattern === 'water';
    if (fluid) {
      // Color is still authorable; emission gives the molten cracks their own
      // light without adding per-face point lights or a second render pass.
      material.emissive.setHex(definition.pattern === 'lava' ? 0xff5a15 : 0x278ca7);
      material.emissiveIntensity = definition.pattern === 'lava' ? 1.2 : 0.3;
      material.roughness = definition.pattern === 'lava' ? 0.75 : 0.25;
    }
    if (!definition.pattern || definition.pattern === 'plain') return material;
    let texture = textures.get(definition.pattern);
    if (!texture) {
      const data = new Uint8Array(64 * 64 * 4);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const line = definition.pattern === 'lava' ? Math.abs(Math.sin(x * 0.19 + Math.sin(y * 0.19635) * 1.7)) > 0.32 && Math.abs(Math.sin(y * 0.19 + Math.cos(x * 0.19635) * 1.7)) > 0.25
          : definition.pattern === 'water' ? Math.sin(y * Math.PI / 8 + Math.sin(x * Math.PI / 16)) > 0.35
          : definition.pattern === 'grid' ? x % 16 < 2 || y % 16 < 2
          : definition.pattern === 'panels' ? x < 3 || y < 3 || (y > 29 && y < 33 && x > 8 && x < 56)
          : (x + y) % 32 < 14;
        const index = (y * 64 + x) * 4;
        let shade = line ? definition.pattern === 'lava' ? 35 : 80 : 245;
        if (!fluid) {
          const grain = ((x * 17 + y * 31 + x * y * 3) % 19) - 9;
          shade = Math.max(25, Math.min(255, shade + grain - (line ? 0 : 16)));
          if (definition.pattern === 'panels') {
            const bolt = Math.min(...[8, 56].flatMap(bx => [8, 56].map(by => Math.hypot(x - bx, y - by))));
            if (bolt < 2.3) shade = bolt < 1 ? 180 : 60;
            if (x === 3 || y === 3) shade = 250;
          }
        }
        data[index] = shade; data[index + 1] = shade; data[index + 2] = shade; data[index + 3] = 255;
      }
      texture = new THREE.DataTexture(data, 64, 64); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.needsUpdate = true;
      const owned = texture; material.addEventListener('dispose', () => owned.dispose());
      textures.set(definition.pattern, texture);
    }
    material.map = texture;
    if (!fluid) { material.bumpMap = texture; material.bumpScale = 0.045; }
    if (fluid) material.emissiveMap = texture;
    return material;
  };
}
