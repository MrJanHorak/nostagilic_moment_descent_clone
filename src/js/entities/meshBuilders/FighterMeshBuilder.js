import * as THREE from 'three';
import MeshBuilder from './MeshBuilder.js';

class FighterMeshBuilder extends MeshBuilder {
  buildMesh(body, enemyType) {
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
}

export default FighterMeshBuilder;
