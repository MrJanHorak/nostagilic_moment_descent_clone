// ObstacleFactory.js
// Handles creation and configuration of obstacles for tunnel segments
import * as THREE from 'three';

class ObstacleFactory {
  constructor() {}

  createRockObstacle() {
    const size = 0.5 + Math.random() * 1.0;
    const geometry = new THREE.DodecahedronGeometry(size, 0);
    const material = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.8,
      metalness: 0.2,
    });
    return new THREE.Mesh(geometry, material);
  }

  createPipeObstacle() {
    const height = 0.5 + Math.random() * 2.0;
    const radius = 0.2 + Math.random() * 0.3;
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.6,
      metalness: 0.8,
    });
    const obstacle = new THREE.Mesh(geometry, material);
    obstacle.rotation.x = Math.random() * Math.PI;
    obstacle.rotation.z = Math.random() * Math.PI;
    return obstacle;
  }

  createCrateObstacle() {
    const size = 0.8 + Math.random() * 0.8;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
      color: 0x775533,
      roughness: 0.9,
      metalness: 0.1,
    });
    const obstacle = new THREE.Mesh(geometry, material);
    obstacle.rotation.y = Math.random() * Math.PI;
    return obstacle;
  }

  // Add more obstacle creation methods as needed
}

export default ObstacleFactory;
