import * as THREE from 'three';
import ScoutMeshBuilder from './meshBuilders/ScoutMeshBuilder.js';
import FighterMeshBuilder from './meshBuilders/FighterMeshBuilder.js';
import BomberMeshBuilder from './meshBuilders/BomberMeshBuilder.js';
import DestroyerMeshBuilder from './meshBuilders/DestroyerMeshBuilder.js';
import BossMeshBuilder from './meshBuilders/BossMeshBuilder.js';
import disposeObject from '../utils/disposeObject.js';

/** Refresh an enemy's hit box from its mesh, restored to full size when the
 * visible model is drawn smaller (see `scale` in createEnemy).
 * @param {{mesh: THREE.Object3D, collider: THREE.Box3, hitScale?: number}} enemy */
export function fitEnemyCollider(enemy) {
  enemy.collider.setFromObject(enemy.mesh);
  const factor = enemy.hitScale ?? 1;
  if (factor !== 1 && !enemy.collider.isEmpty()) {
    const center = enemy.collider.getCenter(new THREE.Vector3()), half = enemy.collider.getSize(new THREE.Vector3()).multiplyScalar(factor / 2);
    enemy.collider.min.copy(center).sub(half); enemy.collider.max.copy(center).add(half);
  }
}

class EnemyFactory {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    /** @type {Record<import('../contracts.js').EnemyType, import('../combatContracts.js').EnemyMeshBuilder>} */
    this.meshBuilders = {
      scout: new ScoutMeshBuilder(),
      fighter: new FighterMeshBuilder(),
      bomber: new BomberMeshBuilder(),
      destroyer: new DestroyerMeshBuilder(),
      boss: new BossMeshBuilder(),
    };
  }

  /** @param {import('../combatContracts.js').EnemyDefinition} enemyType
   * @param {THREE.Vector3} position
   * @param {Pick<THREE.Object3D, 'position'> | null} [playerTransform]
   * @param {{accentLights?: boolean, scale?: number}} [options] `scale` resizes the visible robot only: its hit box and body clearance keep their full-size values, so a smaller model is not harder to hit.
   * @returns {import('../combatContracts.js').EnemyInstance} */
  createEnemy(enemyType, position, playerTransform = null, { accentLights = true, scale = 1 } = {}) {
    if (!enemyType || !Object.hasOwn(this.meshBuilders, enemyType.name)) {
      throw new RangeError('Unknown enemy type');
    }
    const fields = /** @type {const} */ (['color', 'size', 'health', 'speed', 'damage', 'pointValue']);
    if (fields.some(key => !Number.isFinite(enemyType[key]) || enemyType[key] < 0) || enemyType.size === 0 || enemyType.health === 0) {
      throw new RangeError('Enemy definition requires finite nonnegative values and positive size/health');
    }
    if (!(position instanceof THREE.Vector3) || ![position.x, position.y, position.z].every(Number.isFinite)) {
      throw new TypeError('Enemy position must be a finite Vector3');
    }
    const body = new THREE.Group();
    // Builders transfer their attached resources to this body. Failed construction
    // disposes that partial tree before exposing it to the scene or caller.
    try {
      body.name = `${enemyType.name}_enemy`;

      // Add debug property
      body.userData.creationInfo = {
        createdAt: new Date().toISOString(),
        creator: 'createEnemyMesh',
        enemyType: enemyType.name,
      };

      // Use appropriate mesh builder
      const meshBuilder = this.meshBuilders[enemyType.name];
      meshBuilder.buildMesh(body, enemyType);

      // Emissive engine/eye meshes remain visible. Finite arenas add no actor
      // lights, so encountering/killing a robot cannot change shader variants.
      if (!accentLights) {
        /** @type {THREE.Light[]} */
        const lights = [];
        body.traverse(child => { if (child instanceof THREE.Light) lights.push(child); });
        for (const light of lights) light.removeFromParent();
      }

      // Conservative body envelope around the origin, independent of facing.
      // Includes wings/trails; reserve room for the small cosmetic animations.
      const bounds = new THREE.Box3().setFromObject(body);
      if (bounds.isEmpty()) throw new Error('Enemy builder produced no geometry');
      const axes = /** @type {const} */ (['x', 'y', 'z']);
      const extent = new THREE.Vector3(...axes.map(axis => Math.max(Math.abs(bounds.min[axis]), Math.abs(bounds.max[axis]))));
      const collisionRadius = extent.length() * 1.1;
      if (!Number.isFinite(collisionRadius)) throw new Error('Enemy builder produced invalid bounds');
      // Shrink the visible model after measuring it; gameplay volumes stay full size.
      if (scale !== 1) { body.scale.setScalar(scale); body.updateMatrixWorld(true); }

      // Position the enemy
      body.position.copy(position);

      // Look at player initially if playerTransform is provided
      if (playerTransform) {
        const lookAtPosition = playerTransform.position.clone();
        body.lookAt(lookAtPosition);
      }

      // Create enemy data object
      const enemy = {
        mesh: body,
        type: enemyType,
        health: enemyType.health,
        collider: new THREE.Box3(),
        velocity: new THREE.Vector3(),
        isActive: true,
        lastFireTime: 0,
        fireRate: 2000, // milliseconds between shots
        collisionRadius,
        hitScale: 1 / scale,
      };

      // Update the enemy collider
      fitEnemyCollider(enemy);

      // Add emissive glow to make enemies more visible
      body.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const material of materials) {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.emissive.set(enemyType.color);
              material.emissiveIntensity = 0.8;
            }
          }
        }
      });

      // Add a point light attached to enemy for better visibility
      if (accentLights) {
        const enemyLight = new THREE.PointLight(enemyType.color, 0.6, 5);
        enemyLight.position.set(0, 0, 0);
        body.add(enemyLight);
      }

      this.scene.add(body);
      return enemy;
    } catch (error) {
      disposeObject(body);
      throw error;
    }
  }
}

export default EnemyFactory;
