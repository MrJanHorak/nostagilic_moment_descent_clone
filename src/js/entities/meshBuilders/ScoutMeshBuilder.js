import * as THREE from 'three';
import MeshBuilder from './MeshBuilder.js';

class ScoutMeshBuilder extends MeshBuilder {
  buildMesh(body, enemyType) {
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
}

export default ScoutMeshBuilder;
