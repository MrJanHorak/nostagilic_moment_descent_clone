import * as THREE from 'three';

/** @type {WeakMap<THREE.BufferAttribute | THREE.InterleavedBufferAttribute, Float32Array>} */
const shieldRestPositions = new WeakMap();

/** @param {THREE.Object3D} child @returns {readonly THREE.Material[]} */
function materials(child) {
  if (!(child instanceof THREE.Mesh || child instanceof THREE.Points || child instanceof THREE.Line)) return [];
  return Array.isArray(child.material) ? child.material : [child.material];
}

/** @param {THREE.Object3D} child @param {number} intensity */
function setGlow(child, intensity) {
  for (const material of materials(child)) {
    if (material instanceof THREE.MeshStandardMaterial) material.emissiveIntensity = intensity;
  }
}

/** @param {THREE.Object3D} child @param {number} opacity */
function setOpacity(child, opacity) {
  for (const material of materials(child)) material.opacity = opacity;
}

/** Preserve the existing falsy-value defaults while rejecting malformed metadata.
 * @param {unknown} value @param {number} fallback */
function animationNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value || fallback : fallback;
}

/** @param {string} name */
function componentIndex(name) {
  const index = Number.parseFloat(name.split('_').pop() ?? '');
  return Number.isFinite(index) ? index : 0;
}

/** @param {THREE.Object3D} child @param {number} currentTime */
function animatePulsatingComponent(child, currentTime) {
  /** @type {Record<string, unknown>} */
  const data = child.userData;
  if (!data.pulsate) return;
  const pulseSpeed = animationNumber(data.pulseSpeed, 3.0);
  const pulseMin = animationNumber(data.pulseMin, 0.8);
  const pulseMax = animationNumber(data.pulseMax, 1.2);
  const pulseAxis = data.pulseAxis || 'all';
  const pulseFactor = Math.sin(currentTime * pulseSpeed * 0.01) * 0.5 + 0.5;
  const scale = pulseMin + pulseFactor * (pulseMax - pulseMin);
  if (pulseAxis === 'all') child.scale.setScalar(scale);
  else if (pulseAxis === 'x' || pulseAxis === 'y' || pulseAxis === 'z') child.scale[pulseAxis] = scale;
  setGlow(child, scale);
}

/** @param {THREE.Object3D} child @param {number} delta */
function animateRotatingComponent(child, delta) {
  /** @type {Record<string, unknown>} */
  const data = child.userData;
  if (!data.rotate) return;
  const axis = data.rotationAxis || 'y';
  if (axis !== 'x' && axis !== 'y' && axis !== 'z') return;
  child.rotation[axis] += animationNumber(data.rotationSpeed, 0.01) * delta;
}

/** @param {import('../combatContracts.js').EnemyShooter} enemy
 * @param {number} delta @param {number} [currentTime] */
export function animateEnemy(enemy, delta, currentTime = 0) {
  if (!Number.isFinite(delta) || delta < 0 || !Number.isFinite(currentTime)) return;
  enemy.mesh.traverse(child => {
    animatePulsatingComponent(child, currentTime);
    animateRotatingComponent(child, delta);
  });
  switch (enemy.type.name) {
    case 'boss': animateBoss(enemy, currentTime); break;
    case 'bomber': animateBomber(enemy, currentTime); break;
    case 'destroyer': animateDestroyer(enemy, currentTime, delta); break;
    case 'fighter': animateFighter(enemy, currentTime); break;
    case 'scout': animateScout(enemy); break;
  }
}

/** Deform from rest positions: repeated frames must not accumulate distortion.
 * @param {THREE.Mesh} shield @param {number} currentTime */
function animateShield(shield, currentTime) {
  const positions = shield.geometry.getAttribute('position');
  if (!positions) return;
  let rest = shieldRestPositions.get(positions);
  if (!rest) {
    rest = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      rest.set([positions.getX(i), positions.getY(i), positions.getZ(i)], i * 3);
    }
    shieldRestPositions.set(positions, rest);
  }
  for (let i = 0; i < positions.count; i++) {
    const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
    const distance = Math.sqrt(x * x + y * y + z * z);
    const wave = Math.sin(distance * 5 + currentTime * 0.3) * 0.05;
    const factor = distance > 0 ? (distance + wave) / distance : 1;
    positions.setXYZ(i, x * factor, y * factor, z * factor);
  }
  positions.needsUpdate = true;
}

/** @param {import('../combatContracts.js').EnemyShooter} enemy @param {number} currentTime */
function animateBoss(enemy, currentTime) {
  enemy.mesh.traverse(child => {
    if (child.name === 'boss_shield' && child instanceof THREE.Mesh) animateShield(child, currentTime);
    if (child.name.includes('boss_weapon_pod_')) {
      const wobbleSpeed = 0.5 + componentIndex(child.name) * 0.2;
      child.rotation.x += (Math.sin(currentTime * wobbleSpeed) * 0.05 - child.rotation.x) * 0.05;
      child.rotation.y += (Math.cos(currentTime * wobbleSpeed * 1.3) * 0.05 - child.rotation.y) * 0.05;
    }
    if (child.name.includes('boss_energy_arc_')) {
      setOpacity(child, 0.3 + (Math.sin(currentTime * 15) * 0.5 + 0.5) * 0.7);
    }
  });
}

/** @param {import('../combatContracts.js').EnemyShooter} enemy @param {number} currentTime */
function animateBomber(enemy, currentTime) {
  const pitchWobble = Math.sin(currentTime * 1.5) * 0.05;
  const rollWobble = Math.cos(currentTime * 1.5 * 0.7) * 0.05;
  enemy.mesh.rotation.x += (pitchWobble - enemy.mesh.rotation.x) * 0.1;
  enemy.mesh.rotation.z += (rollWobble - enemy.mesh.rotation.z) * 0.1;
  enemy.mesh.traverse(child => {
    if (child.name.includes('bomber_engine_glow_')) {
      const pulseFactor = Math.sin(currentTime * 5 + componentIndex(child.name) * Math.PI / 2) * 0.5 + 0.5;
      setOpacity(child, 0.4 + pulseFactor * 0.6);
      setGlow(child, 0.7 + pulseFactor * 0.3);
    }
    if (child.name.includes('bomber_tube_')) {
      const index = componentIndex(child.name);
      const extension = Math.sin(currentTime * (3 + index * 0.5) + index * Math.PI / 4) * 0.5 + 0.5;
      child.position.y = -enemy.type.size * 0.3 - extension * enemy.type.size * 0.15;
    }
  });
}

/** @param {import('../combatContracts.js').EnemyShooter} enemy @param {number} currentTime @param {number} delta */
function animateDestroyer(enemy, currentTime, delta) {
  enemy.mesh.traverse(child => {
    if (child.name === 'destroyer_radar_dish') child.rotation.y += 0.02 * delta;
    if (child.name.includes('destroyer_warning_light_')) {
      const index = componentIndex(child.name);
      const blink = Math.sin(currentTime * (1 + index * 0.3) + index * Math.PI / 3) > 0 ? 1 : 0.2;
      setGlow(child, blink);
    }
    if (child.name.includes('turret') || child.name.includes('cannon')) {
      child.rotation.x += (Math.sin(currentTime * 0.8) * 0.03 - child.rotation.x) * 0.05;
      child.rotation.y += (Math.cos(currentTime * 0.8 * 1.2) * 0.03 - child.rotation.y) * 0.05;
    }
  });
}

/** @param {import('../combatContracts.js').EnemyShooter} enemy @param {number} currentTime */
function animateFighter(enemy, currentTime) {
  enemy.mesh.rotation.z += (Math.sin(currentTime * 3) * 0.2 - enemy.mesh.rotation.z) * 0.1;
  enemy.mesh.traverse(child => {
    if (child.name.includes('engine')) setGlow(child, 0.7 + (Math.sin(currentTime * 10) * 0.5 + 0.5) * 0.3);
  });
}

/** @param {import('../combatContracts.js').EnemyShooter} enemy */
function animateScout(enemy) {
  enemy.mesh.rotation.x += (Math.random() - 0.5) * 0.01;
  enemy.mesh.rotation.y += (Math.random() - 0.5) * 0.01;
  enemy.mesh.rotation.z += (Math.random() - 0.5) * 0.01;
}

/** @param {import('../contracts.js').EnemyType} enemyType */
export function getEnemyFiringRange(enemyType) {
  switch (enemyType) {
    case 'bomber': return 25;
    case 'destroyer': return 30;
    case 'boss': return 40;
    case 'fighter': return 22;
    case 'scout': return 15;
    default: return 20;
  }
}
