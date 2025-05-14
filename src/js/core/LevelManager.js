// Level Manager for creating and managing the tunnel environment
import * as THREE from 'three';
import createLevel1 from './levels/Level1.js';
import createLevel2 from './levels/Level2.js';
import createLevel3 from './levels/Level3.js';
import createExampleLevel from './levels/ExampleLevel.js';
import { SegmentType, ObstaclePattern } from './levels/SegmentTypes.js';

class LevelManager {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.levelSegments = [];
    this.segmentLength = 20; // Length of each tunnel segment
    this.tunnelWidth = 15;
    this.tunnelHeight = 12;
    this.segmentCount = 15; // How many segments to keep active at once

    // Textures and materials
    this.wallTexture = null;
    this.floorTexture = null;
    this.wallMaterial = null;
    this.floorMaterial = null;

    // Obstacles
    this.obstacles = []; // Level system properties
    this.levels = [createLevel1(), createLevel2(), createLevel3(), createExampleLevel()];
    this.currentLevelIndex = 0;
    this.currentLevel = null;
    this.segmentIndex = 0;
    this.isEndless = true; // Default to endless mode
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
  // Load a specific level by index
  loadLevel(levelIndex) {
    // Clear existing level
    this.clearLevel();

    // Set current level
    this.currentLevelIndex = levelIndex;
    this.currentLevel = this.levels[levelIndex];
    this.segmentIndex = 0;

    // Set endless mode flag based on level properties
    this.isEndless = this.currentLevel.endless || false;

    // Initialize the new level
    this.initLevel();

    // Reset enemy tracking for the new level (if we have an enemyManager reference)
    if (this.enemyManager && this.enemyManager.resetLevel) {
      this.enemyManager.resetLevel();
    }

    return this.currentLevel;
  }

  clearLevel() {
    // Remove all segments and obstacles
    for (const segment of this.levelSegments) {
      this.scene.remove(segment);
    }
    this.levelSegments = [];
    this.obstacles = [];
  }

  // Override the existing initLevel method
  initLevel() {
    if (this.isEndless) {
      // Use the old endless tunnel generation
      this.initEndlessLevel();
    } else {
      // Use the blueprint-based level generation
      this.initBlueprintLevel();
    }
  }

  initEndlessLevel() {
    // Original endless tunnel code
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

  initBlueprintLevel() {
    if (!this.currentLevel) {
      this.currentLevel = this.levels[0];
    }

    const initialPosition = new THREE.Vector3(0, 0, 0);
    const blueprint = this.currentLevel;

    // Create the initial segments based on the blueprint
    const segmentsToCreate = Math.min(
      this.segmentCount,
      blueprint.segments.length
    );

    for (let i = 0; i < segmentsToCreate; i++) {
      const segDef = blueprint.segments[i % blueprint.segments.length];
      const position = new THREE.Vector3(
        initialPosition.x,
        initialPosition.y,
        initialPosition.z - i * this.segmentLength
      );

      this.createBlueprintSegment(position, segDef, i);
      this.segmentIndex = i + 1;
    }
  }

  // Create a segment based on a blueprint definition
  createBlueprintSegment(position, segmentDef, index) {
    const segment = new THREE.Group();
    segment.position.copy(position);

    // Create the basic tunnel structure (walls, floor, ceiling)
    this.createBaseTunnelStructure(segment, segmentDef);

    // Add lights with the specified color
    const lightColor = segmentDef.lightColor || 0x4466aa;
    this.addLightsToSegment(segment, lightColor);

    // Add obstacles based on the pattern
    if (segmentDef.obstacles !== ObstaclePattern.NONE) {
      if (segmentDef.obstacles === ObstaclePattern.CUSTOM) {
        this.addCustomObstacles(segment, segmentDef.customObstacles);
      } else {
        this.addObstaclePattern(segment, segmentDef.obstacles);
      }
    }

    this.scene.add(segment);
    this.levelSegments.push(segment);

    return segment;
  }

  // Create the basic tunnel structure
  createBaseTunnelStructure(segment, segmentDef) {
    // Adjust tunnel width/height based on segment type
    let width = this.tunnelWidth;
    let height = this.tunnelHeight;

    if (segmentDef.type === SegmentType.NARROW_PATH) {
      width = this.tunnelWidth * 0.7;
    } else if (segmentDef.type === SegmentType.BOSS_ROOM) {
      width = this.tunnelWidth * 1.5;
      height = this.tunnelHeight * 1.5;
    }

    // Create walls, floor and ceiling
    const planeGeometry = new THREE.PlaneGeometry(width, height);

    // Floor
    const floor = new THREE.Mesh(planeGeometry, this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -height / 2;
    floor.position.z = -this.segmentLength / 2;
    segment.add(floor);

    // Ceiling
    const ceiling = new THREE.Mesh(planeGeometry, this.wallMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height / 2;
    ceiling.position.z = -this.segmentLength / 2;
    segment.add(ceiling);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.segmentLength, height),
      this.wallMaterial
    );
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -width / 2;
    leftWall.position.z = -this.segmentLength;
    segment.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(this.segmentLength, height),
      this.wallMaterial
    );
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.x = width / 2;
    rightWall.position.z = -this.segmentLength;
    segment.add(rightWall);

    // End wall for non-straight segments or end segments
    if (
      segmentDef.type !== SegmentType.STRAIGHT ||
      segmentDef.type === SegmentType.END
    ) {
      const endWall = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        this.wallMaterial
      );
      endWall.rotation.y = Math.PI;
      endWall.position.z = -this.segmentLength;
      segment.add(endWall);
    }

    // Apply curvature for curved segments
    if (
      segmentDef.type === SegmentType.CURVE_LEFT ||
      segmentDef.type === SegmentType.CURVE_RIGHT
    ) {
      // Apply a curve transformation to the segment
      const direction = segmentDef.type === SegmentType.CURVE_LEFT ? 1 : -1;
      this.applyCurveToSegment(segment, direction);
    }
  }

  // Apply curve transformation to a segment
  applyCurveToSegment(segment, direction) {
    // This is a simplified version - a proper implementation would
    // bend the geometry according to a curve
    segment.rotation.y = direction * (Math.PI / 8); // Slight rotation
  }

  // Add custom obstacle pattern
  addObstaclePattern(segment, pattern) {
    switch (pattern) {
      case ObstaclePattern.RANDOM:
        this.addObstacles(segment); // Use existing random obstacle code
        break;
      case ObstaclePattern.CENTER_BLOCK:
        this.addCenterObstacle(segment);
        break;
      case ObstaclePattern.SIDE_BLOCKS:
        this.addSideObstacles(segment);
        break;
      case ObstaclePattern.NARROW_PATH:
        this.addNarrowPathObstacles(segment);
        break;
    }
  }

  // Add center obstacle
  addCenterObstacle(segment) {
    const size = 1.5 + Math.random() * 1.0;
    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({
      color: 0x775533,
      roughness: 0.9,
      metalness: 0.1,
    });
    const obstacle = new THREE.Mesh(geometry, material);

    // Position in center of tunnel
    const z = -Math.random() * (this.segmentLength - 5) - 5;
    obstacle.position.set(0, 0, z);

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

  // Add side obstacles
  addSideObstacles(segment) {
    const sideOffset = this.tunnelWidth / 2 - 1.5;

    // Left obstacle
    const leftGeometry = new THREE.CylinderGeometry(0.8, 0.8, 6, 8);
    const leftMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.6,
      metalness: 0.8,
    });
    const leftObstacle = new THREE.Mesh(leftGeometry, leftMaterial);
    leftObstacle.rotation.x = Math.PI / 2;

    const leftZ = -Math.random() * (this.segmentLength - 10) - 5;
    leftObstacle.position.set(-sideOffset, 0, leftZ);

    // Add collider data
    leftObstacle.userData.isObstacle = true;
    leftObstacle.userData.boundingBox = new THREE.Box3().setFromObject(
      leftObstacle
    );

    // Add to segment and track obstacle
    segment.add(leftObstacle);
    this.obstacles.push({
      mesh: leftObstacle,
      segment: segment,
    });

    // Right obstacle
    const rightGeometry = new THREE.CylinderGeometry(0.8, 0.8, 6, 8);
    const rightMaterial = new THREE.MeshStandardMaterial({
      color: 0x555555,
      roughness: 0.6,
      metalness: 0.8,
    });
    const rightObstacle = new THREE.Mesh(rightGeometry, rightMaterial);
    rightObstacle.rotation.x = Math.PI / 2;

    const rightZ = -Math.random() * (this.segmentLength - 10) - 5;
    rightObstacle.position.set(sideOffset, 0, rightZ);

    // Add collider data
    rightObstacle.userData.isObstacle = true;
    rightObstacle.userData.boundingBox = new THREE.Box3().setFromObject(
      rightObstacle
    );

    // Add to segment and track obstacle
    segment.add(rightObstacle);
    this.obstacles.push({
      mesh: rightObstacle,
      segment: segment,
    });
  }

  // Add narrow path obstacles (obstacles on both sides creating a narrow path)
  addNarrowPathObstacles(segment) {
    const numObstacles = 3;
    const zSpacing = this.segmentLength / (numObstacles + 1);

    for (let i = 0; i < numObstacles; i++) {
      const z = -zSpacing * (i + 1);
      const leftX = -this.tunnelWidth / 2 + 2 + Math.random() * 1;
      const rightX = this.tunnelWidth / 2 - 2 - Math.random() * 1;

      // Create obstacles
      const size = 1.0 + Math.random() * 0.5;

      // Left obstacle
      const leftGeometry = new THREE.DodecahedronGeometry(size, 0);
      const leftMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.2,
      });
      const leftObstacle = new THREE.Mesh(leftGeometry, leftMaterial);
      leftObstacle.position.set(leftX, 0, z);

      // Add collider data
      leftObstacle.userData.isObstacle = true;
      leftObstacle.userData.boundingBox = new THREE.Box3().setFromObject(
        leftObstacle
      );

      // Add to segment and track obstacle
      segment.add(leftObstacle);
      this.obstacles.push({
        mesh: leftObstacle,
        segment: segment,
      });

      // Right obstacle
      const rightGeometry = new THREE.DodecahedronGeometry(size, 0);
      const rightMaterial = new THREE.MeshStandardMaterial({
        color: 0x888888,
        roughness: 0.8,
        metalness: 0.2,
      });
      const rightObstacle = new THREE.Mesh(rightGeometry, rightMaterial);
      rightObstacle.position.set(rightX, 0, z);

      // Add collider data
      rightObstacle.userData.isObstacle = true;
      rightObstacle.userData.boundingBox = new THREE.Box3().setFromObject(
        rightObstacle
      );

      // Add to segment and track obstacle
      segment.add(rightObstacle);
      this.obstacles.push({
        mesh: rightObstacle,
        segment: segment,
      });
    }
  }

  // Add custom obstacles at specific positions
  addCustomObstacles(segment, customObstacles) {
    if (!customObstacles) return;

    for (const obsDef of customObstacles) {
      const obstacle = this.createObstacleByType(obsDef.type);
      const worldPosition = obsDef.position.clone();
      const localPosition = worldPosition.sub(segment.position);
      obstacle.position.copy(localPosition);

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

  // Create an obstacle of a specific type
  createObstacleByType(type) {
    switch (type) {
      case 'rock':
        return this.createRockObstacle();
      case 'pipe':
        return this.createPipeObstacle();
      case 'crate':
        return this.createCrateObstacle();
      default:
        return this.createRockObstacle();
    }
  }

  // Helper methods to create different obstacle types
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

    // Random rotation
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

    // Random rotation
    obstacle.rotation.y = Math.random() * Math.PI;

    return obstacle;
  }

  // Create special end segment
  createEndSegment() {
    const position = new THREE.Vector3(
      this.levelSegments[this.levelSegments.length - 1].position.x,
      this.levelSegments[this.levelSegments.length - 1].position.y,
      this.levelSegments[this.levelSegments.length - 1].position.z -
        this.segmentLength
    );

    const segment = new THREE.Group();
    segment.position.copy(position);

    // Create a larger area for the end segment
    const width = this.tunnelWidth * 1.5;
    const height = this.tunnelHeight * 1.5;
    const length = this.segmentLength * 1.5;

    // Create floor, ceiling, walls
    const floorGeometry = new THREE.PlaneGeometry(width, length);
    const floor = new THREE.Mesh(floorGeometry, this.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -height / 2;
    floor.position.z = -length / 2;
    segment.add(floor);

    const ceilingGeometry = new THREE.PlaneGeometry(width, length);
    const ceiling = new THREE.Mesh(ceilingGeometry, this.wallMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = height / 2;
    ceiling.position.z = -length / 2;
    segment.add(ceiling);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(length, height),
      this.wallMaterial
    );
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.x = -width / 2;
    leftWall.position.z = -length / 2;
    segment.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(length, height),
      this.wallMaterial
    );
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.x = width / 2;
    rightWall.position.z = -length / 2;
    segment.add(rightWall);

    // End wall with portal/exit
    const endWall = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      this.wallMaterial
    );
    endWall.rotation.y = Math.PI;
    endWall.position.z = -length;
    segment.add(endWall);

    // Add a special exit portal
    const portalGeometry = new THREE.TorusGeometry(3, 0.5, 16, 32);
    const portalMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffaa,
      emissive: 0x00ffaa,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.8,
    });
    const portal = new THREE.Mesh(portalGeometry, portalMaterial);
    portal.position.z = -length + 0.1;
    segment.add(portal);

    // Add special lighting for the end segment
    const pointLight = new THREE.PointLight(0x00ffaa, 1, 20, 2);
    pointLight.position.set(0, 0, -length + 2);
    segment.add(pointLight);

    this.scene.add(segment);
    this.levelSegments.push(segment);

    return segment;
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

      if (!this.isEndless && this.currentLevel) {
        // Blueprint-based level generation
        if (this.segmentIndex < this.currentLevel.segments.length) {
          // Get the next segment from the blueprint
          const segDef = this.currentLevel.segments[this.segmentIndex];
          const lastSegment = this.levelSegments[this.levelSegments.length - 1];

          const newPosition = new THREE.Vector3(
            lastSegment.position.x,
            lastSegment.position.y,
            lastSegment.position.z - this.segmentLength
          );

          this.createBlueprintSegment(newPosition, segDef, this.segmentIndex);
          this.segmentIndex++;
        } else if (this.currentLevel.endSegment) {
          // We've reached the end of the level blueprints
          this.createEndSegment();
        } else {
          // Loop back to the beginning of the level
          this.segmentIndex = 0;
        }
      } else {
        // Original endless mode
        const lastSegment = this.levelSegments[this.levelSegments.length - 1];
        const newPosition = new THREE.Vector3(
          lastSegment.position.x,
          lastSegment.position.y,
          lastSegment.position.z - this.segmentLength
        );

        this.createTunnelSegment(newPosition);
      }
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
