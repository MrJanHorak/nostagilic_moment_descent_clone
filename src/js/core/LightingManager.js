// LightingManager.js
// Handles lighting logic for tunnel segments
import * as THREE from 'three';

class LightingManager {
  constructor(glowSphereGeometry) {
    this.glowSphereGeometry =
      glowSphereGeometry || new THREE.SphereGeometry(0.15, 6, 6);
  }

  addLightsToSegment(segment, color = 0x4466aa, segmentLength = 20) {
    // Only one point light per segment for performance
    const light = new THREE.PointLight(color, 1.5, 20, 2);
    light.position.set(0, 0, -segmentLength / 2);
    segment.add(light);

    // Make light source visible with a glowing sphere (lower geometry complexity)
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
    });
    const glowSphere = new THREE.Mesh(this.glowSphereGeometry, glowMaterial);
    glowSphere.position.copy(light.position);
    segment.add(glowSphere);

    // Add a subtle ambient light
    const ambientLight = new THREE.AmbientLight(color, 0.25);
    segment.add(ambientLight);
  }
}

export default LightingManager;
