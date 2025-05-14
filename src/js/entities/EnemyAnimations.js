// Enemy animations utility functions
import * as THREE from 'three';

// Generic pulsate function that can be applied to any mesh component
function animatePulsatingComponent(child, currentTime) {
  if (!child || !child.userData || !child.userData.pulsate) return;

  const pulseSpeed = child.userData.pulseSpeed || 3.0;
  const pulseMin = child.userData.pulseMin || 0.8;
  const pulseMax = child.userData.pulseMax || 1.2;
  const pulseAxis = child.userData.pulseAxis || 'all';

  // Calculate pulse factor
  const pulseFactor = Math.sin(currentTime * pulseSpeed * 0.01) * 0.5 + 0.5;
  const scale = pulseMin + pulseFactor * (pulseMax - pulseMin);

  // Apply scale based on the specified axis
  if (pulseAxis === 'all') {
    child.scale.set(scale, scale, scale);
  } else if (pulseAxis === 'x') {
    child.scale.x = scale;
  } else if (pulseAxis === 'y') {
    child.scale.y = scale;
  } else if (pulseAxis === 'z') {
    child.scale.z = scale;
  }

  // Apply to emissive intensity if material exists
  if (child.material && child.material.emissive) {
    child.material.emissiveIntensity =
      pulseMin + pulseFactor * (pulseMax - pulseMin);
  }
}

// Animate rotating components
function animateRotatingComponent(child, delta) {
  if (!child || !child.userData || !child.userData.rotate) return;

  const axis = child.userData.rotationAxis || 'y';
  const speed = child.userData.rotationSpeed || 0.01;

  child.rotation[axis] += speed * delta;
}

// Animate enemy based on type
export function animateEnemy(enemy, delta) {
  if (!enemy || !enemy.mesh) return;

  const currentTime = performance.now() * 0.001; // Time in seconds

  // Apply generic animations to all enemies
  enemy.mesh.traverse((child) => {
    // Handle pulsating components
    animatePulsatingComponent(child, currentTime);

    // Handle rotating components
    animateRotatingComponent(child, delta);
  });

  // Apply enemy type-specific animations
  switch (enemy.type.name) {
    case 'boss':
      animateBoss(enemy, currentTime, delta);
      break;

    case 'bomber':
      animateBomber(enemy, currentTime, delta);
      break;

    case 'destroyer':
      animateDestroyer(enemy, currentTime, delta);
      break;

    case 'fighter':
      animateFighter(enemy, currentTime, delta);
      break;

    case 'scout':
      animateScout(enemy, currentTime, delta);
      break;
  }
}

// Boss-specific animations
function animateBoss(enemy, currentTime, delta) {
  enemy.mesh.traverse((child) => {
    // Animate shield
    if (child.name === 'boss_shield') {
      // Shield wave effect - like rippling energy
      const waveSpeed = 0.3;
      const waveIntensity = 0.05;

      // Create a wave by slightly distorting the shield geometry
      if (
        child.geometry &&
        child.geometry.attributes &&
        child.geometry.attributes.position
      ) {
        const positions = child.geometry.attributes.position;
        const count = positions.count;

        for (let i = 0; i < count; i++) {
          const x = positions.getX(i);
          const y = positions.getY(i);
          const z = positions.getZ(i);

          // Calculate distance from origin for each vertex
          const distance = Math.sqrt(x * x + y * y + z * z);

          // Apply wave distortion
          const wave =
            Math.sin(distance * 5 + currentTime * waveSpeed) * waveIntensity;
          const normalizationFactor = (distance + wave) / distance;

          // Update vertex position
          positions.setXYZ(
            i,
            x * normalizationFactor,
            y * normalizationFactor,
            z * normalizationFactor
          );
        }

        positions.needsUpdate = true;
      }
    }

    // Animate weapon pods
    if (child.name && child.name.includes('boss_weapon_pod_')) {
      // Make weapon pods slightly adjust their aim toward player
      const podIndex = parseInt(child.name.split('_').pop());
      const wobbleAmount = 0.05;
      const wobbleSpeed = 0.5 + podIndex * 0.2;

      const wobbleX = Math.sin(currentTime * wobbleSpeed) * wobbleAmount;
      const wobbleY = Math.cos(currentTime * wobbleSpeed * 1.3) * wobbleAmount;

      child.rotation.x += (wobbleX - child.rotation.x) * 0.05;
      child.rotation.y += (wobbleY - child.rotation.y) * 0.05;
    }

    // Animate energy arcs
    if (child.name && child.name.includes('boss_energy_arc_')) {
      // Create electrical arc effect
      const pulseFactor = Math.sin(currentTime * 15) * 0.5 + 0.5;

      if (child.material) {
        child.material.opacity = 0.3 + pulseFactor * 0.7;
      }
    }
  });
}

// Bomber-specific animations
function animateBomber(enemy, currentTime, delta) {
  // Bombers should wobble slightly as they move
  const wobbleAmount = 0.05;
  const wobbleFrequency = 1.5;

  const pitchWobble = Math.sin(currentTime * wobbleFrequency) * wobbleAmount;
  const rollWobble =
    Math.cos(currentTime * wobbleFrequency * 0.7) * wobbleAmount;

  enemy.mesh.rotation.x += (pitchWobble - enemy.mesh.rotation.x) * 0.1;
  enemy.mesh.rotation.z += (rollWobble - enemy.mesh.rotation.z) * 0.1;

  enemy.mesh.traverse((child) => {
    // Animate engine glow
    if (child.name && child.name.includes('bomber_engine_glow_')) {
      const pulseFactor =
        Math.sin(
          currentTime * 5 +
            (parseFloat(child.name.split('_').pop()) * Math.PI) / 2
        ) *
          0.5 +
        0.5;

      if (child.material) {
        child.material.opacity = 0.4 + pulseFactor * 0.6;
        child.material.emissiveIntensity = 0.7 + pulseFactor * 0.3;
      }
    }

    // Animate bomb tubes
    if (child.name && child.name.includes('bomber_tube_')) {
      // Create a slight retraction/extension motion for the tubes
      const tubeIndex = parseInt(child.name.split('_').pop());
      const cycleFrequency = 3 + tubeIndex * 0.5;
      const cyclePhase = tubeIndex * (Math.PI / 4);

      const extensionFactor =
        Math.sin(currentTime * cycleFrequency + cyclePhase) * 0.5 + 0.5;
      const basePosition = -enemy.type.size * 0.3;
      const extensionRange = enemy.type.size * 0.15;

      child.position.y = basePosition - extensionFactor * extensionRange;
    }
  });
}

// Destroyer-specific animations
function animateDestroyer(enemy, currentTime, delta) {
  // Destroyers have a more stable flight pattern with minimal rotation
  enemy.mesh.traverse((child) => {
    // Animate radar dish
    if (child.name === 'destroyer_radar_dish') {
      child.rotation.y += 0.02 * delta;
    }

    // Animate warning lights
    if (child.name && child.name.includes('destroyer_warning_light_')) {
      const lightIndex = parseInt(child.name.split('_').pop());

      // Calculate blink pattern
      const blinkFrequency = 1.0 + lightIndex * 0.3;
      const blinkPhase = lightIndex * (Math.PI / 3);
      const blinkState =
        Math.sin(currentTime * blinkFrequency + blinkPhase) > 0 ? 1.0 : 0.2;

      // Apply blink state
      if (child.material) {
        child.material.emissiveIntensity = blinkState;
      }
    }

    // Animate turrets to track player slightly
    if (
      child.name &&
      (child.name.includes('turret') || child.name.includes('cannon'))
    ) {
      // Make turrets slightly adjust their aim
      const wobbleSpeed = 0.8;
      const wobbleAmount = 0.03;

      const wobbleX = Math.sin(currentTime * wobbleSpeed) * wobbleAmount;
      const wobbleY = Math.cos(currentTime * wobbleSpeed * 1.2) * wobbleAmount;

      child.rotation.x += (wobbleX - child.rotation.x) * 0.05;
      child.rotation.y += (wobbleY - child.rotation.y) * 0.05;
    }
  });
}

// Fighter-specific animations
function animateFighter(enemy, currentTime, delta) {
  // Fighters are agile and make quick adjustments
  const agileRoll = Math.sin(currentTime * 3) * 0.2;
  enemy.mesh.rotation.z += (agileRoll - enemy.mesh.rotation.z) * 0.1;

  enemy.mesh.traverse((child) => {
    // Animate engine exhausts
    if (child.name && child.name.includes('engine')) {
      const fluctuation = Math.sin(currentTime * 10) * 0.5 + 0.5;

      if (child.material && child.material.emissive) {
        child.material.emissiveIntensity = 0.7 + fluctuation * 0.3;
      }
    }
  });
}

// Scout-specific animations
function animateScout(enemy, currentTime, delta) {
  // Scouts make erratic movements
  const jitterAmount = 0.01;

  enemy.mesh.rotation.x += (Math.random() - 0.5) * jitterAmount;
  enemy.mesh.rotation.y += (Math.random() - 0.5) * jitterAmount;
  enemy.mesh.rotation.z += (Math.random() - 0.5) * jitterAmount;
}

// Get firing range based on enemy type
export function getEnemyFiringRange(enemyType) {
  switch (enemyType) {
    case 'bomber':
      return 25; // Bombers have longer range
    case 'destroyer':
      return 30; // Destroyers have even longer range
    case 'boss':
      return 40; // Boss has the longest range
    case 'fighter':
      return 22; // Fighters have decent range
    case 'scout':
      return 15; // Scouts have shortest range
    default:
      return 20; // Default range
  }
}
