// Spaceship entity module
import * as THREE from 'three';

class Spaceship {
  constructor() {
    this.group = new THREE.Group();
    this.createModel();
  }

  createModel() {
    // Main body
    const bodyGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.4,
      metalness: 0.7,
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.group.add(bodyMesh);

    // Cockpit
    const cockpitGeometry = new THREE.SphereGeometry(
      0.2,
      16,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.7,
      roughness: 0.2,
      metalness: 0.8,
    });
    const cockpitMesh = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpitMesh.position.set(0, 0.1, -0.2);
    cockpitMesh.rotation.x = Math.PI;
    this.group.add(cockpitMesh);

    // Nose
    const noseGeometry = new THREE.ConeGeometry(0.25, 0.5, 16);
    const noseMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc0000,
      roughness: 0.3,
      metalness: 0.5,
    });
    const noseMesh = new THREE.Mesh(noseGeometry, noseMaterial);
    noseMesh.position.z = -0.7;
    noseMesh.rotation.x = Math.PI / 2;
    this.group.add(noseMesh);

    // Wings
    const wingGeometry = new THREE.BoxGeometry(1.2, 0.05, 0.4);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.4,
      metalness: 0.6,
    });
    const wingMesh = new THREE.Mesh(wingGeometry, wingMaterial);
    wingMesh.position.z = 0.2;
    this.group.add(wingMesh);

    // Engine glow
    const engineGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.1, 16);
    const engineMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
    });
    const engineMesh = new THREE.Mesh(engineGeometry, engineMaterial);
    engineMesh.position.z = 0.45;
    engineMesh.rotation.x = Math.PI / 2;
    this.group.add(engineMesh);

    // Side thrusters
    const thrusterGeometry = new THREE.CylinderGeometry(0.05, 0.07, 0.1, 8);
    const thrusterMaterial = new THREE.MeshBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.6,
    });

    const leftThruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
    leftThruster.position.set(-0.3, 0, 0.3);
    leftThruster.rotation.x = Math.PI / 2;
    this.group.add(leftThruster);

    const rightThruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
    rightThruster.position.set(0.3, 0, 0.3);
    rightThruster.rotation.x = Math.PI / 2;
    this.group.add(rightThruster);
  }

  // Position the spaceship relative to the camera
  attachToCamera(camera) {
    this.group.position.set(0, -0.2, -1.5);
    camera.add(this.group);
  }
}

export default Spaceship;
