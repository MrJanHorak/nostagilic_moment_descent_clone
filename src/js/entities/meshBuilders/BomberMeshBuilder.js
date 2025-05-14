import * as THREE from 'three';
import MeshBuilder from './MeshBuilder.js';

class BomberMeshBuilder extends MeshBuilder {
  buildMesh(body, enemyType) {
    // ===== MAIN BODY =====
    // Create an oval-shaped main body
    const bodyGeometry = new THREE.SphereGeometry(
      enemyType.size * 1.2,
      16,
      12
    ).scale(1, 0.5, 0.8); // Flattened oval shape for bomber

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: enemyType.color,
      roughness: 0.4,
      metalness: 0.6,
      emissive: enemyType.color,
      emissiveIntensity: 0.3,
    });

    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.name = 'bomber_body';
    bodyMesh.rotation.z = Math.PI / 2; // Rotate to align with flight direction
    body.add(bodyMesh);

    // ===== ARMOR PLATING =====
    // Add distinctive armor plating on top of the bomber
    const armorGeometry = new THREE.BoxGeometry(
      enemyType.size * 1.8,
      enemyType.size * 0.2,
      enemyType.size * 0.8
    );

    const armorMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.2,
      metalness: 0.9,
    });

    const topArmor = new THREE.Mesh(armorGeometry, armorMaterial);
    topArmor.position.set(0, enemyType.size * 0.3, 0);
    body.add(topArmor);

    // ===== SIDE PODS =====
    // Heavier elements on each side that house the bomb launchers
    const podGeometry = new THREE.SphereGeometry(
      enemyType.size * 0.5,
      8,
      6,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );

    const podMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x222222,
      emissiveIntensity: 0.2,
    });

    // Left pod
    const leftPod = new THREE.Mesh(podGeometry, podMaterial);
    leftPod.name = 'bomber_left_pod';
    leftPod.position.set(-enemyType.size * 0.8, 0, 0);
    leftPod.rotation.x = -Math.PI / 2; // Orient dome downward
    body.add(leftPod);

    // Right pod
    const rightPod = new THREE.Mesh(podGeometry.clone(), podMaterial);
    rightPod.name = 'bomber_right_pod';
    rightPod.position.set(enemyType.size * 0.8, 0, 0);
    rightPod.rotation.x = -Math.PI / 2; // Orient dome downward
    body.add(rightPod);

    // ===== BOMB LAUNCHER TUBES =====
    // Create multiple launcher tubes under each pod
    const tubeGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.15,
      enemyType.size * 0.15,
      enemyType.size * 0.4,
      6
    );

    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.5,
      metalness: 0.6,
    });

    // Add tubes to left pod
    for (let i = 0; i < 2; i++) {
      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      tube.name = `bomber_tube_left_${i}`;
      tube.position.set(
        i === 0 ? -enemyType.size * 0.2 : enemyType.size * 0.2,
        -enemyType.size * 0.3,
        0
      );
      leftPod.add(tube);
    }

    // Add tubes to right pod
    for (let i = 0; i < 2; i++) {
      const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
      tube.name = `bomber_tube_right_${i}`;
      tube.position.set(
        i === 0 ? -enemyType.size * 0.2 : enemyType.size * 0.2,
        -enemyType.size * 0.3,
        0
      );
      rightPod.add(tube);
    }

    // ===== WARNING LIGHTS =====
    // Add warning lights that flash when bombs are about to be dropped
    const bomberWarningLightGeometry = new THREE.SphereGeometry(
      enemyType.size * 0.1,
      8,
      8
    );
    const bomberWarningLightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });

    const bomberWarningLightPositions = [
      { x: -enemyType.size * 0.8, y: -enemyType.size * 0.1, z: 0 },
      { x: enemyType.size * 0.8, y: -enemyType.size * 0.1, z: 0 },
    ];

    bomberWarningLightPositions.forEach((pos, index) => {
      const light = new THREE.Mesh(
        bomberWarningLightGeometry,
        bomberWarningLightMaterial.clone()
      );
      light.name = `bomber_warning_light_${index}`;
      light.position.set(pos.x, pos.y, pos.z);
      light.userData.pulsate = true;
      light.userData.pulseMin = 0.5;
      light.userData.pulseMax = 1.0;
      light.userData.pulseSpeed = 2 + Math.random();
      body.add(light);
    });

    // ===== ENGINES =====
    // Add engines at the back for propulsion
    const engineGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.15,
      enemyType.size * 0.25,
      enemyType.size * 0.4,
      8
    );

    const engineMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.2,
      metalness: 0.8,
    });

    // Engine positions
    const enginePositions = [
      {
        x: -enemyType.size * 0.4,
        y: enemyType.size * 0.1,
        z: -enemyType.size * 0.8,
      },
      {
        x: enemyType.size * 0.4,
        y: enemyType.size * 0.1,
        z: -enemyType.size * 0.8,
      },
    ];

    enginePositions.forEach((pos, index) => {
      const engine = new THREE.Mesh(engineGeometry, engineMaterial);
      engine.name = `bomber_engine_${index}`;
      engine.position.set(pos.x, pos.y, pos.z);
      engine.rotation.x = Math.PI / 2; // Orient exhaust backward
      body.add(engine);

      // Add engine glow
      const glowGeometry = new THREE.CylinderGeometry(
        enemyType.size * 0.12,
        enemyType.size * 0.05,
        enemyType.size * 0.3,
        8
      );

      const glowMaterial = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        emissive: 0x00aaff,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.7,
      });

      const engineGlow = new THREE.Mesh(glowGeometry, glowMaterial);
      engineGlow.name = `bomber_engine_glow_${index}`;
      engineGlow.position.set(0, 0, enemyType.size * 0.3);
      engineGlow.userData.pulsate = true;
      engineGlow.userData.pulseMin = 0.8;
      engineGlow.userData.pulseMax = 1.1;
      engineGlow.userData.pulseSpeed = 4 + Math.random();
      engine.add(engineGlow);
    });
  }
}

export default BomberMeshBuilder;
