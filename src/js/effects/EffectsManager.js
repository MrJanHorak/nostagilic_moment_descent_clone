import * as THREE from 'three';
import ObjectPool from '../utils/ObjectPool.js';
import disposeObject from '../utils/disposeObject.js';

/** @typedef {THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>} HitParticles */
/** @typedef {THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>} ExplosionMesh */
/** @typedef {{hitLight: THREE.PointLight, explosionLight: THREE.PointLight, hitParticles: HitParticles, explosionMesh: ExplosionMesh}} EffectPools */
/** @typedef {{position: THREE.Vector3, createdAt: number, duration: number, particleSystem?: HitParticles}} HitEffect */
/** @typedef {{mesh: ExplosionMesh, createdAt: number, duration: number, baseSize: number}} ExplosionEffect */

class EffectsManager {
  /** @param {THREE.Scene} scene
   * @param {import('../core/GameSession.js').default | null} [session] */
  constructor(scene, session = null) {
    this.scene = scene;
    this.session = session;
    this.elapsedMs = 0;
    this.disposed = false;
    /** @private */
    this.clearing = false;
    /** @private */
    this.generation = 0;
    /** @type {ObjectPool<EffectPools>} */
    this.objectPool = new ObjectPool({ maxPerPool: 32, onDiscard: object => disposeObject(object) });
    /** @type {HitEffect[]} */
    this.hitEffects = [];
    /** @type {ExplosionEffect[]} */
    this.explosionEffects = [];
    /** @type {THREE.PointLight[]} */
    this.activeHitLights = [];
    /** @type {THREE.PointLight[]} */
    this.activeExplosionLights = [];
    /** @private @type {WeakMap<THREE.PointLight, number>} */
    this.lightDeadlines = new WeakMap();
  }

  /** @param {THREE.Vector3} position */
  createHitEffect(position) {
    this.assertUsable();
    const flash = this.objectPool.getFromPool('hitLight') || new THREE.PointLight(0xffff00, 1.5, 4);
    flash.position.copy(position);
    flash.visible = true;
    flash.intensity = 1.5;
    this.lightDeadlines.set(flash, this.now() + 100);
    this.activeHitLights.push(flash);
    this.hitEffects.push({ position: position.clone(), createdAt: this.now(), duration: 300 });
    this.scene.add(flash);
  }

  /** @param {THREE.Vector3} position
   * @param {THREE.ColorRepresentation} color
   * @param {boolean} [isExplosive]
   * @param {number} [explosionRadius] */
  createExplosion(position, color, isExplosive = false, explosionRadius = 1.0) {
    this.assertUsable();
    const generation = this.generation;
    const light = this.objectPool.getFromPool('explosionLight') || new THREE.PointLight();
    light.color.set(color);
    light.intensity = 1.5;
    light.distance = isExplosive ? 4.0 : 1.5;
    light.position.copy(position);
    light.visible = true;
    this.lightDeadlines.set(light, this.now() + 200);
    this.activeExplosionLights.push(light);
    this.scene.add(light);
    if (generation !== this.generation) return;

    if (isExplosive) {
      const explosion = this.objectPool.getFromPool('explosionMesh') || new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 12, 12),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.7, side: THREE.DoubleSide })
      );
      explosion.material.color.set(color);
      explosion.material.opacity = 0.7;
      explosion.scale.set(1, 1, 1);
      explosion.position.copy(position);
      explosion.visible = true;
      this.explosionEffects.push({ mesh: explosion, createdAt: this.now(), duration: 500, baseSize: explosionRadius || 1.0 });
      this.scene.add(explosion);
    }
  }

  /** @private @returns {HitParticles} */
  createHitParticleSystem() {
    this.assertUsable();
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(5 * 3);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = (Math.random() - 0.5) * 0.3;
      positions[i + 1] = (Math.random() - 0.5) * 0.3;
      positions[i + 2] = (Math.random() - 0.5) * 0.3;
    }
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(particles, new THREE.PointsMaterial({
      color: 0xffaa00, size: 0.08, transparent: true, opacity: 0.7, blending: THREE.NormalBlending,
    }));
  }

  /** @private @param {THREE.PointLight[]} lights
   * @param {'hitLight' | 'explosionLight'} poolName
   * @param {number} dimming */
  processLights(lights, poolName, dimming) {
    const generation = this.generation;
    const currentTime = this.now();
    for (let i = lights.length - 1; i >= 0; i--) {
      const light = lights[i];
      light.intensity *= dimming;
      if (currentTime > (this.lightDeadlines.get(light) ?? Infinity)) {
        lights.splice(i, 1);
        this.lightDeadlines.delete(light);
        light.removeFromParent();
        if (generation !== this.generation) { disposeObject(light); return; }
        this.objectPool.returnToPool(poolName, light);
        if (generation !== this.generation) return;
      }
    }
  }

  processHitEffects() {
    if (this.disposed || this.clearing) return;
    const generation = this.generation;
    this.processLights(this.activeHitLights, 'hitLight', 0.9);
    if (generation !== this.generation) return;
    const currentTime = this.now();
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const effect = this.hitEffects[i];
      if (!effect.particleSystem) {
        const particles = this.objectPool.getFromPool('hitParticles') || this.createHitParticleSystem();
        particles.position.copy(effect.position);
        particles.visible = true;
        effect.particleSystem = particles;
        this.scene.add(particles);
        if (generation !== this.generation) return;
      }
      const progress = Math.min((currentTime - effect.createdAt) / effect.duration, 1.0);
      effect.particleSystem.material.opacity = 0.7 * (1 - progress);
      if (progress >= 1.0) {
        this.hitEffects.splice(i, 1);
        effect.particleSystem.removeFromParent();
        if (generation !== this.generation) { disposeObject(effect.particleSystem); return; }
        this.objectPool.returnToPool('hitParticles', effect.particleSystem);
        if (generation !== this.generation) return;
      }
    }
  }

  processExplosionEffects() {
    if (this.disposed || this.clearing) return;
    const generation = this.generation;
    this.processLights(this.activeExplosionLights, 'explosionLight', 0.85);
    if (generation !== this.generation) return;
    const currentTime = this.now();
    for (let i = this.explosionEffects.length - 1; i >= 0; i--) {
      const effect = this.explosionEffects[i];
      const progress = Math.min((currentTime - effect.createdAt) / effect.duration, 1.0);
      effect.mesh.scale.setScalar((1 + progress * 1.5) * effect.baseSize);
      effect.mesh.material.opacity = 0.7 * (1 - progress);
      if (progress >= 1.0) {
        this.explosionEffects.splice(i, 1);
        effect.mesh.removeFromParent();
        if (generation !== this.generation) { disposeObject(effect.mesh); return; }
        this.objectPool.returnToPool('explosionMesh', effect.mesh);
        if (generation !== this.generation) return;
      }
    }
  }

  now() { return this.session?.timeMs ?? this.elapsedMs; }

  // Session clear is reusable. Invalidate every reference before disposal hooks.
  clear() {
    if (this.clearing) return;
    this.clearing = true;
    this.generation++;
    const objects = new Set([
      ...this.activeHitLights, ...this.activeExplosionLights,
      ...this.hitEffects.map(effect => effect.particleSystem),
      ...this.explosionEffects.map(effect => effect.mesh), ...this.objectPool.drainAll(),
    ]);
    this.hitEffects.length = 0;
    this.explosionEffects.length = 0;
    this.activeHitLights.length = 0;
    this.activeExplosionLights.length = 0;
    this.lightDeadlines = new WeakMap();
    this.elapsedMs = 0;
    try {
      for (const object of objects) disposeObject(object);
    } finally {
      this.clearing = false;
    }
  }

  // Permanent retirement is distinct from returning to the menu or restarting.
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
  }

  /** @private */
  assertUsable() {
    if (this.disposed) throw new Error('EffectsManager is disposed');
    if (this.clearing) throw new Error('EffectsManager is clearing');
  }

  /** @param {number} [delta] */
  update(delta = 0) {
    if (this.disposed || this.clearing || (this.session && this.session.phase !== 'playing')) return;
    if (!this.session) this.elapsedMs += delta * 1000;
    this.processHitEffects();
    this.processExplosionEffects();
  }
}

export default EffectsManager;
