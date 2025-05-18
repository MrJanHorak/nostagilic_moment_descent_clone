import * as THREE from 'three';
import ObjectPool from '../utils/ObjectPool.js';

class EffectsManager {
  constructor(scene) {
    this.scene = scene;
    this.objectPool = new ObjectPool();

    // Track effects for processing in animation loop
    this.hitEffects = [];
    this.explosionEffects = [];
    this.activeHitLights = [];
    this.activeExplosionLights = [];
  }

  // Create a visual effect when a projectile hits an enemy
  createHitEffect(position) {
    // Skip if there's no scene
    if (!this.scene) return;

    // Create a small flash at hit position - reuse an existing light if possible
    const flash =
      this.objectPool.getFromPool('hitLight') ||
      new THREE.PointLight(0xffff00, 1.5, 4); // Reduced intensity and distance
    flash.position.copy(position);
    flash.visible = true;
    flash.intensity = 1.5; // Reduced intensity

    // Add to scene
    this.scene.add(flash);

    // Store timestamp for cleanup in animation loop
    flash.userData.removeTime = Date.now() + 100;
    flash.userData.isActive = true;

    // Track light in active lights array
    if (!this.activeHitLights) {
      this.activeHitLights = [];
    }
    this.activeHitLights.push(flash);

    // Add to hits array for processing during main game loop
    if (!this.hitEffects) this.hitEffects = [];

    // Only add to effects array if scene exists
    if (this.scene) {
      this.hitEffects.push({
        position: position.clone(),
        createdAt: Date.now(),
        duration: 300,
      });
    }
  }

  // Create explosion effect for projectiles
  createExplosion(position, color, isExplosive = false, explosionRadius = 1.0) {
    if (!this.scene) return;

    // Get light from pool or create new one
    const explosionLight =
      this.objectPool.getFromPool('explosionLight') ||
      new THREE.PointLight(color, 1.5, isExplosive ? 4.0 : 1.5); // Reduced intensity and distance

    // Configure the light
    explosionLight.color.set(color);
    explosionLight.intensity = 1.5; // Reduced intensity
    explosionLight.distance = isExplosive ? 4.0 : 1.5; // Reduced distance
    explosionLight.position.copy(position);
    explosionLight.visible = true;

    this.scene.add(explosionLight);

    // Track for cleanup in animation loop
    explosionLight.userData.removeTime = Date.now() + 200;
    explosionLight.userData.isActive = true;

    // Track in active lights array
    if (!this.activeExplosionLights) {
      this.activeExplosionLights = [];
    }
    this.activeExplosionLights.push(explosionLight);

    // For explosive projectiles, create a larger explosion
    if (isExplosive) {
      // Track explosion effect in dedicated array
      if (!this.explosionEffects) this.explosionEffects = [];

      // Get explosion mesh from pool or create new one
      let explosion = this.objectPool.getFromPool('explosionMesh');

      if (!explosion) {
        const explosionGeometry = new THREE.SphereGeometry(1.0, 12, 12); // Reduced segments from 16 to 12
        const explosionMaterial = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        });
        explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
      }

      // Configure the explosion
      if (explosion.material) {
        explosion.material.color.set(color);
        explosion.material.opacity = 0.7;
      }
      explosion.scale.set(1, 1, 1);
      explosion.position.copy(position);

      // Set size based on explosion radius
      const baseSize = explosionRadius || 1.0;
      explosion.userData.baseSize = baseSize;
      explosion.visible = true;

      this.scene.add(explosion);

      // Track this explosion for animation
      this.explosionEffects.push({
        mesh: explosion,
        createdAt: Date.now(),
        duration: 500,
      });
    }
  }

  // Create a reusable hit particle system
  createHitParticleSystem() {
    const particleCount = 5; // Reduced from 10
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    // Initialize positions
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 0.3;
      positions[i + 1] = (Math.random() - 0.5) * 0.3;
      positions[i + 2] = (Math.random() - 0.5) * 0.3;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.08, // Reduced from 0.1
      transparent: true,
      opacity: 0.7, // Reduced from 0.8
      blending: THREE.NormalBlending, // Changed from AdditiveBlending
    });

    return new THREE.Points(particles, material);
  }

  // Process hit effects during the animation loop
  processHitEffects() {
    // Return early if no hit effects or scene is not available
    if (!this.scene || !this.hitEffects || this.hitEffects.length === 0) return;

    const currentTime = Date.now();

    // Process active lights
    if (!this.activeHitLights) {
      this.activeHitLights = [];
    }

    for (let i = this.activeHitLights.length - 1; i >= 0; i--) {
      const light = this.activeHitLights[i];

      // Skip invalid lights
      if (!light || !light.userData) {
        this.activeHitLights.splice(i, 1);
        continue;
      }
      // Optimization: Reduce light intensity quickly
      if (light.userData.isActive) {
        light.intensity *= 0.9; // Dim light quickly
      }

      if (light.userData.removeTime && light.userData.isActive) {
        if (currentTime > light.userData.removeTime) {
          // Remove light from scene and return to pool
          if (light.parent) {
            light.parent.remove(light);
          }
          this.objectPool.returnToPool('hitLight', light);
          light.userData.isActive = false;
          this.activeHitLights.splice(i, 1);
        }
      }
    }

    // Process particle effects
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const effect = this.hitEffects[i];
      const elapsed = currentTime - effect.createdAt;

      // If first frame for this effect, create particles
      if (!effect.processed) {
        effect.processed = true;

        // Create particle system for this hit
        const particleSystem =
          this.objectPool.getFromPool('hitParticles') ||
          this.createHitParticleSystem();

        // Position the particle system
        particleSystem.position.copy(effect.position);
        particleSystem.visible = true;

        // Store reference to particle system and start time
        effect.particleSystem = particleSystem;
        if (this.scene) {
          this.scene.add(particleSystem);
        }
      }

      // Update particle system
      if (effect && effect.particleSystem) {
        const progress = Math.min(elapsed / effect.duration, 1.0);

        // Fade out particles
        if (effect.particleSystem.material) {
          effect.particleSystem.material.opacity = 0.7 * (1 - progress);
        }

        // Remove completed effect
        if (progress >= 1.0) {
          if (this.scene && effect.particleSystem) {
            this.scene.remove(effect.particleSystem);
            this.objectPool.returnToPool('hitParticles', effect.particleSystem);

            // Make sure index is valid before splicing
            if (i >= 0 && i < this.hitEffects.length) {
              this.hitEffects.splice(i, 1);
            }
          }
        }
      }
    }
  }

  // Process explosion effects in animation loop
  processExplosionEffects() {
    // Return early if no explosion effects or scene
    if (
      !this.scene ||
      !this.explosionEffects ||
      this.explosionEffects.length === 0
    )
      return;

    const currentTime = Date.now();

    // Process explosion lights
    if (!this.activeExplosionLights) {
      this.activeExplosionLights = [];
    }

    for (let i = this.activeExplosionLights.length - 1; i >= 0; i--) {
      const light = this.activeExplosionLights[i];

      // Skip invalid lights
      if (!light || !light.userData) {
        this.activeExplosionLights.splice(i, 1);
        continue;
      }
      // Optimization: Reduce light intensity quickly
      if (light.userData.isActive) {
        light.intensity *= 0.85; // Dim light quickly
      }

      if (light.userData.removeTime && light.userData.isActive) {
        if (currentTime > light.userData.removeTime) {
          // Remove light from scene and return to pool
          if (light.parent) {
            light.parent.remove(light);
          }
          this.objectPool.returnToPool('explosionLight', light);
          light.userData.isActive = false;
          this.activeExplosionLights.splice(i, 1);
        }
      }
    }

    // Process explosion meshes
    for (let i = this.explosionEffects.length - 1; i >= 0; i--) {
      const effect = this.explosionEffects[i];
      const elapsed = currentTime - effect.createdAt;
      const progress = Math.min(elapsed / effect.duration, 1.0);

      if (effect.mesh) {
        // Expand
        const scale = 1.0 + progress * 1.5; // Reduced expansion from 2.0 to 1.5
        const baseSize = effect.mesh.userData.baseSize || 1.0;
        effect.mesh.scale.set(
          scale * baseSize,
          scale * baseSize,
          scale * baseSize
        );

        // Fade out
        if (effect.mesh && effect.mesh.material) {
          effect.mesh.material.opacity = 0.7 * (1.0 - progress);
        }

        // Remove completed effects
        if (progress >= 1.0) {
          if (this.scene && effect.mesh) {
            this.scene.remove(effect.mesh);
            this.objectPool.returnToPool('explosionMesh', effect.mesh);

            // Make sure index is valid before splicing
            if (
              this.explosionEffects &&
              i >= 0 &&
              i < this.explosionEffects.length
            ) {
              this.explosionEffects.splice(i, 1);
            }
          }
        }
      }
    }
  }

  update() {
    this.processHitEffects();
    this.processExplosionEffects();
  }
}

export default EffectsManager;
