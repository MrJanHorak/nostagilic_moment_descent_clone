import * as THREE from 'three';

/** An opaque collider with a translucent, double-sided energy membrane.
 * Geometry shares the compiled doorway's world axes, including floor hatches.
 * @param {THREE.Group} root @param {import('../contracts.js').SolidCollider[]} colliders
 * @param {NonNullable<import('../levelDocument.js').ArenaLevel['doors']>[number]} door */
export function buildForceField(root, colliders, door) {
  const group = new THREE.Group(); group.name = door.id; group.position.fromArray(door.solid.center); root.add(group);
  const normal = door.normalAxis ?? 2, u = door.slideAxis ?? 0, v = normal === 1 ? 2 : 1;
  const width = door.solid.size[u], height = door.solid.size[v];
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, span: { value: new THREE.Vector2(width, height) } },
    vertexShader: `varying vec2 fieldUV;
      void main() { fieldUV = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 fieldUV; uniform float time; uniform vec2 span;
      void main() {
        vec2 p = fieldUV * span;
        vec2 grid = abs(fract(p * 2.0) - 0.5);
        float lattice = 1.0 - smoothstep(0.025, 0.055, min(grid.x, grid.y));
        float scan = pow(0.5 + 0.5 * sin(p.y * 5.0 - time * 3.0), 16.0);
        float edge = pow(1.0 - min(min(fieldUV.x, 1.0-fieldUV.x), min(fieldUV.y, 1.0-fieldUV.y)) * 2.0, 12.0);
        float pulse = 0.5 + 0.5 * sin(time * 2.4);
        gl_FragColor = vec4(mix(vec3(0.02, 0.35, 0.65), vec3(0.3, 0.95, 1.0), lattice * 0.6 + edge * 0.4),
          0.16 + lattice * 0.3 + scan * 0.12 + edge * 0.25 + pulse * 0.04);
      }`,
  });
  const membrane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  if (normal === 0) membrane.rotation.y = Math.PI / 2;
  if (normal === 1) membrane.rotation.x = Math.PI / 2;
  group.add(membrane);
  const housing = new THREE.MeshStandardMaterial({ color: 0x283c4d, metalness: 0.6, roughness: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x65f4ff });
  for (const axis of [u, v]) for (const side of [-1, 1]) {
    const size = new THREE.Vector3(0.18, 0.18, 0.18).setComponent(normal, door.solid.size[normal]);
    size.setComponent(axis === u ? v : u, door.solid.size[axis === u ? v : u]);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), housing);
    rail.position.setComponent(axis, side * (door.solid.size[axis] / 2 - 0.09)); group.add(rail);
    // Repeating emitters make the barrier recognizable from either side.
    const along = axis === u ? v : u, count = Math.max(2, Math.floor(door.solid.size[along] / 1.5));
    for (let i = 0; i < count; i++) {
      const emitter = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.23, 0.23), glow);
      emitter.position.copy(rail.position).setComponent(along, ((i + 0.5) / count - 0.5) * door.solid.size[along]); group.add(emitter);
    }
  }
  colliders.push({ id: door.id, box: new THREE.Box3().setFromCenterAndSize(group.position, new THREE.Vector3(...door.solid.size)) });
  group.traverse(child => { child.userData.doorId = door.id; });
  return { group, material };
}
