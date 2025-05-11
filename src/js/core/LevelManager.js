// Level Manager for creating and managing the tunnel environment
import * as THREE from 'three';

class LevelManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.levelSegments = [];
    this.segmentLength = 20; // Length of each tunnel segment
    this.tunnelWidth = 10;
    this.tunnelHeight = 8;
    this.segmentCount = 10; // How many segments to keep active at once

    // Textures and materials
    this.wallTexture = null;
    this.floorTexture = null;
    this.wallMaterial = null;
    this.floorMaterial = null;

    // Obstacles
    this.obstacles = [];
  }

  // Initialize textures and materials
  async initMaterials() {
    const textureLoader = new THREE.TextureLoader();

    // Load textures (using promises for async loading)
    const loadTexture = (url) => {
      return new Promise((resolve, reject) => {
        textureLoader.load(
          url,
          (texture) => resolve(texture),
          undefined,
          (err) => reject(err)
        );
      });
    };

    try {
      this.wallTexture = await loadTexture('/textures/wall.jpg');
      this.floorTexture = await loadTexture('/textures/floor.jpg');

      // Configure textures
      this.wallTexture.wrapS = THREE.RepeatWrapping;
      this.wallTexture.wrapT = THREE.RepeatWrapping;
      this.wallTexture.repeat.set(4, 2);

      this.floorTexture.wrapS = THREE.RepeatWrapping;
      this.floorTexture.wrapT = THREE.RepeatWrapping;
      this.floorTexture.repeat.set(4, 8);

      // Create materials
      this.wallMaterial = new THREE.MeshStandardMaterial({
        map: this.wallTexture,
        roughness: 0.7,
        metalness: 0.2,
        color: 0x888888,
      });

      this.floorMaterial = new THREE.MeshStandardMaterial({
        map: this.floorTexture,
        roughness: 0.9,
        metalness: 0.1,
        color: 0x666666,
      });

      return true;
    } catch (error) {
      console.error('Error loading textures:', error);

      // Fallback materials if textures fail to load
      this.wallMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.7,
        metalness: 0.2,
      });

      this.floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.9,
        metalness: 0.1,
      });

      return false;
    }
  }

  // Create a tunnel segment
  createTunnelSegment(position) {
    const segment = new THREE.Group();
    segment.position.copy(position);

    // Create walls, floor and ceiling
    const planeGeometry = new THREE.PlaneGeometry(
      this.tunnelWidth,
      this.tunnelHeight
    );

    // Floor
    const floor = new THREE.Mesh(planeGeometry, this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -this.tunnelHeight / 2;
    floor.position.z = -this.segmentLength / 2;
    segment.add(floor);

    // Ceiling
    const ceiling = new THREE.Mesh(planeGeometry, this.wallMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = this.tunnelHeight / 2;
    ceiling.position.z = -this.segmentLength / 2;
    segment.add(ceiling);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.segmentLength, this.tunnelHeight),
      this.wallMaterial
    );
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -this.tunnelWidth / 2;
    leftWall.position.z = -this.segmentLength;
    segment.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.segmentLength, this.tunnelHeight),
      this.wallMaterial
    );
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.x = this.tunnelWidth / 2;
    rightWall.position.z = -this.segmentLength;
    segment.add(rightWall);

    // End wall
    const endWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.tunnelWidth, this.tunnelHeight),
      this.wallMaterial
    );
    endWall.rotation.y = Math.PI;
    endWall.position.z = -this.segmentLength;
    segment.add(endWall);

    // Add lights to segment
    this.addLightsToSegment(segment);

    // Add some obstacles
    if (Math.random() > 0.3) {
      // 70% chance to add obstacles
      this.addObstacles(segment);
    }

    this.scene.add(segment);
    this.levelSegments.push(segment);

    return segment;
  }

  // Add lights to a tunnel segment
  addLightsToSegment(segment, color = 0x4466aa) {
    const light = new THREE.PointLight(color, 0.6, 10, 2);

    // Random position within the segment
    const x = (Math.random() - 0.5) * 8;
    const y = -3 + Math.random() * 6; // Mostly lower in the tunnel
    const z = -Math.random() * this.segmentLength;

    light.position.set(x, y, z);
    segment.add(light);

    // Add a small glowing sphere to represent the light source
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
    });
    const glowSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 8),
      glowMaterial
    );
    glowSphere.position.copy(light.position);
    segment.add(glowSphere);
  }

  // Add obstacles to a tunnel segment
  addObstacles(segment) {
    // Number of obstacles to add
    const obstacleCount = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < obstacleCount; i++) {
      // Random position within segment bounds
      const x = (Math.random() - 0.5) * (this.tunnelWidth - 2); // Stay away from walls
      const y = (Math.random() - 0.5) * (this.tunnelHeight - 2); // Stay away from floor/ceiling
      const z = -Math.random() * (this.segmentLength - 5) - 5; // Position within segment, away from start

      // Random obstacle type
      const obstacleType = Math.random();
      let obstacle;

      if (obstacleType < 0.4) {
        // Create rock/crystal obstacles
        const size = 0.5 + Math.random() * 1.0;
        const geometry = new THREE.DodecahedronGeometry(size, 0);
        const material = new THREE.MeshStandardMaterial({
          color: 0x888888,
          roughness: 0.8,
          metalness: 0.2,
        });
        obstacle = new THREE.Mesh(geometry, material);
      } else if (obstacleType < 0.7) {
        // Create pipe/mechanical obstacles
        const height = 0.5 + Math.random() * 2.0;
        const radius = 0.2 + Math.random() * 0.3;
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 8);
        const material = new THREE.MeshStandardMaterial({
          color: 0x555555,
          roughness: 0.6,
          metalness: 0.8,
        });
        obstacle = new THREE.Mesh(geometry, material);

        // Random rotation
        obstacle.rotation.x = Math.random() * Math.PI;
        obstacle.rotation.z = Math.random() * Math.PI;
      } else {
        // Create crate/box obstacles
        const size = 0.8 + Math.random() * 0.8;
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({
          color: 0x775533,
          roughness: 0.9,
          metalness: 0.1,
        });
        obstacle = new THREE.Mesh(geometry, material);

        // Random rotation
        obstacle.rotation.y = Math.random() * Math.PI;
      }

      // Position the obstacle
      obstacle.position.set(x, y, z);

      // Add collider data
      obstacle.userData.isObstacle = true;
      obstacle.userData.boundingBox = new THREE.Box3().setFromObject(obstacle);

      // Add to segment and track obstacle
      segment.add(obstacle);
      this.obstacles.push({
        mesh: obstacle,
        segment: segment,
      });
    }
  }

  // Initialize the level with initial segments
  initLevel() {
    // Create initial segments
    const initialPosition = new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < this.segmentCount; i++) {
      const position = new THREE.Vector3(
        initialPosition.x,
        initialPosition.y,
        initialPosition.z - i * this.segmentLength
      );

      this.createTunnelSegment(position);
    }
  }

  // Update level segments based on player position
  updateLevel() {
    if (this.levelSegments.length === 0) return;

    const playerPosition = this.camera.position;
    const firstSegment = this.levelSegments[0];

    // If player has moved past the first segment, remove it and add a new one at the end
    if (playerPosition.z < firstSegment.position.z - this.segmentLength) {
      // Remove the first segment
      this.scene.remove(firstSegment);

      // Clean up any obstacles in the segment
      this.obstacles = this.obstacles.filter(
        (obs) => obs.segment !== firstSegment
      );

      // Remove from array
      this.levelSegments.shift();

      // Create a new segment at the end
      const lastSegment = this.levelSegments[this.levelSegments.length - 1];
      const newPosition = new THREE.Vector3(
        lastSegment.position.x,
        lastSegment.position.y,
        lastSegment.position.z - this.segmentLength
      );

      this.createTunnelSegment(newPosition);
    }
  }

  // Get all active level segments
  getLevelSegments() {
    return this.levelSegments;
  }

  // Get the segment length
  getSegmentLength() {
    return this.segmentLength;
  }
}

export default LevelManager;
