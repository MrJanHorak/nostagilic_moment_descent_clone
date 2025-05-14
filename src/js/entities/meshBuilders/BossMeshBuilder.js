import * as THREE from 'three';
import MeshBuilder from './MeshBuilder.js';

class BossMeshBuilder extends MeshBuilder {
  buildMesh(body, enemyType) {
    // ===== CORE STRUCTURE =====
    // Create a massive, imposing core structure
    const coreGeometry = new THREE.SphereGeometry(enemyType.size * 0.8, 20, 20);

    const coreMaterial = new THREE.MeshStandardMaterial({
      color: 0x0022cc,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x000066,
      emissiveIntensity: 0.3,
    });

    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.name = 'boss_core';
    body.add(core);

    // ===== OUTER ARMOR RING =====
    // Create a rotating outer ring that protects the core
    const outerRingGeometry = new THREE.TorusGeometry(
      enemyType.size * 1.2,
      enemyType.size * 0.15,
      16,
      40
    );

    const armorMaterial = new THREE.MeshStandardMaterial({
      color: 0x222266,
      roughness: 0.2,
      metalness: 0.9,
      emissive: 0x0000ff,
      emissiveIntensity: 0.2,
    });

    const outerRing = new THREE.Mesh(outerRingGeometry, armorMaterial);
    outerRing.name = 'boss_outer_ring';
    outerRing.userData.rotate = true;
    outerRing.userData.rotationAxis = 'y';
    outerRing.userData.rotationSpeed = 0.005;
    body.add(outerRing);

    // Add a second ring on a different axis
    const secondRingGeometry = new THREE.TorusGeometry(
      enemyType.size * 1.0,
      enemyType.size * 0.12,
      12,
      36
    );

    const secondRing = new THREE.Mesh(secondRingGeometry, armorMaterial);
    secondRing.name = 'boss_second_ring';
    secondRing.rotation.x = Math.PI / 2;
    secondRing.userData.rotate = true;
    secondRing.userData.rotationAxis = 'z';
    secondRing.userData.rotationSpeed = 0.008;
    body.add(secondRing);

    // ===== WEAPON PODS =====
    // Create four weapon pods positioned around the core
    const podGeometry = new THREE.ConeGeometry(
      enemyType.size * 0.3,
      enemyType.size * 0.6,
      8
    );

    const podMaterial = new THREE.MeshStandardMaterial({
      color: 0x000088,
      roughness: 0.3,
      metalness: 0.7,
    });

    const podPositions = [
      { x: enemyType.size * 1.2, y: 0, z: 0, rotY: -Math.PI / 2 },
      { x: -enemyType.size * 1.2, y: 0, z: 0, rotY: Math.PI / 2 },
      { x: 0, y: enemyType.size * 1.2, z: 0, rotY: 0, rotX: Math.PI / 2 },
      { x: 0, y: -enemyType.size * 1.2, z: 0, rotY: 0, rotX: -Math.PI / 2 },
    ];

    podPositions.forEach((pos, index) => {
      const pod = new THREE.Mesh(podGeometry, podMaterial);
      pod.name = `boss_weapon_pod_${index}`;
      pod.position.set(pos.x, pos.y, pos.z);
      pod.rotation.y = pos.rotY || 0;
      if (pos.rotX) pod.rotation.x = pos.rotX;
      body.add(pod);

      // Add weapon barrel
      const barrelGeometry = new THREE.CylinderGeometry(
        enemyType.size * 0.12,
        enemyType.size * 0.08,
        enemyType.size * 0.4,
        8
      );

      const barrelMaterial = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.2,
        metalness: 1.0,
        emissive: 0x0000ff,
        emissiveIntensity: 0.5,
      });

      const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
      barrel.name = `boss_weapon_barrel_${index}`;
      barrel.position.set(0, 0, enemyType.size * 0.5);
      pod.add(barrel);

      // Add muzzle point for projectile spawning
      const muzzle = new THREE.Object3D();
      muzzle.name = `boss_weapon_muzzle_${index}`;
      muzzle.position.set(0, 0, enemyType.size * 0.7);
      barrel.add(muzzle);

      // Add charging effect around barrel
      const chargeGeometry = new THREE.TorusGeometry(
        enemyType.size * 0.15,
        enemyType.size * 0.03,
        8,
        16
      );

      const chargeMaterial = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        emissive: 0x00aaff,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.8,
      });

      const chargeRing = new THREE.Mesh(chargeGeometry, chargeMaterial);
      chargeRing.name = `boss_weapon_charge_${index}`;
      chargeRing.position.set(0, 0, enemyType.size * 0.3);
      chargeRing.rotation.x = Math.PI / 2;
      chargeRing.userData.pulsate = true;
      chargeRing.userData.pulseMin = 0.8;
      chargeRing.userData.pulseMax = 1.4;
      chargeRing.userData.pulseSpeed = 3 + Math.random();
      barrel.add(chargeRing);
    });

    // ===== SHIELD GENERATOR =====
    // Add a protective energy shield that activates periodically
    const bossShieldGeometry = new THREE.SphereGeometry(
      enemyType.size * 1.5,
      20,
      20
    );

    const bossEnergyShieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      emissive: 0x00aaff,
      emissiveIntensity: 0.5,
    });

    const bossEnergyShield = new THREE.Mesh(
      bossShieldGeometry,
      bossEnergyShieldMaterial
    );
    bossEnergyShield.name = 'boss_shield';
    bossEnergyShield.userData.pulsate = true;
    bossEnergyShield.userData.pulseMin = 0.95;
    bossEnergyShield.userData.pulseMax = 1.05;
    body.add(bossEnergyShield);

    // ===== GRAVITY GENERATORS =====
    // Add gravity generators underneath the boss
    const bossGravityGenCount = 3;
    const bossGravityGenGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.2,
      enemyType.size * 0.2,
      enemyType.size * 0.5,
      6
    );

    const bossGravityGenMaterial = new THREE.MeshStandardMaterial({
      color: 0x2200aa,
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x2200aa,
      emissiveIntensity: 0.4,
    });

    for (let i = 0; i < bossGravityGenCount; i++) {
      const angle = (i / bossGravityGenCount) * Math.PI * 2;
      const gravityGen = new THREE.Mesh(
        bossGravityGenGeometry,
        bossGravityGenMaterial
      );
      gravityGen.name = `boss_gravity_gen_${i}`;
      gravityGen.position.set(
        Math.cos(angle) * enemyType.size * 0.6,
        enemyType.size * -0.6,
        Math.sin(angle) * enemyType.size * 0.6
      );
      gravityGen.rotation.x = Math.PI / 2;
      body.add(gravityGen);

      // Add energy beam emitting downward
      const beamGeometry = new THREE.CylinderGeometry(
        enemyType.size * 0.05,
        enemyType.size * 0.2,
        enemyType.size * 1.0,
        8
      );

      const beamMaterial = new THREE.MeshStandardMaterial({
        color: 0x8800ff,
        emissive: 0x8800ff,
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.6,
      });

      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.name = `boss_gravity_beam_${i}`;
      beam.position.set(0, -enemyType.size * 0.5, 0);
      beam.userData.pulsate = true;
      beam.userData.pulseAxis = 'y';
      beam.userData.pulseMin = 0.8;
      beam.userData.pulseMax = 1.2;
      beam.userData.pulseSpeed = 2 + Math.random();
      gravityGen.add(beam);
    }

    // ===== CENTRAL CONTROL NODE =====
    // Add a glowing central core that serves as a weak point
    const nodeGeometry = new THREE.OctahedronGeometry(enemyType.size * 0.3, 1);

    const nodeMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaaaff,
      roughness: 0.1,
      metalness: 0.9,
      emissive: 0xaaaaff,
      emissiveIntensity: 0.8,
    });

    const controlNode = new THREE.Mesh(nodeGeometry, nodeMaterial);
    controlNode.name = 'boss_control_node';
    controlNode.userData.rotate = true;
    controlNode.userData.rotationSpeed = 0.02;
    core.add(controlNode);

    // Add energy arcs connecting to the node
    const arcPositions = [
      { x: enemyType.size * 0.4, y: 0, z: 0 },
      { x: -enemyType.size * 0.4, y: 0, z: 0 },
      { x: 0, y: enemyType.size * 0.4, z: 0 },
      { x: 0, y: -enemyType.size * 0.4, z: 0 },
    ];

    arcPositions.forEach((pos, index) => {
      const arcGeometry = new THREE.BoxGeometry(
        pos.x !== 0 ? enemyType.size * 0.4 : enemyType.size * 0.05,
        pos.y !== 0 ? enemyType.size * 0.4 : enemyType.size * 0.05,
        enemyType.size * 0.05
      );

      const arcMaterial = new THREE.MeshStandardMaterial({
        color: 0x8888ff,
        emissive: 0x8888ff,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity: 0.7,
      });

      const arc = new THREE.Mesh(arcGeometry, arcMaterial);
      arc.name = `boss_energy_arc_${index}`;
      arc.position.set(pos.x / 2, pos.y / 2, pos.z);
      arc.userData.pulsate = true;
      arc.userData.pulseMin = 0.2;
      arc.userData.pulseMax = 1.0;
      arc.userData.pulseSpeed = 10 + Math.random() * 5;
      core.add(arc);
    });
  }
}

export default BossMeshBuilder;
