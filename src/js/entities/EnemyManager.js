// Enemy entity module
import * as THREE from 'three';
import { createExplosionEffect } from '../utils/effectsUtils.js';
import { checkProjectileEnemyCollision } from '../utils/collisionUtils.js';
import { animateEnemy, getEnemyFiringRange } from './EnemyAnimations.js';

// Enemy type definitions
export const enemyTypes = [
  {
    name: 'scout',
    color: 0xff0000,
    size: 0.4,
    health: 10,
    speed: 0.05,
    damage: 5,
    pointValue: 50,
  },
  {
    name: 'fighter',
    color: 0xff6600,
    size: 0.6,
    health: 25,
    speed: 0.03,
    damage: 10,
    pointValue: 100,
  },
  {
    name: 'bomber',
    color: 0xffcc00,
    size: 0.8,
    health: 50,
    speed: 0.02,
    damage: 20,
    pointValue: 200,
  },
  {
    name: 'destroyer',
    color: 0x00ff00,
    size: 1.0,
    health: 100,
    speed: 0.01,
    damage: 30,
    pointValue: 500,
  },
  {
    name: 'boss',
    color: 0x0000ff,
    size: 1.5,
    health: 200,
    speed: 0.005,
    damage: 50,
    pointValue: 1000,
  },
];

class EnemyManager {
  constructor(scene, camera, gameState, audioManager, levelManager = null) {
    this.scene = scene;
    this.camera = camera;
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.levelManager = levelManager;
    this.enemies = [];
    this.levelSegments = [];
    this.enemyProjectiles = [];

    // Track permanently destroyed predefined enemies
    this.destroyedPredefinedEnemies = new Set();

    // Track total enemies for win condition
    this.totalPredefinedEnemies = 0;

    // For endless mode
    this.lastRandomSpawnTime = 0;
    this.randomSpawnInterval = 5000; // 5 seconds between spawns in endless mode

    // Create object pools for performance optimization
    this.objectPools = {
      hitLight: [],
      hitParticles: [],
      explosionLight: [],
      explosionMesh: [],
    }; // Track effects for processing in animation loop
    this.hitEffects = [];
    this.explosionEffects = [];
    this.activeHitLights = [];
    this.activeExplosionLights = [];
  }
  // Get an item from the object pool or return null if none available
  getFromPool(poolName) {
    // Defensive checks for missing pools
    if (
      !this.objectPools ||
      !poolName ||
      !this.objectPools[poolName] ||
      this.objectPools[poolName].length === 0
    ) {
      return null;
    }

    const object = this.objectPools[poolName].pop();
    return object;
  }
  // Return an object to the pool
  returnToPool(poolName, object) {
    // Defensive check for null objects or missing pools
    if (!object || !this.objectPools) return;

    if (!this.objectPools[poolName]) {
      this.objectPools[poolName] = [];
    }

    // Reset the object to an inactive state with defensive check
    if (object) {
      object.visible = false;
    }

    // Add to the pool
    this.objectPools[poolName].push(object);
  }

  setLevelSegments(segments) {
    this.levelSegments = segments;
  }

  // Create enemy mesh
  createEnemyMesh(enemyType) {
    const body = new THREE.Group();
    body.name = `${enemyType.name}_enemy`;

    // Add debug property to track object creation
    body.userData.creationInfo = {
      createdAt: new Date().toISOString(),
      creator: 'createEnemyMesh',
      enemyType: enemyType.name,
    };

    // Use different geometry based on enemy type
    if (enemyType.name === 'scout') {
      this.createScoutMesh(body, enemyType);
    } else if (enemyType.name === 'fighter') {
      this.createFighterMesh(body, enemyType);
    } else if (enemyType.name === 'bomber') {
      this.createBomberMesh(body, enemyType);
    } else if (enemyType.name === 'destroyer') {
      this.createDestroyerMesh(body, enemyType);
    } else if (enemyType.name === 'boss') {
      this.createBossMesh(body, enemyType);
    }

    return body;
  }

  createScoutMesh(body, enemyType) {
    // ========== SCOUT SHIP MESH ==========
    // The Scout is a fast, small enemy ship with a sharp triangular design.
    // This function constructs and adds the 3D mesh components to the given 'body' Object3D.
    // It consists of a triangular main body, thin wings, and glowing front-facing eyes.

    // ==========================
    //        MAIN BODY
    // ==========================

    // Create a triangular prism using a cylinder with 3 radial segments (triangular cross-section)
    const bodyGeometry = new THREE.CylinderGeometry(
      enemyType.size, // Top radius (will face FORWARD toward the player due to rotation)
      0, // Bottom radius (sharp point at the back)
      enemyType.size * 1.5, // Height/length of the scout's body
      3 // Segments to form a triangular cross-section
    );

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: enemyType.color, // Primary color from the enemy type
      roughness: 0.6, // Moderate matte surface
      metalness: 0.2, // Slight metallic sheen
      emissive: enemyType.color, // Emits same color as body
      emissiveIntensity: 0.2, // Low subtle glow effect
    });

    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.name = 'scout_body';

    // Rotate the prism so the flat face points toward the player and the sharp point trails behind
    bodyMesh.rotation.x = -Math.PI / 2; // -90° around X axis
    body.add(bodyMesh);

    // ==========================
    //         WINGS
    // ==========================

    // Small box-shaped wings, wide but very thin
    const wingGeometry = new THREE.BoxGeometry(
      enemyType.size * 2.5, // Width (extends far out from center)
      enemyType.size * 0.1, // Height (very thin)
      enemyType.size * 0.5 // Depth (front-to-back)
    );

    const wingMesh = new THREE.Mesh(wingGeometry, bodyMaterial);
    wingMesh.name = 'scout_wings';

    // Position the wings near the middle-bottom of the body
    wingMesh.position.set(
      0, // Centered on X
      0, // Centered on Y
      -0.1 // Slightly offset backwards (Z-axis)
    );
    body.add(wingMesh);

    // ==========================
    //       GLOWING EYES
    // ==========================

    // Bright glowing eyes help the player visually track the scout
    const eyeMaterial = new THREE.MeshStandardMaterial({
      // CHANGED FROM MeshBasicMaterial
      color: 0xffff00, // Bright yellow
      emissive: 0xffff00, // Same yellow glow
      emissiveIntensity: 1.0, // Full intensity for high visibility
    });

    const eyeGeometry = new THREE.SphereGeometry(
      enemyType.size * 0.15, // Radius (15% of scout's size)
      8, // Width segments (low poly is fine)
      8 // Height segments
    );

    // ---- LEFT EYE ----
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.name = 'scout_eye_left';

    // Positioning relative to the flat (front) side of the ship
    leftEye.position.set(
      -enemyType.size * 0.18, // Left of center
      enemyType.size * 0.2, // Slightly raised
      enemyType.size * 0.1 // Forward on the Z-axis (points to player)
    );
    body.add(leftEye);

    // Add a glowing yellow point light inside the eye
    const leftEyeLight = new THREE.PointLight(
      0xffff00, // Yellow
      2.0, // Brightness
      enemyType.size * 2.0 // Range of influence
    );
    leftEyeLight.position.copy(leftEye.position);
    body.add(leftEyeLight);

    // ---- RIGHT EYE ----
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.name = 'scout_eye_right';

    rightEye.position.set(
      enemyType.size * 0.18, // Right of center
      enemyType.size * 0.2, // Slightly raised
      enemyType.size * 0.1 // Forward on Z-axis
    );
    body.add(rightEye);

    const rightEyeLight = new THREE.PointLight(
      0xffff00, // Yellow
      2.0, // Brightness
      enemyType.size * 2.0 // Range
    );
    rightEyeLight.position.copy(rightEye.position);
    body.add(rightEyeLight);
  }

  createFighterMesh(body, enemyType) {
    // ===== MAIN BODY =====
    const bodyGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.9,
      enemyType.size * 0.5,
      enemyType.size * 2,
      6
    );

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: enemyType.color,
      roughness: 0.2,
      metalness: 0.8,
      emissive: enemyType.color,
      emissiveIntensity: 0.4,
    });

    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.name = 'fighter_body';
    bodyMesh.rotation.x = -Math.PI / 2;
    body.add(bodyMesh);

    // ===== FRONT WEAPON =====
    const weaponGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.1,
      enemyType.size * 0.15,
      enemyType.size * 0.9,
      12
    );

    const weaponMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.1,
      metalness: 1.0,
      emissive: 0xff0000,
      emissiveIntensity: 0.8,
    });

    const weaponMesh = new THREE.Mesh(weaponGeometry, weaponMaterial);
    weaponMesh.name = 'fighter_weapon';
    weaponMesh.rotation.x = Math.PI / 2;
    weaponMesh.position.set(0, 0, enemyType.size * 1.2);
    body.add(weaponMesh);

    // ===== ENGINE GLOW =====
    const engineGeometry = new THREE.SphereGeometry(
      enemyType.size * 0.3,
      16,
      16
    );

    // MeshBasicMaterial doesn't need or support emissive
    const engineMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      transparent: true,
      opacity: 0.9,
    });

    const engineMesh = new THREE.Mesh(engineGeometry, engineMaterial);
    engineMesh.name = 'fighter_engine';
    engineMesh.position.set(0, 0, -enemyType.size);
    body.add(engineMesh);

    const engineLight = new THREE.PointLight(0xff5500, 1.5, enemyType.size * 4);
    engineLight.position.copy(engineMesh.position);
    body.add(engineLight);

    // ENGINE TRAILS section
    for (let i = -1; i <= 1; i += 2) {
      const trailGeometry = new THREE.CylinderGeometry(
        0.05,
        0.1,
        enemyType.size * 1.2,
        8
      );

      const trailMaterial = new THREE.MeshStandardMaterial({
        color: 0xff5500,
        transparent: true,
        opacity: 0.3,
      });

      const trailMesh = new THREE.Mesh(trailGeometry, trailMaterial);
      trailMesh.position.set(
        i * enemyType.size * 0.3,
        0,
        -enemyType.size * 1.6
      );
      trailMesh.rotation.x = Math.PI / 2;
      body.add(trailMesh);
    }

    // ===== LAYERED WINGS =====
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.3,
      metalness: 0.6,
      emissive: 0x111111,
      emissiveIntensity: 0.3,
    });

    const wingGeometry = new THREE.BoxGeometry(
      enemyType.size * 2.2,
      enemyType.size * 0.15,
      enemyType.size * 0.6
    );

    // Make sure wings are properly created
    for (let i = 0; i < 2; i++) {
      const wingMesh = new THREE.Mesh(wingGeometry, wingMaterial);
      wingMesh.name = `fighter_wing_${i}`;
      wingMesh.position.set(
        0,
        i * enemyType.size * 0.12 - enemyType.size * 0.06,
        0
      );
      body.add(wingMesh);
    }

    // ===== ANTENNAS WITH LIGHT TIPS =====
    const antennaHeight = enemyType.size * 0.6;
    const antennaGeometry = new THREE.CylinderGeometry(
      0.02,
      0.02,
      antennaHeight,
      8
    );

    const antennaMaterial = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      emissive: 0x333333,
      emissiveIntensity: 0.5,
    });

    const antennaOffset = enemyType.size * 0.4;

    // Ensure antenna loop is complete
    for (let side of [-1, 1]) {
      const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
      antenna.name = `fighter_antenna_${side > 0 ? 'right' : 'left'}`;
      antenna.position.set(
        side * antennaOffset,
        enemyType.size * 0.5,
        enemyType.size * 0.3
      );
      antenna.rotation.z = (side * Math.PI) / 20;
      body.add(antenna);

      const tipLight = new THREE.PointLight(
        0xff0000,
        0.6,
        enemyType.size * 1.5
      );
      tipLight.name = `fighter_antenna_light_${side > 0 ? 'right' : 'left'}`;
      tipLight.position.set(
        antenna.position.x,
        antenna.position.y + antennaHeight / 2,
        antenna.position.z
      );
      body.add(tipLight);
    }
  }

  createBomberMesh(body, enemyType) {
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

  createDestroyerMesh(body, enemyType) {
    // ===== BASE HULL =====
    // Create a more imposing ship with angular features
    const hullGeometry = new THREE.BoxGeometry(
      enemyType.size * 1.8,
      enemyType.size * 0.6,
      enemyType.size * 2.5
    );
    hullGeometry.translate(0, 0, enemyType.size * 0.2); // Shift center of mass forward

    // Create beveled edges for the hull
    const hullEdges = new THREE.EdgesGeometry(hullGeometry, 30); // 30 degree threshold

    const hullMaterial = new THREE.MeshStandardMaterial({
      color: 0x006622, // Dark green metallic
      roughness: 0.3,
      metalness: 0.8,
      emissive: 0x002200,
      emissiveIntensity: 0.2,
    });

    const hull = new THREE.Mesh(hullGeometry, hullMaterial);
    hull.name = 'destroyer_hull';
    body.add(hull);

    // Add edge highlights for a more defined shape
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff44,
      transparent: true,
      opacity: 0.5,
    });

    const edges = new THREE.LineSegments(hullEdges, edgeMaterial);
    hull.add(edges);

    // ===== SIDE ARMOR =====
    // Add angular armor plates on sides for protection
    const sideArmorGeometry = new THREE.BoxGeometry(
      enemyType.size * 0.8,
      enemyType.size * 1.0,
      enemyType.size * 1.8
    );

    const armorMaterial = new THREE.MeshStandardMaterial({
      color: 0x005522,
      roughness: 0.4,
      metalness: 0.7,
    });

    // Left armor plate
    const leftArmor = new THREE.Mesh(sideArmorGeometry, armorMaterial);
    leftArmor.position.set(-enemyType.size * 1.0, 0, enemyType.size * 0.2);
    leftArmor.rotation.z = Math.PI / 12; // Angled slightly
    body.add(leftArmor);

    // Right armor plate
    const rightArmor = new THREE.Mesh(sideArmorGeometry, armorMaterial);
    rightArmor.position.set(enemyType.size * 1.0, 0, enemyType.size * 0.2);
    rightArmor.rotation.z = -Math.PI / 12; // Angled slightly in opposite direction
    body.add(rightArmor);

    // ===== MAIN TURRET =====
    // Add a large central weapon turret
    const turretBaseGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.4,
      enemyType.size * 0.4,
      enemyType.size * 0.3,
      8
    );

    const turretMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.3,
      metalness: 0.9,
    });

    const turretBase = new THREE.Mesh(turretBaseGeometry, turretMaterial);
    turretBase.position.set(0, enemyType.size * 0.4, enemyType.size * 0.8);
    body.add(turretBase);

    // Turret cannon
    const cannonGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.1,
      enemyType.size * 0.15,
      enemyType.size * 1.2,
      8
    );

    const cannonMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.2,
      metalness: 1.0,
      emissive: 0x00ff44,
      emissiveIntensity: 0.5,
    });
    const cannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
    cannon.position.set(0, enemyType.size * 0.2, 0);
    cannon.rotation.x = -Math.PI / 2;
    turretBase.add(cannon);

    // ===== SECONDARY TURRETS =====
    // Add side turrets for enhanced firepower
    const secondaryTurretGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.2,
      enemyType.size * 0.2,
      enemyType.size * 0.15,
      6
    );

    const secondaryTurretMaterial = new THREE.MeshStandardMaterial({
      color: 0x222222,
      roughness: 0.3,
      metalness: 0.8,
    });

    // Secondary cannon geometry
    const secondaryCannonGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.06,
      enemyType.size * 0.08,
      enemyType.size * 0.6,
      6
    );

    // Create left secondary turret
    const leftTurret = new THREE.Mesh(
      secondaryTurretGeometry,
      secondaryTurretMaterial
    );
    leftTurret.position.set(
      -enemyType.size * 0.6,
      enemyType.size * 0.2,
      enemyType.size * 0.4
    );
    body.add(leftTurret);

    const leftCannon = new THREE.Mesh(secondaryCannonGeometry, cannonMaterial);
    leftCannon.position.set(0, enemyType.size * 0.1, 0);
    leftCannon.rotation.x = -Math.PI / 2;
    leftTurret.add(leftCannon);

    // Create right secondary turret
    const rightTurret = new THREE.Mesh(
      secondaryTurretGeometry,
      secondaryTurretMaterial
    );
    rightTurret.position.set(
      enemyType.size * 0.6,
      enemyType.size * 0.2,
      enemyType.size * 0.4
    );
    body.add(rightTurret);

    const rightCannon = new THREE.Mesh(secondaryCannonGeometry, cannonMaterial);
    rightCannon.position.set(0, enemyType.size * 0.1, 0);
    rightCannon.rotation.x = -Math.PI / 2;
    rightTurret.add(rightCannon);

    // ===== SENSOR ARRAY =====
    // Add a radar/sensor array on top
    const sensorBaseGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.2,
      enemyType.size * 0.25,
      enemyType.size * 0.1,
      8
    );

    const sensorBase = new THREE.Mesh(sensorBaseGeometry, turretMaterial);
    sensorBase.position.set(0, enemyType.size * 0.4, -enemyType.size * 0.6);
    body.add(sensorBase);

    // Rotating radar dish
    const radarDishGeometry = new THREE.SphereGeometry(
      enemyType.size * 0.25,
      8,
      4,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );

    const radarDishMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.4,
      metalness: 0.7,
    });

    const radarDish = new THREE.Mesh(radarDishGeometry, radarDishMaterial);
    radarDish.name = 'destroyer_radar_dish';
    radarDish.rotation.x = Math.PI;
    radarDish.userData.rotate = true; // Flag for animation
    radarDish.userData.rotationSpeed = 0.02;
    sensorBase.add(radarDish);

    // ===== WARNING LIGHTS =====
    // Add warning lights that flash when weapons are charging
    const destroyerWarningLightGeometry = new THREE.SphereGeometry(
      enemyType.size * 0.08,
      8,
      8
    );
    const destroyerWarningLightMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff44,
      emissive: 0x00ff44,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    });

    const destroyerWarningLightPositions = [
      {
        x: -enemyType.size * 0.6,
        y: enemyType.size * 0.1,
        z: -enemyType.size * 0.8,
      },
      {
        x: enemyType.size * 0.6,
        y: enemyType.size * 0.1,
        z: -enemyType.size * 0.8,
      },
      { x: 0, y: enemyType.size * 0.5, z: enemyType.size * 0.5 },
    ];

    destroyerWarningLightPositions.forEach((pos, index) => {
      const light = new THREE.Mesh(
        destroyerWarningLightGeometry,
        destroyerWarningLightMaterial.clone()
      );
      light.name = `destroyer_warning_light_${index}`;
      light.position.set(pos.x, pos.y, pos.z);
      light.userData.pulsate = true;
      light.userData.pulseMin = 0.6;
      light.userData.pulseMax = 1.0;
      light.userData.pulseSpeed = 1.5 + Math.random();
      body.add(light);
    });

    // ===== ENGINE EXHAUSTS =====
    // Add engine exhausts at the back
    const engineGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.2,
      enemyType.size * 0.15,
      enemyType.size * 0.4,
      8
    );

    const enginePositions = [
      {
        x: -enemyType.size * 0.4,
        y: -enemyType.size * 0.1,
        z: -enemyType.size * 1.0,
      },
      { x: 0, y: -enemyType.size * 0.1, z: -enemyType.size * 1.0 },
      {
        x: enemyType.size * 0.4,
        y: -enemyType.size * 0.1,
        z: -enemyType.size * 1.0,
      },
    ];

    enginePositions.forEach((pos, index) => {
      const engine = new THREE.Mesh(engineGeometry, turretMaterial);
      engine.name = `destroyer_engine_${index}`;
      engine.position.set(pos.x, pos.y, pos.z);
      engine.rotation.x = Math.PI / 2;
      body.add(engine);

      // Add engine glow
      const glowGeometry = new THREE.CylinderGeometry(
        enemyType.size * 0.1,
        enemyType.size * 0.03,
        enemyType.size * 0.6,
        8
      );

      const glowMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ff22,
        emissive: 0x00ff22,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.7,
      });

      const engineGlow = new THREE.Mesh(glowGeometry, glowMaterial);
      engineGlow.name = `destroyer_engine_glow_${index}`;
      engineGlow.position.set(0, 0, enemyType.size * 0.5);
      engineGlow.userData.pulsate = true;
      engineGlow.userData.pulseMin = 0.7;
      engineGlow.userData.pulseMax = 1.2;
      engineGlow.userData.pulseSpeed = 3 + Math.random();
      engine.add(engineGlow);
    });
  }

  createBossMesh(body, enemyType) {
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

  // Spawn enemy at a position
  spawnEnemy(position, typeName = null) {
    // If no specific type requested, choose randomly
    const enemyType = typeName
      ? enemyTypes.find((t) => t.name === typeName)
      : enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

    const enemyMesh = this.createEnemyMesh(enemyType);
    enemyMesh.position.copy(position);

    // Look at player initially
    const lookAtPosition = this.camera.position.clone();
    enemyMesh.lookAt(lookAtPosition);

    // Store enemy data
    const enemy = {
      mesh: enemyMesh,
      type: enemyType,
      health: enemyType.health,
      collider: new THREE.Box3(),
      velocity: new THREE.Vector3(),
      isActive: true,
      lastFireTime: 0,
      fireRate: 2000, // milliseconds between shots
    };

    // Update the enemy collider
    enemy.collider.setFromObject(enemyMesh);

    this.enemies.push(enemy);
    this.scene.add(enemyMesh);

    // Add emissive glow to make enemies more visible
    enemy.mesh.traverse((child) => {
      if (child.isMesh && child.material) {
        // Make enemy materials emissive with higher intensity for visibility
        child.material.emissive = new THREE.Color(enemyType.color);
        child.material.emissiveIntensity = 0.8;
      }
    });

    // Add a point light attached to enemy for better visibility
    const enemyLight = new THREE.PointLight(enemyType.color, 0.6, 5);
    enemyLight.position.set(0, 0, 0);
    enemy.mesh.add(enemyLight);

    return enemy;
  }

  // Spawn enemies in the tunnel segments
  spawnEnemiesInTunnel(segmentLength) {
    // Only consider segments beyond the first one to avoid enemies too close to player start
    const validSegments = this.levelSegments.slice(1);

    // Choose a random segment
    if (validSegments.length === 0) return;

    // Choose a random segment closer to the player (between 20-60% of the way through the tunnel)
    const segmentIndex =
      Math.floor(validSegments.length * 0.2) +
      Math.floor(Math.random() * (validSegments.length * 0.4));

    if (!validSegments[segmentIndex]) return;

    const segment = validSegments[segmentIndex];

    // Calculate a position somewhere in the segment
    const segmentPosition = segment.position.clone();

    // Get segment dimensions from children (assuming first child is floor)
    let segmentWidth = 10;
    let segmentHeight = 10;

    if (segment.children.length >= 4) {
      // For simplicity assume the order: floor, ceiling, leftWall, rightWall
      const floor = segment.children.find(
        (child) =>
          child.position.y < 0 &&
          child.geometry &&
          child.geometry.type === 'PlaneGeometry'
      );
      const ceiling = segment.children.find(
        (child) =>
          child.position.y > 0 &&
          child.geometry &&
          child.geometry.type === 'PlaneGeometry'
      );

      if (floor && floor.geometry.parameters) {
        segmentWidth = floor.geometry.parameters.width * 0.8; // 80% of width to stay away from walls
      }

      if (floor && ceiling) {
        segmentHeight = Math.abs(ceiling.position.y - floor.position.y) * 0.8; // 80% of height to stay away from floor/ceiling
      }
    }

    // Random position within segment bounds - placed in middle of tunnel for visibility
    const x = (Math.random() - 0.5) * segmentWidth * 0.6;
    const y = (Math.random() - 0.5) * segmentHeight * 0.6;
    const z = -segmentLength * (Math.random() * 0.7 + 0.15); // Position between 15% and 85% through segment

    const spawnPosition = new THREE.Vector3(x, y, z).applyMatrix4(
      segment.matrixWorld
    );

    // Create a visual debug marker for the spawn point
    const debugSpawn = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff00ff })
    );
    debugSpawn.position.copy(spawnPosition);
    this.scene.add(debugSpawn);

    // Remove debug marker after 5 seconds
    setTimeout(() => {
      this.scene.remove(debugSpawn);
      debugSpawn.geometry.dispose();
      debugSpawn.material.dispose();
    }, 5000);

    const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
    return this.spawnEnemy(spawnPosition, enemyType.name);
  }

  // Spawn predefined enemies from level blueprint
  spawnPredefinedEnemies() {
    if (!this.levelManager || !this.levelManager.currentLevel) return;

    const level = this.levelManager.currentLevel;

    // Set total enemies count once (first time we load the level)
    if (this.totalPredefinedEnemies === 0 && level.enemySpawns) {
      this.totalPredefinedEnemies = level.enemySpawns.length;
      // Update UI with enemy count
      if (this.gameState && this.gameState.uiManager) {
        this.gameState.uiManager.updateEnemyCount(
          this.destroyedPredefinedEnemies.size,
          this.totalPredefinedEnemies
        );
      }
    }

    for (const spawnPoint of level.enemySpawns) {
      // Generate a unique ID for this spawn point
      const spawnPointId = `${spawnPoint.position.x}_${spawnPoint.position.y}_${spawnPoint.position.z}`;

      // Skip if this enemy was permanently destroyed
      if (this.destroyedPredefinedEnemies.has(spawnPointId)) {
        continue;
      }

      // Check if enemy should be visible now (based on player position)
      const distanceToPlayer = spawnPoint.position.distanceTo(
        this.camera.position
      );

      // Only spawn if within reasonable distance and not already spawned
      if (distanceToPlayer < 50 && distanceToPlayer > 5) {
        // Check if this enemy is already spawned
        const alreadySpawned = this.enemies.some((enemy) => {
          return enemy.mesh.userData.spawnPointId === spawnPointId;
        });

        if (!alreadySpawned) {
          // Use the proper spawnEnemy method to create fully initialized enemy
          const enemy = this.spawnEnemy(
            spawnPoint.position,
            spawnPoint.enemyType
          );

          if (enemy && enemy.mesh) {
            // Mark it as a predefined spawn
            enemy.mesh.userData.isPredefined = true;
            enemy.mesh.userData.spawnPointId = spawnPointId;
            enemy.mesh.userData.spawnPosition = spawnPoint.position.clone();
          }
        }
      }
    }

    // Check win condition - all predefined enemies destroyed
    this.checkLevelCompletion();
  }

  // Check if all enemies in the level are destroyed
  checkLevelCompletion() {
    if (
      this.levelManager &&
      this.levelManager.currentLevel &&
      this.destroyedPredefinedEnemies.size >= this.totalPredefinedEnemies &&
      this.totalPredefinedEnemies > 0
    ) {
      // All enemies destroyed - level complete!
      console.log('Level completed! All enemies destroyed.');

      // Notify game state that level is complete
      if (this.gameState && this.gameState.levelCompleted) {
        this.gameState.levelCompleted();
      }
    }
  }

  // Add method to handle enemy spawning for endless mode
  updateEndlessMode(currentTime) {
    // Check if it's time to spawn a new enemy
    if (currentTime - this.lastRandomSpawnTime > this.randomSpawnInterval) {
      this.spawnEnemiesInTunnel(20); // Use a default segment length
      this.lastRandomSpawnTime = currentTime;

      // Gradually decrease spawn interval for increasing difficulty
      // Minimum 1 second between spawns
      this.randomSpawnInterval = Math.max(1000, this.randomSpawnInterval - 50);
    }
  }
  // Reset enemies for new level with defensive checks
  resetLevel() {
    // Clear tracking of destroyed enemies
    if (this.destroyedPredefinedEnemies) {
      this.destroyedPredefinedEnemies.clear();
    } else {
      this.destroyedPredefinedEnemies = new Set();
    }

    this.totalPredefinedEnemies = 0;

    // Remove all existing enemies with defensive checks
    if (this.enemies && this.enemies.length) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];

        if (!enemy) continue;

        // Remove from scene with defensive check
        if (this.scene && enemy.mesh) {
          this.scene.remove(enemy.mesh);

          // Clean up resources with defensive checks
          try {
            enemy.mesh.traverse((child) => {
              if (child.geometry) child.geometry.dispose();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((m) => m && m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            });
          } catch (error) {
            console.warn('Error disposing enemy resources:', error);
          }
        }
      }
    }

    this.enemies = [];

    // Reset endless mode timers
    this.lastRandomSpawnTime = 0;
    this.randomSpawnInterval = 5000;
  }
  // Enemy update function
  updateEnemies(delta, projectiles) {
    // Check if level has predefined enemies or if we should use endless mode
    const currentTime = Date.now();
    if (this.levelManager && this.levelManager.isEndless) {
      this.updateEndlessMode(currentTime);
    } else {
      this.spawnPredefinedEnemies();
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.isActive) continue;

      // Update enemy position
      const distanceToPlayer = enemy.mesh.position.distanceTo(
        this.camera.position
      );

      // Apply enemy type-specific movement
      if (distanceToPlayer < 30) {
        // Get direction to player
        const direction = new THREE.Vector3();
        direction
          .subVectors(this.camera.position, enemy.mesh.position)
          .normalize();

        // Apply movement patterns based on enemy type
        let movementSpeed = enemy.type.speed;

        // Apply behavior modifications based on enemy type
        switch (enemy.type.name) {
          case 'boss':
            // Boss moves more deliberately with minimal randomness
            direction.x += (Math.random() - 0.5) * 0.05;
            direction.y += (Math.random() - 0.5) * 0.05;
            direction.z += (Math.random() - 0.5) * 0.05;

            // Boss tries to maintain a certain distance from player
            const optimalDistance = 15;
            const distanceAdjustment =
              (distanceToPlayer - optimalDistance) * 0.02;
            movementSpeed *= Math.max(0, Math.min(1.5, distanceAdjustment));
            break;

          case 'bomber':
            // Bombers tend to move to positions above the player to drop bombs
            direction.y += 0.1; // Slight upward bias
            direction.x += (Math.random() - 0.5) * 0.3;
            direction.z += (Math.random() - 0.5) * 0.1;
            break;

          case 'destroyer':
            // Destroyers move more deliberately with less randomness
            direction.x += (Math.random() - 0.5) * 0.1;
            direction.y += (Math.random() - 0.5) * 0.1;
            direction.z += (Math.random() - 0.5) * 0.1;

            // Destroyers also prefer a certain engagement distance
            const destroyerOptimalDistance = 10;
            const destroyerDistAdj =
              (distanceToPlayer - destroyerOptimalDistance) * 0.01;
            movementSpeed *= Math.max(0, Math.min(1.2, destroyerDistAdj));
            break;

          default:
            // Default for scouts and fighters - more erratic movement
            direction.x += (Math.random() - 0.5) * 0.2;
            direction.y += (Math.random() - 0.5) * 0.2;
            direction.z += (Math.random() - 0.5) * 0.2;
        }

        // Update velocity with smoothing - different smoothing per enemy type
        let smoothingFactor = 0.05;
        if (enemy.type.name === 'boss') smoothingFactor = 0.02;
        else if (enemy.type.name === 'destroyer') smoothingFactor = 0.03;

        enemy.velocity.lerp(
          direction.multiplyScalar(movementSpeed),
          smoothingFactor
        );

        // Apply velocity
        enemy.mesh.position.add(enemy.velocity);

        // Make enemy face the player
        enemy.mesh.lookAt(this.camera.position);

        // Apply animations to enemy mesh based on its type
        animateEnemy(enemy, delta);
      }

      // Update enemy collider
      enemy.mesh.updateMatrixWorld(true);
      enemy.collider.setFromObject(enemy.mesh);

      // Check collision with player
      const collisionDistance = enemy.type.size * 2;
      if (!this.gameState.isGameOver && distanceToPlayer < collisionDistance) {
        // Player takes damage
        this.gameState.takeDamage(enemy.type.damage);

        // Destroy the enemy
        this.destroyEnemy(i);
        continue;
      }

      // Check distance - if enemy is too far behind player, remove it
      if (distanceToPlayer > 50) {
        this.scene.remove(enemy.mesh);
        this.enemies.splice(i, 1);
        continue;
      }

      // Check projectile collision
      for (let j = projectiles.length - 1; j >= 0; j--) {
        const projectile = projectiles[j];

        if (checkProjectileEnemyCollision(projectile, enemy)) {
          // Enemy takes damage - different damage resistance based on enemy type
          let damageMultiplier = 1.0;
          if (enemy.type.name === 'boss')
            damageMultiplier = 0.7; // Boss takes less damage
          else if (enemy.type.name === 'destroyer') damageMultiplier = 0.8; // Destroyers have some armor

          enemy.health -= projectile.power * damageMultiplier;

          // Visual hit feedback
          this.createHitEffect(projectile.mesh.position.clone());

          // Play hit sound
          if (this.audioManager && this.audioManager.initialized) {
            try {
              this.audioManager.playSound('hit', {
                volume: Math.min(0.7, 10 / Math.max(1, distanceToPlayer)),
                fallback: 'explosion', // Try playing explosion sound if hit is not available
              });
            } catch (e) {
              console.warn('Error playing hit sound:', e);
            }
          }

          // Remove projectile
          if (projectile.mesh.parent) {
            projectile.mesh.parent.remove(projectile.mesh);
          }
          if (projectile.trail.parent) {
            projectile.trail.parent.remove(projectile.trail);
          }

          if (projectile.mesh.geometry) projectile.mesh.geometry.dispose();
          if (projectile.mesh.material) projectile.mesh.material.dispose();
          if (projectile.trail.geometry) projectile.trail.geometry.dispose();
          if (projectile.trail.material) projectile.trail.material.dispose();

          // Clear references
          projectile.mesh.geometry = null;
          projectile.mesh.material = null;
          projectile.trail.geometry = null;
          projectile.trail.material = null;

          projectiles.splice(j, 1);

          // Check if enemy is destroyed
          if (enemy.health <= 0) {
            // Add score
            this.gameState.score += enemy.type.pointValue;

            // Destroy the enemy
            this.destroyEnemy(i);
            break;
          }
        }
      }

      // Handle enemy firing projectiles
      if (
        enemy.type.name !== 'scout' &&
        currentTime - enemy.lastFireTime > enemy.fireRate
      ) {
        // Only shoot if within range and in front of the player
        const firingRange = getEnemyFiringRange(enemy.type.name);

        // Check if player is in front of the enemy
        const inFrontOf =
          this.camera
            .getWorldDirection(new THREE.Vector3())
            .dot(
              new THREE.Vector3()
                .subVectors(enemy.mesh.position, this.camera.position)
                .normalize()
            ) < 0;

        if (distanceToPlayer < firingRange && inFrontOf) {
          this.fireEnemyProjectile(enemy);
          enemy.lastFireTime = currentTime;

          // Set next fire rate based on enemy type
          if (enemy.type.name === 'bomber') {
            // Bombers fire slower but with more powerful explosives
            enemy.fireRate = 3000 + Math.random() * 1000;
          } else if (enemy.type.name === 'destroyer') {
            // Destroyers fire at medium rate with accurate shots
            enemy.fireRate = 2000 + Math.random() * 1000;
          } else if (enemy.type.name === 'boss') {
            // Boss fires faster and more frequently
            enemy.fireRate = 800 + Math.random() * 700;

            // Boss occasionally fires from multiple weapons at once
            if (Math.random() < 0.3) {
              setTimeout(() => {
                if (enemy && enemy.mesh && enemy.mesh.parent) {
                  this.fireEnemyProjectile(enemy);
                }
              }, 200);

              if (Math.random() < 0.2) {
                setTimeout(() => {
                  if (enemy && enemy.mesh && enemy.mesh.parent) {
                    this.fireEnemyProjectile(enemy);
                  }
                }, 400);
              }
            }
          } else {
            // Default fire rate for others
            enemy.fireRate = 2000 + Math.random() * 1000;
          }
        }
      }
    } // Update enemy projectiles
    this.updateEnemyProjectiles(delta);

    // Process visual effects
    this.processHitEffects();
    this.processExplosionEffects();
  } // Create a visual effect when a projectile hits an enemy (optimized)
  createHitEffect(position) {
    // Skip if there's no scene
    if (!this.scene) return;

    // Create a small flash at hit position - reuse an existing light if possible
    const flash =
      this.getFromPool('hitLight') || new THREE.PointLight(0xffff00, 2, 5);
    flash.position.copy(position);
    flash.visible = true;
    flash.intensity = 2;

    // Add to scene
    this.scene.add(flash);

    // Store timestamp for cleanup in animation loop rather than using setTimeout
    flash.userData.removeTime = Date.now() + 100;
    flash.userData.isActive = true;

    // Track light in our active lights array instead of using scene traversal
    if (!this.activeHitLights) {
      this.activeHitLights = [];
    }
    this.activeHitLights.push(flash); // We'll handle particle effects in the main animation loop for better performance
    // Add to a hits array that will be processed during the main game loop
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
  destroyEnemy(index) {
    // Check if we have a valid array and index
    if (!this.enemies || index < 0 || index >= this.enemies.length) {
      return;
    }

    const enemy = this.enemies[index];
    if (!enemy) return;

    // Check if this is a predefined enemy and mark as permanently destroyed
    if (
      enemy.mesh &&
      enemy.mesh.userData &&
      enemy.mesh.userData.isPredefined &&
      enemy.mesh.userData.spawnPointId
    ) {
      this.destroyedPredefinedEnemies.add(enemy.mesh.userData.spawnPointId);

      // Update the UI with new count
      if (this.gameState && this.gameState.uiManager) {
        this.gameState.uiManager.updateEnemyCount(
          this.destroyedPredefinedEnemies.size,
          this.totalPredefinedEnemies
        );
      }

      // Check if level is complete
      this.checkLevelCompletion();
    }

    // First, let's make sure lights are removed first
    const lightsToRemove = [];
    enemy.mesh.traverse((child) => {
      if (child.isLight) {
        lightsToRemove.push(child);
      }
    });

    // Remove lights separately to avoid modification during traversal
    for (const light of lightsToRemove) {
      if (light.parent) {
        light.parent.remove(light);
      }
    }

    // Create explosion particle effect (do this before removing from scene)    // Create explosion effect with defensive checks
    if (this.scene && enemy.mesh && enemy.mesh.position) {
      createExplosionEffect(this.scene, enemy.mesh.position.clone());

      // Remove the entire enemy mesh from scene
      this.scene.remove(enemy.mesh);
    }

    // Play explosion sound with defensive checks
    if (
      this.audioManager &&
      this.audioManager.initialized &&
      enemy.mesh &&
      enemy.mesh.position &&
      this.camera
    ) {
      try {
        // Calculate volume based on distance to player
        const distanceToPlayer = enemy.mesh.position.distanceTo(
          this.camera.position
        );
        const volume = Math.min(0.8, 10 / Math.max(1, distanceToPlayer));
        this.audioManager.playSound('explosion', { volume });
      } catch (error) {
        console.warn('Error playing explosion sound:', error);
      }
    }

    // Properly dispose of all resources
    const disposeMaterial = (material) => {
      if (!material) return;

      // Dispose textures
      const propertiesToCheck = [
        'map',
        'lightMap',
        'bumpMap',
        'normalMap',
        'specularMap',
        'envMap',
        'emissiveMap',
        'roughnessMap',
        'metalnessMap',
        'alphaMap',
      ];

      propertiesToCheck.forEach((prop) => {
        if (material[prop]) {
          material[prop].dispose();
        }
      });

      material.dispose();
    };

    // Clean up resources with enhanced disposal
    enemy.mesh.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose();
      }

      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(child.material);
        }

        // Remove material reference from the child
        child.material = undefined;
      }
    });

    // Remove reference from array
    this.enemies.splice(index, 1);
  }

  // Enemy projectile shooting method
  fireEnemyProjectile(enemy) {
    if (!enemy || !enemy.mesh) return;

    const projectileType = this.getProjectileTypeForEnemy(enemy);
    if (!projectileType) return;
    // Create the projectile mesh based on type
    let projectileGeometry;

    // Size based on radius or default to enemy size
    const projectileSize = projectileType.radius || enemy.type.size * 0.1;

    // Different geometry based on projectile type
    switch (projectileType.type) {
      case 'heavylaser':
        // Create an elongated cylinder for laser beams
        projectileGeometry = new THREE.CylinderGeometry(
          projectileSize * 0.4,
          projectileSize * 0.4,
          projectileSize * 4,
          8,
          1
        );
        // Rotate to align with direction of travel
        projectileGeometry.rotateX(Math.PI / 2);
        break;

      case 'missile':
        // Create a cone with a pointed end for missiles
        projectileGeometry = new THREE.ConeGeometry(
          projectileSize * 0.8,
          projectileSize * 3,
          8
        );
        // Rotate to align with direction of travel
        projectileGeometry.rotateX(Math.PI);
        break;

      case 'nova':
        // Create a spiky geometry for nova blasts
        projectileGeometry = new THREE.OctahedronGeometry(projectileSize, 1);
        break;

      case 'bomb':
        // Create a slightly irregular shape for bombs
        projectileGeometry = new THREE.DodecahedronGeometry(projectileSize, 0);
        break;

      case 'plasma':
        // Create a smoother, more detailed sphere for plasma
        projectileGeometry = new THREE.SphereGeometry(projectileSize, 12, 12);
        break;

      default:
        // Default to simple sphere
        projectileGeometry = new THREE.SphereGeometry(projectileSize, 8, 8);
    }

    // Create material with appropriate properties
    const projectileMaterial = new THREE.MeshStandardMaterial({
      color: projectileType.color,
      emissive: projectileType.color,
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.2,
      transparent: projectileType.pulsate || projectileType.explosive,
      opacity: 0.9,
    });

    const projectileMesh = new THREE.Mesh(
      projectileGeometry,
      projectileMaterial
    );

    // Position the projectile in front of the enemy
    const projectilePos = this.getProjectileSpawnPosition(
      enemy,
      projectileType
    );
    projectileMesh.position.copy(projectilePos);

    // Calculate velocity (direction to player)
    const direction = new THREE.Vector3();
    direction
      .subVectors(this.camera.position, projectileMesh.position)
      .normalize();

    // Add a slight inaccuracy to make it more fair
    const inaccuracy = 0.05;
    direction.x += (Math.random() * 2 - 1) * inaccuracy;
    direction.y += (Math.random() * 2 - 1) * inaccuracy;
    direction.z += (Math.random() * 2 - 1) * inaccuracy;
    direction.normalize();

    // Scale by projectile speed
    const velocity = direction.multiplyScalar(projectileType.speed);

    // Create the projectile object
    const projectile = {
      mesh: projectileMesh,
      velocity: velocity,
      type: projectileType,
      power: projectileType.damage,
      life: projectileType.life || 3000, // Time in ms before automatic removal
      timestamp: Date.now(),
    };

    // Add to scene
    this.scene.add(projectileMesh);

    // Add to enemy projectiles array
    if (!this.enemyProjectiles) {
      this.enemyProjectiles = [];
    }
    this.enemyProjectiles.push(projectile);

    // Add visual effects based on projectile type
    this.addProjectileEffects(projectile);

    // Play sound effect
    if (this.audioManager && this.audioManager.initialized) {
      const soundOptions = {
        volume: Math.min(
          0.4,
          5 / Math.max(1, enemy.mesh.position.distanceTo(this.camera.position))
        ),
      };

      switch (projectileType.type) {
        case 'laser':
          this.audioManager.playSound('laserShot', soundOptions);
          break;
        case 'bomb':
          this.audioManager.playSound('bombLaunch', soundOptions);
          break;
        case 'plasma':
          this.audioManager.playSound('plasmaShot', soundOptions);
          break;
        default:
          this.audioManager.playSound('shoot', soundOptions);
      }
    }

    return projectile;
  }

  // Get spawn position based on enemy type
  getProjectileSpawnPosition(enemy, projectileType) {
    const position = new THREE.Vector3();

    switch (enemy.type.name) {
      case 'fighter':
        // Spawn from front weapon
        enemy.mesh.updateMatrixWorld(true);
        position.set(0, 0, enemy.type.size * 1.3);
        position.applyMatrix4(enemy.mesh.matrixWorld);
        break;

      case 'bomber':
        // Spawn from one of the launch tubes
        const tubeIndex = Math.floor(Math.random() * 4);
        enemy.mesh.traverse((child) => {
          if (
            child.name &&
            child.name.includes('bomber_tube') &&
            child.name.endsWith(`_${tubeIndex}`)
          ) {
            child.updateMatrixWorld(true);
            position.set(0, -enemy.type.size * 0.4, 0);
            position.applyMatrix4(child.matrixWorld);
          }
        });

        // If no specific tube was found, use a default position
        if (position.length() === 0) {
          position.set(0, -enemy.type.size * 0.6, 0);
          position.applyMatrix4(enemy.mesh.matrixWorld);
        }
        break;

      case 'destroyer':
        // Alternate between main cannon and side turrets
        if (!enemy.lastFiringTurret || enemy.lastFiringTurret === 'side') {
          // Fire from main turret
          enemy.mesh.traverse((child) => {
            if (child.name === 'destroyer_hull') {
              child.updateMatrixWorld(true);
              position.set(0, enemy.type.size * 0.6, enemy.type.size * 1.2);
              position.applyMatrix4(child.matrixWorld);
            }
          });
          enemy.lastFiringTurret = 'main';
        } else {
          // Fire from side turrets
          const side = Math.random() > 0.5 ? 1 : -1; // Left or right
          position.set(
            side * enemy.type.size * 0.8,
            enemy.type.size * 0.2,
            enemy.type.size * 0.5
          );
          position.applyMatrix4(enemy.mesh.matrixWorld);
          enemy.lastFiringTurret = 'side';
        }
        break;

      case 'boss':
        // Randomly choose between weapon pods
        const weaponPodIndex = Math.floor(Math.random() * 4);
        let weaponPodFound = false;

        enemy.mesh.traverse((child) => {
          if (child.name === `boss_weapon_pod_${weaponPodIndex}`) {
            child.updateMatrixWorld(true);

            // Find barrel in the pod
            child.traverse((subChild) => {
              if (
                !weaponPodFound &&
                subChild.name &&
                subChild.name.includes('muzzle')
              ) {
                subChild.updateMatrixWorld(true);
                position.set(0, 0, 0);
                position.applyMatrix4(subChild.matrixWorld);
                weaponPodFound = true;
              }
            });

            if (!weaponPodFound) {
              // If muzzle not found, use pod position
              position.copy(child.position);
              // Move outward from pod
              const podDirection = child.position.clone().normalize();
              position.add(podDirection.multiplyScalar(enemy.type.size * 0.8));
            }
          }
        });

        // If no pod found, use a default position
        if (position.length() === 0) {
          // Random position around the sphere
          const angle = Math.random() * Math.PI * 2;
          position.set(
            Math.cos(angle) * enemy.type.size * 1.5,
            (Math.random() - 0.5) * enemy.type.size,
            Math.sin(angle) * enemy.type.size * 1.5
          );
          position.applyMatrix4(enemy.mesh.matrixWorld);
        }
        break;

      default:
        // Default position in front of enemy
        enemy.mesh.updateMatrixWorld(true);
        position.set(0, 0, enemy.type.size);
        position.applyMatrix4(enemy.mesh.matrixWorld);
    }

    return position;
  }

  // Define different projectile types for different enemies
  getProjectileTypeForEnemy(enemy) {
    switch (enemy.type.name) {
      case 'scout':
        return null; // Scouts don't shoot

      case 'fighter':
        return {
          type: 'laser',
          color: 0xff3300,
          speed: 0.2,
          damage: 5,
          life: 3000, // milliseconds
          trail: true,
        };
      case 'bomber':
        return {
          type: 'bomb',
          color: 0xffaa00,
          speed: 0.1,
          damage: 20, // Increased damage
          life: 5500, // Longer lifetime
          radius: enemy.type.size * 0.18, // Larger radius
          explosive: true,
          explosionRadius: 2.0, // Larger explosion
          gravity: 0.001, // Bombs fall slightly
          pulsate: true, // Visual pulsing effect
          unstable: true, // Projectile wobbles as it moves
        };
      case 'destroyer':
        return {
          type: 'plasma',
          color: 0x00aaff,
          speed: 0.18, // Faster
          damage: 15, // More damage
          life: 4500, // Longer range
          trail: true,
          pulsate: true,
          heatSeek: true, // Slight homing capability
          radius: enemy.type.size * 0.12, // Larger projectile
          penetrating: true, // Can go through obstacles
        };
      case 'boss':
        // Random choice between different projectile types
        const projectileTypes = [
          {
            // Heavy laser
            type: 'heavylaser',
            color: 0xff0000,
            speed: 0.28,
            damage: 25,
            life: 4000,
            trail: true,
            penetrating: true,
            radius: enemy.type.size * 0.15,
          },
          {
            // Energy ball
            type: 'plasma',
            color: 0x0088ff,
            speed: 0.15,
            damage: 20,
            life: 4500,
            pulsate: true,
            radius: enemy.type.size * 0.2,
            explosive: true,
            explosionRadius: 1.5,
          },
          {
            // Guided missile
            type: 'missile',
            color: 0xff8800,
            speed: 0.1,
            damage: 30,
            life: 7000,
            trail: true,
            guided: true,
            explosive: true,
            explosionRadius: 2.0,
            acceleration: 0.002, // Speeds up as it travels
          },
          {
            // Energy nova
            type: 'nova',
            color: 0xff00ff,
            speed: 0.05,
            damage: 35,
            life: 5000,
            radius: enemy.type.size * 0.25,
            pulsate: true,
            explosive: true,
            explosionRadius: 3.0,
            splitCount: 6, // Splits into multiple projectiles on impact
          },
        ];

        return projectileTypes[
          Math.floor(Math.random() * projectileTypes.length)
        ];

      default:
        return {
          type: 'basic',
          color: 0xff0000,
          speed: 0.15,
          damage: 5,
          life: 3000,
        };
    }
  }

  // Add visual effects to projectiles
  addProjectileEffects(projectile) {
    const type = projectile.type;

    // Add point light
    const lightColor = new THREE.Color(type.color);
    const lightIntensity = 1.0;
    const lightRange = type.explosive ? 2.0 : 1.0;

    const light = new THREE.PointLight(lightColor, lightIntensity, lightRange);
    projectile.mesh.add(light);

    // For explosive projectiles, add pulsing effect
    if (type.explosive) {
      projectile.pulseData = {
        originalScale: 1.0,
        pulseSpeed: 3.0,
        pulseAmount: 0.2,
      };
    }

    // For projectiles with trails, add trail effect
    if (type.trail) {
      // Create trail geometry
      const trailSegments = 10;
      const trailPositions = new Float32Array(trailSegments * 3);

      // Initialize all positions to the projectile's current position
      for (let i = 0; i < trailSegments * 3; i += 3) {
        trailPositions[i] = projectile.mesh.position.x;
        trailPositions[i + 1] = projectile.mesh.position.y;
        trailPositions[i + 2] = projectile.mesh.position.z;
      }

      const trailGeometry = new THREE.BufferGeometry();
      trailGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(trailPositions, 3)
      );

      const trailMaterial = new THREE.PointsMaterial({
        color: type.color,
        size: 0.06,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
      });

      const trail = new THREE.Points(trailGeometry, trailMaterial);
      this.scene.add(trail);

      projectile.trail = trail;
      projectile.trailPositions = trailPositions;
      projectile.lastTrailUpdate = 0;
    }

    return projectile;
  }

  // Update enemy projectiles
  updateEnemyProjectiles(delta) {
    if (!this.enemyProjectiles || this.enemyProjectiles.length === 0) return;

    const currentTime = Date.now();

    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.enemyProjectiles[i];

      // Check lifetime
      if (currentTime - projectile.timestamp > projectile.type.life) {
        this.removeEnemyProjectile(i);
        continue;
      }
      // Update position and apply special behaviors

      // For gravity-affected projectiles (like bombs)
      if (projectile.type.gravity) {
        projectile.velocity.y -= projectile.type.gravity * delta * 60;
      }

      // For projectiles that accelerate over time
      if (projectile.type.acceleration) {
        const currentSpeed = projectile.velocity.length();
        projectile.velocity
          .normalize()
          .multiplyScalar(
            currentSpeed + projectile.type.acceleration * delta * 60
          );
      }

      // For heat-seeking projectiles
      if (projectile.type.heatSeek) {
        // Less aggressive tracking than guided missiles
        const direction = new THREE.Vector3();
        direction
          .subVectors(this.camera.position, projectile.mesh.position)
          .normalize();

        // Limited turn rate
        const turnFactor = 0.015; // Lower value than guided for less aggressive tracking
        projectile.velocity.lerp(
          direction.multiplyScalar(projectile.type.speed),
          turnFactor
        );
      }

      // For guided projectiles, adjust direction toward player
      else if (projectile.type.guided) {
        const direction = new THREE.Vector3();
        direction
          .subVectors(this.camera.position, projectile.mesh.position)
          .normalize();

        // Adjust velocity with limited turn rate
        const turnFactor = 0.035; // How quickly it can change direction
        projectile.velocity.lerp(
          direction.multiplyScalar(projectile.type.speed),
          turnFactor
        );
      }

      // For unstable projectiles (like bombs that wobble)
      if (projectile.type.unstable) {
        // Add random movement
        projectile.velocity.x += (Math.random() - 0.5) * 0.002;
        projectile.velocity.z += (Math.random() - 0.5) * 0.002;
      }

      // Apply velocity to position
      projectile.mesh.position.addScaledVector(projectile.velocity, delta * 60);
      // Visual effects based on projectile type

      // Pulsing effects (for explosive projectiles)
      if (projectile.pulseData) {
        const pulse = projectile.pulseData;
        const pulseFactor =
          Math.sin(currentTime * 0.01 * pulse.pulseSpeed) * pulse.pulseAmount +
          1;
        projectile.mesh.scale.set(pulseFactor, pulseFactor, pulseFactor);
      }

      // Pulsating glow effect
      if (projectile.type.pulsate) {
        // Find any lights in the projectile
        projectile.mesh.traverse((child) => {
          if (child.isLight) {
            const pulseIntensity = Math.sin(currentTime * 0.005) * 0.5 + 1.0;
            child.intensity =
              child.userData.baseIntensity || 1.0 * pulseIntensity;
          }
        });

        // Also pulse the emissive intensity if possible
        if (
          projectile.mesh.material &&
          projectile.mesh.material.emissiveIntensity !== undefined
        ) {
          const emissivePulse = Math.sin(currentTime * 0.008) * 0.3 + 0.7;
          projectile.mesh.material.emissiveIntensity = emissivePulse;
        }
      }

      // Update trail if present
      if (projectile.trail && projectile.trailPositions) {
        if (currentTime - projectile.lastTrailUpdate > 30) {
          // Update trail every 30ms
          projectile.lastTrailUpdate = currentTime;

          // Shift positions back
          for (let j = projectile.trailPositions.length - 3; j >= 3; j -= 3) {
            projectile.trailPositions[j] = projectile.trailPositions[j - 3];
            projectile.trailPositions[j + 1] = projectile.trailPositions[j - 2];
            projectile.trailPositions[j + 2] = projectile.trailPositions[j - 1];
          }

          // Set first position to current projectile position
          projectile.trailPositions[0] = projectile.mesh.position.x;
          projectile.trailPositions[1] = projectile.mesh.position.y;
          projectile.trailPositions[2] = projectile.mesh.position.z;

          // Update the buffer attribute
          projectile.trail.geometry.attributes.position.needsUpdate = true;
        }
      }

      // Check for collision with player
      const distanceToPlayer = projectile.mesh.position.distanceTo(
        this.camera.position
      );
      const collisionThreshold = projectile.type.explosive
        ? projectile.type.explosionRadius
        : 0.5;

      if (!this.gameState.isGameOver && distanceToPlayer < collisionThreshold) {
        // Player takes damage
        this.gameState.takeDamage(projectile.type.damage);

        // Create explosion effect
        this.createProjectileExplosion(projectile);

        // Remove projectile
        this.removeEnemyProjectile(i);
      }

      // Remove if too far from player (optimization)
      else if (distanceToPlayer > 50) {
        this.removeEnemyProjectile(i);
      }
    }
  }
  // Remove enemy projectile with defensive checks
  removeEnemyProjectile(index) {
    // Check if we have a valid array and index
    if (
      !this.enemyProjectiles ||
      index < 0 ||
      index >= this.enemyProjectiles.length
    ) {
      return;
    }

    const projectile = this.enemyProjectiles[index];
    if (!projectile) return;

    // Remove mesh from scene with defensive checks
    if (projectile.mesh && projectile.mesh.parent) {
      projectile.mesh.parent.remove(projectile.mesh);
    }

    // Remove trail if it exists with defensive checks
    if (projectile.trail && projectile.trail.parent) {
      projectile.trail.parent.remove(projectile.trail);
    }

    // Dispose resources with defensive checks
    if (projectile.mesh) {
      if (projectile.mesh.geometry) projectile.mesh.geometry.dispose();
      if (projectile.mesh.material) projectile.mesh.material.dispose();
    }

    if (projectile.trail) {
      if (projectile.trail.geometry) projectile.trail.geometry.dispose();
      if (projectile.trail.material) projectile.trail.material.dispose();
    }

    // Remove from array with defensive check
    if (index >= 0 && index < this.enemyProjectiles.length) {
      this.enemyProjectiles.splice(index, 1);
    }
  }
  // Create explosion effect for projectiles (optimized)
  createProjectileExplosion(projectile) {
    // Get light from pool or create new one
    const explosionLight =
      this.getFromPool('explosionLight') ||
      new THREE.PointLight(
        projectile.type.color,
        2.0,
        projectile.type.explosive ? 5.0 : 2.0
      );

    // Configure the light
    explosionLight.color.set(projectile.type.color);
    explosionLight.intensity = 2.0;
    explosionLight.distance = projectile.type.explosive ? 5.0 : 2.0;
    explosionLight.position.copy(projectile.mesh.position);
    explosionLight.visible = true;
    if (this.scene) {
      this.scene.add(explosionLight);
    } // Track for cleanup in animation loop
    explosionLight.userData.removeTime = Date.now() + 200;
    explosionLight.userData.isActive = true;

    // Track in active lights array instead of scene traversal
    if (!this.activeExplosionLights) {
      this.activeExplosionLights = [];
    }
    this.activeExplosionLights.push(explosionLight);

    // For explosive projectiles, create a larger explosion
    if (projectile.type.explosive) {
      // Track explosion effect in a dedicated array for processing in animation loop
      if (!this.explosionEffects) this.explosionEffects = [];

      // Get explosion mesh from pool or create new one
      let explosion = this.getFromPool('explosionMesh');

      if (!explosion) {
        const explosionGeometry = new THREE.SphereGeometry(1.0, 16, 16);
        const explosionMaterial = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        });
        explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
      } // Configure the explosion with defensive checks
      if (explosion.material) {
        explosion.material.color.set(projectile.type.color);
        explosion.material.opacity = 0.7;
      }
      explosion.scale.set(1, 1, 1);

      // Copy position with defensive check
      if (projectile && projectile.mesh) {
        explosion.position.copy(projectile.mesh.position);
      }

      // Set size based on explosion radius
      const baseSize = projectile.type.explosionRadius || 1.0;
      explosion.userData.baseSize = baseSize; // Make visible and add to scene
      explosion.visible = true;

      // Check if scene exists before adding and tracking
      if (this.scene) {
        this.scene.add(explosion);

        // Track this explosion for animation in the main loop
        if (!this.explosionEffects) {
          this.explosionEffects = [];
        }
        this.explosionEffects.push({
          mesh: explosion,
          createdAt: Date.now(),
          duration: 500,
        });
      }

      // Play explosion sound
      if (this.audioManager && this.audioManager.initialized) {
        const distanceToPlayer = projectile.mesh.position.distanceTo(
          this.camera.position
        );
        const volume = Math.min(0.7, 8 / Math.max(1, distanceToPlayer));
        this.audioManager.playSound('explosion', { volume });
      }
    }
  } // Process hit effects during the animation loop
  processHitEffects() {
    // Return early if no hit effects or scene is not available
    if (!this.scene || !this.hitEffects || this.hitEffects.length === 0) return;

    const currentTime = Date.now(); // Process hit lights that need to be returned to the pool
    // Use explicit tracking array instead of scene traversal for better performance
    if (!this.activeHitLights) {
      this.activeHitLights = [];
    }

    // Process active lights
    for (let i = this.activeHitLights.length - 1; i >= 0; i--) {
      const light = this.activeHitLights[i];

      // Skip invalid lights
      if (!light || !light.userData) {
        this.activeHitLights.splice(i, 1);
        continue;
      }

      if (light.userData.removeTime && light.userData.isActive) {
        if (currentTime > light.userData.removeTime) {
          // Remove light from scene and return to pool
          if (light.parent) {
            light.parent.remove(light);
          }
          this.returnToPool('hitLight', light);
          light.userData.isActive = false;
          this.activeHitLights.splice(i, 1);
        }
      }
    }

    // Process particle effects
    for (let i = this.hitEffects.length - 1; i >= 0; i--) {
      const effect = this.hitEffects[i];
      const elapsed = currentTime - effect.createdAt;

      // If this is the first frame for this effect, create particles
      if (!effect.processed) {
        effect.processed = true;

        // Create particle system for this hit
        const particleSystem =
          this.getFromPool('hitParticles') || this.createHitParticleSystem(); // Position the particle system
        particleSystem.position.copy(effect.position);
        particleSystem.visible = true;

        // Store reference to particle system and start time
        effect.particleSystem = particleSystem;
        if (this.scene) {
          this.scene.add(particleSystem);
        }
      } // Update particle system with defensive checks
      if (effect && effect.particleSystem) {
        const progress = Math.min(elapsed / effect.duration, 1.0);

        // Fade out particles with defensive checks
        if (effect.particleSystem.material) {
          effect.particleSystem.material.opacity = 0.8 * (1 - progress);
        }

        // Remove completed effect with comprehensive defensive checks
        if (progress >= 1.0) {
          if (this.scene && effect.particleSystem) {
            this.scene.remove(effect.particleSystem);
            this.returnToPool('hitParticles', effect.particleSystem);

            // Make sure we have a valid array index before splicing
            if (i >= 0 && i < this.hitEffects.length) {
              this.hitEffects.splice(i, 1);
            }
          }
        }
      }
    }
  }

  // Create a reusable hit particle system
  createHitParticleSystem() {
    const particleCount = 10;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    // Initialize positions (will be updated when positioned)
    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 0.3;
      positions[i + 1] = (Math.random() - 0.5) * 0.3;
      positions[i + 2] = (Math.random() - 0.5) * 0.3;
    }

    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xffaa00,
      size: 0.1,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    return new THREE.Points(particles, material);
  } // Process explosion effects in animation loop
  processExplosionEffects() {
    // Return early if no explosion effects or scene
    if (
      !this.scene ||
      !this.explosionEffects ||
      this.explosionEffects.length === 0
    )
      return;

    const currentTime = Date.now();

    // Process explosion lights that need to be returned to the pool
    // Use explicit tracking array instead of scene traversal
    if (!this.activeExplosionLights) {
      this.activeExplosionLights = [];
    }

    // Process active explosion lights
    for (let i = this.activeExplosionLights.length - 1; i >= 0; i--) {
      const light = this.activeExplosionLights[i];

      // Skip invalid lights
      if (!light || !light.userData) {
        this.activeExplosionLights.splice(i, 1);
        continue;
      }

      if (light.userData.removeTime && light.userData.isActive) {
        if (currentTime > light.userData.removeTime) {
          // Remove light from scene and return to pool
          if (light.parent) {
            light.parent.remove(light);
          }
          this.returnToPool('explosionLight', light);
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
        const scale = 1.0 + progress * 2.0;
        const baseSize = effect.mesh.userData.baseSize || 1.0;
        effect.mesh.scale.set(
          scale * baseSize,
          scale * baseSize,
          scale * baseSize
        ); // Fade out with defensive checks
        if (effect.mesh && effect.mesh.material) {
          effect.mesh.material.opacity = 0.7 * (1.0 - progress);
        }
        // Remove completed effects with enhanced defensive checks
        if (progress >= 1.0) {
          if (this.scene && effect.mesh) {
            this.scene.remove(effect.mesh);
            this.returnToPool('explosionMesh', effect.mesh);

            // Make sure we have a valid array index before splicing
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
}

export default EnemyManager;
