import * as THREE from 'three';
import MeshBuilder from './MeshBuilder.js';

class DestroyerMeshBuilder extends MeshBuilder {
  buildMesh(body, enemyType) {
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
}

export default DestroyerMeshBuilder;
