// Effects utilities
import * as THREE from 'three';

// Create an explosion visual effect at the given position
export function createExplosionEffect(scene, position) {
  const particleCount = 30;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    // Random position within small radius of explosion center
    positions[i] = position.x + (Math.random() - 0.5) * 0.5;
    positions[i + 1] = position.y + (Math.random() - 0.5) * 0.5;
    positions[i + 2] = position.z + (Math.random() - 0.5) * 0.5;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Bright orange-yellow color for explosion
  const material = new THREE.PointsMaterial({
    color: 0xff9500,
    size: 0.2,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });

  const explosion = new THREE.Points(geometry, material);
  scene.add(explosion);

  // Animation for explosion - expand and fade
  const expandSpeed = 1.5 + Math.random() * 1.0;
  const duration = 0.8;
  let elapsed = 0;

  // Create an animation function
  function animateExplosion(delta) {
    elapsed += delta;
    const progress = elapsed / duration;

    // Expand particles
    for (let i = 0; i < positions.length; i += 3) {
      const direction = new THREE.Vector3(
        positions[i] - position.x,
        positions[i + 1] - position.y,
        positions[i + 2] - position.z
      ).normalize();

      positions[i] += direction.x * expandSpeed * delta;
      positions[i + 1] += direction.y * expandSpeed * delta;
      positions[i + 2] += direction.z * expandSpeed * delta;
    }

    explosion.geometry.attributes.position.needsUpdate = true;

    // Fade out
    explosion.material.opacity = 0.8 * (1 - progress);
    explosion.material.size = 0.2 * (1 + progress);

    // Cleanup when animation completes
    if (progress >= 1) {
      scene.remove(explosion);
      explosion.geometry.dispose();
      explosion.material.dispose();
      return true; // Animation complete
    }

    return false; // Animation continuing
  }

  return animateExplosion;
}

// Create cave dust particle system
export function createCaveParticles(scene) {
  const particleCount = 1000;
  const particles = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  // Range for particles
  const spread = 30;
  const centerOffset = 10; // How far to distribute ahead of player

  // Fill arrays with random positions and colors
  for (let i = 0; i < particleCount * 3; i += 3) {
    // Position particles in a cylindrical distribution ahead of player
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 5;

    positions[i] = Math.cos(angle) * radius; // x
    positions[i + 1] = Math.sin(angle) * radius; // y
    positions[i + 2] = -Math.random() * spread - centerOffset; // z (ahead of player)

    // Slight blue/white color variation
    const brightness = 0.2 + Math.random() * 0.3;
    colors[i] = brightness * 0.5; // R
    colors[i + 1] = brightness * 0.7; // G
    colors[i + 2] = brightness; // B (brightest)
  }

  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Material that will catch the lights
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.05,
    transparent: true,
    opacity: 0.6,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const particleSystem = new THREE.Points(particles, particleMaterial);
  scene.add(particleSystem);

  return particleSystem;
}

// Update dust particle positions relative to player
export function updateCaveParticles(particleSystem, delta) {
  const positions = particleSystem.geometry.attributes.position.array;
  const particleCount = positions.length / 3;
  const spread = 30;
  const centerOffset = 10;

  for (let i = 0; i < particleCount * 3; i += 3) {
    // Move particles slowly toward player
    positions[i + 2] += (0.5 + Math.random() * 0.5) * delta;

    // If particle is behind player, reset it ahead
    if (positions[i + 2] > 5) {
      positions[i + 2] = -Math.random() * spread - centerOffset;

      // Also randomize X and Y when resetting
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 5;
      positions[i] = Math.cos(angle) * radius;
      positions[i + 1] = Math.sin(angle) * radius;
    }
  }

  particleSystem.geometry.attributes.position.needsUpdate = true;
}

// Camera shake effect for damage feedback
export function shakeCamera(camera, intensity = 0.5) {
  const originalPosition = camera.position.clone();
  const shakeDuration = 0.5; // seconds
  let elapsed = 0;

  function shakeAnimation(delta) {
    elapsed += delta;
    const progress = elapsed / shakeDuration;

    if (progress >= 1) {
      // Restore original position
      camera.position.copy(originalPosition);
      return true; // Animation complete
    }

    // Decrease intensity over time
    const currentIntensity = intensity * (1 - progress);

    // Apply random offset
    const offsetX = (Math.random() - 0.5) * currentIntensity;
    const offsetY = (Math.random() - 0.5) * currentIntensity;
    const offsetZ = (Math.random() - 0.5) * currentIntensity * 0.5; // Less Z shake

    camera.position.set(
      originalPosition.x + offsetX,
      originalPosition.y + offsetY,
      originalPosition.z + offsetZ
    );

    return false; // Animation not yet complete
  }

  return shakeAnimation;
}
