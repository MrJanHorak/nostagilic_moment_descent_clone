import * as THREE from 'three';
import { audioManager } from './audio.js';

// Override updateMatrixWorld to detect recursive calls
THREE.Object3D.prototype.updateMatrixWorld = (function (original) {
  return function () {
    if (this.__isUpdating) {
      console.error('Recursive updateMatrixWorld detected for object:', this);
      console.trace(); // Added console.trace() for more details
      return;
    }
    this.__isUpdating = true;
    original.apply(this, arguments);
    this.__isUpdating = false;
  };
})(THREE.Object3D.prototype.updateMatrixWorld);

// Utility to validate geometries
function validateGeometry(geometry) {
  if (!geometry || !(geometry instanceof THREE.BufferGeometry)) {
    console.error('Invalid geometry detected:', geometry);
    return false;
  }

  // Check if the geometry has valid attributes
  if (!geometry.attributes.position) {
    console.error('Geometry missing position attribute:', geometry);
    return false;
  }

  // Check if the bounding sphere can be computed
  try {
    geometry.computeBoundingSphere();
  } catch (error) {
    console.error(
      'Error computing bounding sphere for geometry:',
      geometry,
      error
    );
    return false;
  }

  return true;
}

// Enhanced circular reference detection with full path tracking
function detectCircularReferences(root) {
  const visited = new WeakMap();
  let hasCircular = false;
  let circularPath = [];

  function traverse(obj, path = []) {
    // Skip non-Object3D objects
    if (!obj || !(obj instanceof THREE.Object3D)) return;

    // Record object info for the current path
    const objInfo = {
      id: obj.id,
      uuid: obj.uuid,
      type: obj.type || obj.constructor.name,
      name: obj.name || '(unnamed)',
    };

    const currentPath = [...path, objInfo];

    if (visited.has(obj)) {
      // We found a circular reference
      hasCircular = true;
      circularPath = currentPath;

      // Find where in the path the object appears again
      const firstIndex = path.findIndex((item) => item.uuid === obj.uuid);
      if (firstIndex !== -1) {
        const cycle = path.slice(firstIndex).concat([objInfo]);
        console.error('CIRCULAR REFERENCE DETECTED!');
        console.error(
          'Cycle:',
          cycle.map((o) => `${o.type}[${o.name}]`).join(' -> ')
        );
      }
      return;
    }

    // Mark as visited
    visited.set(obj, currentPath);

    // Check its children
    if (obj.children && obj.children.length > 0) {
      for (const child of obj.children) {
        // Skip if we already found a circular reference
        if (hasCircular) return;
        traverse(child, currentPath);
      }
    }
  }

  traverse(root);

  if (hasCircular) {
    // Log formatted path information
    console.error('CIRCULAR REFERENCE FOUND! Complete path:');
    console.table(
      circularPath.map((info) => ({
        ID: info.id,
        UUID: info.uuid.substring(0, 8) + '...',
        Type: info.type,
        Name: info.name,
      }))
    );

    return true;
  }
  return false;
}

// Validate scene geometries to identify potential issues
function validateSceneGeometries(scene) {
  const geometryCount = new Map();
  const materialCount = new Map();

  console.log('Validating scene graph integrity...');

  scene.traverse((obj) => {
    // Count instances of each geometry and material
    if (obj.geometry) {
      const geoKey = obj.geometry.uuid;
      geometryCount.set(geoKey, (geometryCount.get(geoKey) || 0) + 1);
    }

    if (obj.material) {
      const materials = Array.isArray(obj.material)
        ? obj.material
        : [obj.material];
      materials.forEach((mat) => {
        if (mat) {
          const matKey = mat.uuid;
          materialCount.set(matKey, (materialCount.get(matKey) || 0) + 1);
        }
      });
    }

    // Check for invalid matrix data
    if (obj.matrix) {
      const elements = obj.matrix.elements;
      const hasNaN = elements.some((e) => isNaN(e));
      const hasInfinity = elements.some((e) => !isFinite(e));

      if (hasNaN || hasInfinity) {
        console.error('Invalid matrix found in object:', obj);
        console.error('Matrix elements:', elements);
      }
    }
  });

  // Report geometry and material instances
  console.log(`Scene contains ${geometryCount.size} unique geometries`);
  console.log(`Scene contains ${materialCount.size} unique materials`);

  // Check for high instance counts (potential memory problems)
  let highInstancesFound = false;
  geometryCount.forEach((count, uuid) => {
    if (count > 100) {
      highInstancesFound = true;
      console.warn(`Geometry used ${count} times (${uuid})`);
    }
  });

  if (!highInstancesFound) {
    console.log('No abnormal geometry usage detected');
  }

  return {
    geometryCount: geometryCount.size,
    materialCount: materialCount.size,
  };
}

// Initialize the clock for animation timing
const clock = new THREE.Clock();

// Scene
const scene = new THREE.Scene();

// Add atmospheric fog to enhance cave feel
scene.fog = new THREE.FogExp2(0x000511, 0.03);
scene.background = new THREE.Color(0x000511); // Dark blue background

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 5;
camera.rotation.order = 'YXZ'; // To avoid gimbal lock issues with rotations

// --- Prevent circular references and scene/camera misuse in scene graph ---
// Place this after scene and camera are created
const originalAdd = THREE.Object3D.prototype.add;
THREE.Object3D.prototype.add = function (...objects) {
  for (const obj of objects) {
    // Prevent adding scene as a child of anything
    if (typeof scene !== 'undefined' && obj === scene) {
      console.error('Attempted to add scene as a child of', this);
      return this;
    }
    // Prevent adding camera as a child of anything except scene
    if (typeof camera !== 'undefined' && obj === camera && this !== scene) {
      console.error(
        'Attempted to add camera as a child of',
        this,
        'which is not the scene'
      );
      return this;
    }
    // Prevent adding an ancestor as a child (circular reference)
    let ancestor = this;
    while (ancestor) {
      if (ancestor === obj) {
        console.error(
          'Attempted to create a circular reference by adding',
          obj,
          'as a child of',
          this
        );
        return this;
      }
      ancestor = ancestor.parent;
    }
  }
  return originalAdd.apply(this, objects);
};

// Renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Pointer Lock for mouse controls
const canvas = renderer.domElement; // Use the renderer's canvas

canvas.addEventListener('click', () => {
  canvas.requestPointerLock();

  // Only shoot if game has started and is in progress
  if (
    gameState.isGameStarted &&
    !gameState.isGameOver &&
    document.pointerLockElement === canvas
  ) {
    fireProjectile();
  }
});

let euler = new THREE.Euler(0, 0, 0, 'YXZ'); // To control camera rotation
const PI_2 = Math.PI / 2; // For clamping pitch

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    console.log('Pointer Lock active');
    document.addEventListener('mousemove', onMouseMove, false);
  } else {
    console.log('Pointer Lock inactive');
    document.removeEventListener('mousemove', onMouseMove, false);
  }
});

document.addEventListener('pointerlockerror', (error) => {
  console.error('Pointer Lock Error: ', error);
});

// Initialize key states tracking
const keyStates = {};

// Add event listeners for keyboard
document.addEventListener('keydown', (event) => {
  keyStates[event.code] = true;
});

document.addEventListener('keyup', (event) => {
  keyStates[event.code] = false;
});

function onMouseMove(event) {
  if (document.pointerLockElement !== canvas) {
    return;
  }

  const movementX =
    event.movementX || event.mozMovementX || event.webkitMovementX || 0;
  const movementY =
    event.movementY || event.mozMovementY || event.webkitMovementY || 0;

  euler.setFromQuaternion(camera.quaternion);

  euler.y -= movementX * 0.002; // Yaw
  euler.x -= movementY * 0.002; // Pitch

  euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x)); // Clamp pitch

  camera.quaternion.setFromEuler(euler);
}

// Spaceship Model
const spaceship = new THREE.Group();

// Main body
const bodyGeometry = new THREE.BoxGeometry(0.5, 0.2, 0.8);
const bodyMaterial = new THREE.MeshStandardMaterial({
  color: 0x444444,
  roughness: 0.4,
  metalness: 0.7,
});
const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
spaceship.add(bodyMesh);

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
spaceship.add(cockpitMesh);

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
spaceship.add(noseMesh);

// Wings
const wingGeometry = new THREE.BoxGeometry(1.2, 0.05, 0.4);
const wingMaterial = new THREE.MeshStandardMaterial({
  color: 0x333333,
  roughness: 0.4,
  metalness: 0.6,
});
const wingMesh = new THREE.Mesh(wingGeometry, wingMaterial);
wingMesh.position.z = 0.2;
spaceship.add(wingMesh);

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
spaceship.add(engineMesh);

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
spaceship.add(leftThruster);

const rightThruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
rightThruster.position.set(0.3, 0, 0.3);
rightThruster.rotation.x = Math.PI / 2;
spaceship.add(rightThruster);

// Position the spaceship slightly in front of the camera and a bit lower
spaceship.position.set(0, -0.2, -1.5);
camera.add(spaceship); // Add spaceship as a child of the camera
scene.add(camera); // Make sure camera (and its children) are in the scene

// Lighting
const ambientLight = new THREE.AmbientLight(0x333333, 0.3); // Dimmer ambient light for cave feel
scene.add(ambientLight);

// Main directional light (softer)
const directionalLight = new THREE.DirectionalLight(0xcccccc, 0.5);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Add spotlight attached to player for flashlight effect
const spotlight = new THREE.SpotLight(0xffffff, 2.0, 30, Math.PI / 5, 0.5, 1);
spotlight.position.set(0, 0, 0); // Will be updated to follow camera
camera.add(spotlight);
spotlight.target.position.set(0, 0, -1);
camera.add(spotlight.target);

// Add a secondary wider light for better tunnel visibility
const wideLight = new THREE.SpotLight(0xaaccff, 1.0, 20, Math.PI / 3, 0.8, 1);
wideLight.position.set(0, 0, 0);
camera.add(wideLight);
wideLight.target.position.set(0, 0, -1);
camera.add(wideLight.target);

// Add some point lights throughout the tunnel for atmosphere
function addLightsToSegment(segment, color = 0x4466aa) {
  const light = new THREE.PointLight(color, 0.6, 10, 2);

  // Random position within the segment
  const x = (Math.random() - 0.5) * 8;
  const y = -3 + Math.random() * 6; // Mostly lower in the tunnel
  const z = -Math.random() * segmentLength;

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
// Game state
const gameState = {
  playerHealth: 100,
  maxPlayerHealth: 100,
  score: 0,
  isGameOver: false,
  isGameStarted: false, // Add this flag to track if game has started
  speedMultiplier: 1.0,
  weaponPower: 1,
};

// Audio state
let engineSound = null;
let thrusterSound = null;

// Animation tracking
const activeAnimations = [];

// Camera shake effect for damage feedback
function shakeCamera(intensity = 0.5) {
  const originalPosition = camera.position.clone();
  const shakeDuration = 0.5; // seconds
  let elapsed = 0;

  function shakeAnimation(delta) {
    elapsed += delta;
    const progress = elapsed / shakeDuration;

    if (progress >= 1) {
      // Restore original position
      camera.position.copy(originalPosition);
      return true; // Animation complete
    }

    // Decrease intensity over time
    const currentIntensity = intensity * (1 - progress);

    // Apply random offset
    const offsetX = (Math.random() - 0.5) * currentIntensity;
    const offsetY = (Math.random() - 0.5) * currentIntensity;
    const offsetZ = (Math.random() - 0.5) * currentIntensity * 0.5; // Less Z shake

    camera.position.set(
      originalPosition.x + offsetX,
      originalPosition.y + offsetY,
      originalPosition.z + offsetZ
    );

    return false; // Animation not yet complete
  }

  // Add to active animations
  activeAnimations.push(shakeAnimation);
}

// Create cave dust particle system
function createCaveParticles() {
  const particleCount = 1000;
  const particles = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  // Range for particles
  const spread = 30;
  const centerOffset = 10; // How far to distribute ahead of player

  // Fill arrays with random positions and colors
  for (let i = 0; i < particleCount * 3; i += 3) {
    // Position particles in a cylindrical distribution ahead of player
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 5;

    positions[i] = Math.cos(angle) * radius; // x
    positions[i + 1] = Math.sin(angle) * radius; // y
    positions[i + 2] = -Math.random() * spread - centerOffset; // z (ahead of player)

    // Slight blue/white color variation
    const brightness = 0.2 + Math.random() * 0.3;
    colors[i] = brightness * 0.5; // R
    colors[i + 1] = brightness * 0.7; // G
    colors[i + 2] = brightness; // B (brightest)
  }

  particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Material that will catch the lights
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.05,
    transparent: true,
    opacity: 0.6,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const particleSystem = new THREE.Points(particles, particleMaterial);
  scene.add(particleSystem);
  // Immediately check for circular references after adding particles
  if (detectCircularReferences(scene)) {
    throw new Error('Circular reference detected after adding cave particles!');
  }

  return particleSystem;
}

// Update dust particle positions relative to player
function updateCaveParticles(particleSystem, delta) {
  const positions = particleSystem.geometry.attributes.position.array;
  const particleCount = positions.length / 3;
  const spread = 30;
  const centerOffset = 10;

  for (let i = 0; i < particleCount * 3; i += 3) {
    // Move particles slowly toward player
    positions[i + 2] += (0.5 + Math.random() * 0.5) * delta;

    // If particle is behind player, reset it ahead
    if (positions[i + 2] > 5) {
      positions[i + 2] = -Math.random() * spread - centerOffset;

      // Also randomize X and Y when resetting
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 5;
      positions[i] = Math.cos(angle) * radius;
      positions[i + 1] = Math.sin(angle) * radius;
    }
  }

  particleSystem.geometry.attributes.position.needsUpdate = true;
}

const caveParticles = createCaveParticles();

// Movement and controls constants
const moveSpeed = 0.15; // Units per frame
const rotationSpeed = 0.05; // Radians per frame

// Projectiles
const projectiles = [];
const projectileGeometry = new THREE.SphereGeometry(0.05, 8, 8); // Small sphere
const projectileMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const projectileSpeed = 5; // Units per second (adjust as needed)

// Enhanced projectile with trail
function createProjectileWithTrail(
  position,
  quaternion,
  color = 0x00ff00,
  power = 1
) {
  // Main projectile
  const projectileMaterial = new THREE.MeshBasicMaterial({
    color: color,
    emissive: color,
    emissiveIntensity: 0.5,
  });

  const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
  projectile.position.copy(position);
  projectile.quaternion.copy(quaternion);

  const velocity = new THREE.Vector3(0, 0, -projectileSpeed);
  velocity.applyQuaternion(quaternion);

  // Trail effect - create small points that follow the projectile's path
  const trailLength = 5;
  const trailGeometry = new THREE.BufferGeometry();
  const trailMaterial = new THREE.PointsMaterial({
    color: color,
    size: 0.03,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.8,
  });

  const trailPositions = new Float32Array(trailLength * 3);
  trailGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(trailPositions, 3)
  );

  const trail = new THREE.Points(trailGeometry, trailMaterial);
  scene.add(trail);

  // Projectile data
  const projectileData = {
    mesh: projectile,
    velocity: velocity,
    power: power,
    trail: trail,
    trailPositions: trailPositions,
    trailIndex: 0,
    lastTrailUpdate: 0,
  };

  projectiles.push(projectileData);
  scene.add(projectile);

  // Remove after some time
  setTimeout(() => {
    if (projectiles.indexOf(projectileData) !== -1) {
      scene.remove(projectile);
      scene.remove(trail);
      projectile.geometry.dispose();
      projectile.material.dispose();
      trail.geometry.dispose();
      trail.material.dispose();
      const index = projectiles.indexOf(projectileData);
      if (index > -1) {
        projectiles.splice(index, 1);
      }
    }
  }, 3000);

  return projectileData;
}

// Enhanced fire projectile function with weapon power and projectile trails
function fireProjectile() {
  if (
    document.pointerLockElement !== canvas ||
    gameState.isGameOver ||
    !gameState.isGameStarted
  )
    return;

  // Use weapon power from gameState
  const weaponPower = gameState.weaponPower || 1;

  // Default green projectile
  let projectileColor = 0x00ff00;

  // If weapon is upgraded, use a different color
  if (weaponPower > 1) {
    projectileColor = 0x00ffdd; // Brighter color for upgraded weapon
  }

  // Play weapon sound - different sound for upgraded weapons
  if (audioManager.initialized) {
    if (weaponPower > 1) {
      audioManager.playSound('shoot', { volume: 0.4, pitch: 1.2 });
    } else {
      audioManager.playSound('shoot', { volume: 0.3 });
    }
  }

  // Get world position and quaternion of the camera (spaceship's viewpoint)
  const startPosition = new THREE.Vector3();
  const startQuaternion = new THREE.Quaternion();
  camera.getWorldPosition(startPosition);
  camera.getWorldQuaternion(startQuaternion);

  // Offset slightly forward from the camera to avoid immediate collision with spaceship model
  const offset = new THREE.Vector3(0, 0, -2); // Adjust Z offset as needed
  offset.applyQuaternion(startQuaternion);
  startPosition.add(offset);

  createProjectileWithTrail(
    startPosition,
    startQuaternion,
    projectileColor,
    weaponPower
  );
}

// Update projectiles function for trails
function updateProjectiles(delta) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];

    // Update position
    projectile.mesh.position.addScaledVector(projectile.velocity, delta);

    // Update trail positions
    const currentTime = performance.now();
    if (currentTime - projectile.lastTrailUpdate > 50) {
      // Update trail every 50ms
      projectile.lastTrailUpdate = currentTime;

      // Update trail positions - shift positions back
      for (let j = projectile.trailPositions.length - 3; j >= 3; j -= 3) {
        projectile.trailPositions[j] = projectile.trailPositions[j - 3];
        projectile.trailPositions[j + 1] = projectile.trailPositions[j - 2];
        projectile.trailPositions[j + 2] = projectile.trailPositions[j - 1];
      }

      // Set the first position to the current projectile position
      projectile.trailPositions[0] = projectile.mesh.position.x;
      projectile.trailPositions[1] = projectile.mesh.position.y;
      projectile.trailPositions[2] = projectile.mesh.position.z;

      // Update buffer attribute
      projectile.trail.geometry.attributes.position.needsUpdate = true;
    }
  }
}

// Start screen
const startScreen = document.createElement('div');
startScreen.style.position = 'absolute';
startScreen.style.top = '0';
startScreen.style.left = '0';
startScreen.style.width = '100%';
startScreen.style.height = '100%';
startScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
startScreen.style.display = 'flex';
startScreen.style.flexDirection = 'column';
startScreen.style.justifyContent = 'center';
startScreen.style.alignItems = 'center';
startScreen.style.zIndex = '1000';
startScreen.innerHTML = `
  <h1 style="color: #fff; font-size: 48px; margin-bottom: 20px;">DESCENT</h1>
  <h2 style="color: #fff; font-size: 24px; margin-bottom: 40px;">Zero Gravity Shooter</h2>
  <div style="color: #fff; font-size: 18px; margin-bottom: 30px;">
    <p>Controls:</p>
    <p>WASD - Movement</p>
    <p>Mouse - Look around</p>
    <p>Left Click - Shoot</p>
    <p>Q/E - Roll left/right</p>
    <p>Space - Move up</p>
    <p>Shift/Ctrl - Move down</p>
  </div>
  <div id="start-game-btn" style="
    font-size: 24px;
    cursor: pointer;
    background-color: #00ff00; 
    color: #000;
    padding: 10px 30px;
    border-radius: 5px;
  ">START GAME</div>
`;
document.body.appendChild(startScreen);

document.getElementById('start-game-btn').addEventListener('click', () => {
  if (audioManager.initialized) {
    audioManager.playSound('menuSelect', { volume: 0.5 });
  } else {
    // Initialize audio on first interaction
    audioManager.init();
  }
  startGame();
});

function startGame() {
  gameState.isGameStarted = true;
  startScreen.style.display = 'none';

  // Initialize audio on first interaction
  audioManager.init();

  // Load sounds if not already loaded
  initSounds().then(() => {
    // Play background music
    audioManager.playSound('backgroundMusic', {
      isMusic: true,
      loop: true,
      volume: 0.4,
    });

    // Play engine hum sound
    engineSound = audioManager.playSound('engine', {
      loop: true,
      volume: 0.2,
    });
  });

  initGame(); // Assuming this sets up the scene

  // Perform checks after scene is expected to be initialized
  console.log('Running scene diagnostics in startGame...');
  detectCircularReferences(scene);
  validateSceneGeometries(scene);
  console.log('Scene diagnostics complete.');

  // Request pointer lock to start the game
  canvas.requestPointerLock();

  // animate(); // Assuming animate is called to start the loop, ensure this is present if needed
}

function gameOver() {
  if (gameState.isGameOver) return;

  gameState.isGameOver = true;
  updateHUD();

  // Sound effects for game over
  if (audioManager.initialized) {
    // Stop engine sound
    if (engineSound) {
      engineSound.fadeOut(1.0);
    }

    // Stop background music with fade out
    if (audioManager.music) {
      audioManager.music.fadeOut(2.0);
    }

    // Play game over sound
    audioManager.playSound('gameOver', { volume: 0.6 });
  }

  // Release pointer lock
  if (document.pointerLockElement === canvas) {
    document.exitPointerLock();
  }
}

// Enemies
const enemies = [];
const enemyTypes = [
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
];

// Create enemy mesh
function createEnemyMesh(enemyType) {
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
    // Scout - faster but smaller enemy with sharp angles

    // Core body - triangular prism shape
    const bodyGeometry = new THREE.CylinderGeometry(
      0,
      enemyType.size,
      enemyType.size * 1.5,
      3
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: enemyType.color,
      roughness: 0.6,
      metalness: 0.4,
      emissive: enemyType.color,
      emissiveIntensity: 0.4,
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.name = 'scout_body';
    bodyMesh.rotation.x = Math.PI / 2; // Rotate to point forward
    body.add(bodyMesh);

    // Glowing eyes/sensors
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const eyeGeometry = new THREE.SphereGeometry(enemyType.size * 0.1, 8, 8);

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.name = 'scout_eye_left';
    leftEye.position.set(-enemyType.size * 0.2, 0, -enemyType.size * 0.5);
    body.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.name = 'scout_eye_right';
    rightEye.position.set(enemyType.size * 0.2, 0, -enemyType.size * 0.5);
    body.add(rightEye);

    // Small wings
    const wingGeometry = new THREE.BoxGeometry(
      enemyType.size * 1.5,
      enemyType.size * 0.1,
      enemyType.size * 0.5
    );
    const wingMesh = new THREE.Mesh(wingGeometry, bodyMaterial);
    wingMesh.name = 'scout_wings';
    wingMesh.position.set(0, 0, 0);
    body.add(wingMesh);
  } else {
    // Fighter - larger, more powerful enemy with complex shape

    // Main body - hexagonal prism
    const bodyGeometry = new THREE.CylinderGeometry(
      enemyType.size * 0.6,
      enemyType.size * 0.8,
      enemyType.size * 1.8,
      6
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: enemyType.color,
      roughness: 0.3,
      metalness: 0.7,
      emissive: enemyType.color,
      emissiveIntensity: 0.3,
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.name = 'fighter_body';
    bodyMesh.rotation.x = Math.PI / 2; // Rotate to point forward
    body.add(bodyMesh);

    // Front weapon
    const weaponGeometry = new THREE.ConeGeometry(
      enemyType.size * 0.3,
      enemyType.size * 0.7,
      8
    );
    const weaponMaterial = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.2,
      metalness: 0.9,
    });
    const weaponMesh = new THREE.Mesh(weaponGeometry, weaponMaterial);
    weaponMesh.name = 'fighter_weapon';
    weaponMesh.position.set(0, 0, -enemyType.size * 1);
    weaponMesh.rotation.x = -Math.PI / 2;
    body.add(weaponMesh);

    // Engine glow
    const engineGeometry = new THREE.SphereGeometry(
      enemyType.size * 0.3,
      16,
      16
    );
    const engineMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.8,
    });
    const engineMesh = new THREE.Mesh(engineGeometry, engineMaterial);
    engineMesh.name = 'fighter_engine';
    engineMesh.position.set(0, 0, enemyType.size * 0.8);
    body.add(engineMesh);

    // Wings
    const wingGeometry = new THREE.BoxGeometry(
      enemyType.size * 2.2,
      enemyType.size * 0.2,
      enemyType.size * 0.7
    );
    const wingMesh = new THREE.Mesh(wingGeometry, bodyMaterial);
    wingMesh.name = 'fighter_wings';
    wingMesh.position.set(0, 0, enemyType.size * 0.2);
    body.add(wingMesh);

    // Small antennas
    const antennaGeometry = new THREE.CylinderGeometry(
      0.02,
      0.02,
      enemyType.size * 0.6
    );
    const antennaMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });

    const leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    leftAntenna.name = 'fighter_antenna_left';
    leftAntenna.position.set(
      -enemyType.size * 0.3,
      enemyType.size * 0.3,
      -enemyType.size * 0.7
    );
    leftAntenna.rotation.z = Math.PI / 6;
    body.add(leftAntenna);

    const rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    rightAntenna.name = 'fighter_antenna_right';
    rightAntenna.position.set(
      enemyType.size * 0.3,
      enemyType.size * 0.3,
      -enemyType.size * 0.7
    );
    rightAntenna.rotation.z = -Math.PI / 6;
    body.add(rightAntenna);
  }

  // Debug check for circular references within the enemy mesh itself
  if (detectCircularReferences(body)) {
    console.error(
      'Circular reference detected within newly created enemy mesh!'
    );
    throw new Error('Enemy mesh has internal circular reference');
  }

  return body;
}

// Spawn enemy at a position
function spawnEnemy(position, typeName = null) {
  // If no specific type requested, choose randomly
  const enemyType = typeName
    ? enemyTypes.find((t) => t.name === typeName)
    : enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

  const enemyMesh = createEnemyMesh(enemyType);
  enemyMesh.position.copy(position);

  // Look at player initially
  const lookAtPosition = camera.position.clone();
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

  enemies.push(enemy);
  scene.add(enemyMesh);
  // Immediately check for circular references after adding an enemy
  if (detectCircularReferences(scene)) {
    throw new Error('Circular reference detected after adding enemy!');
  }

  return enemy;
}

// Spawn enemies in the tunnel segments
function spawnEnemiesInTunnel() {
  // Only consider segments beyond the first one to avoid enemies too close to player start
  const validSegments = levelSegments.slice(1);

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
    new THREE.MeshBasicMaterial({ color: 0xff00ff })
  );
  debugSpawn.position.copy(spawnPosition);
  scene.add(debugSpawn);
  // Immediately check for circular references after adding debug marker
  if (detectCircularReferences(scene)) {
    throw new Error('Circular reference detected after adding debug marker!');
  }

  // Remove debug marker after 5 seconds
  setTimeout(() => {
    scene.remove(debugSpawn);
    debugSpawn.geometry.dispose();
    debugSpawn.material.dispose();
  }, 5000);

  const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
  const enemy = spawnEnemy(spawnPosition, enemyType.name);

  // Add emissive glow to make enemies more visible
  enemy.mesh.traverse((child) => {
    if (child.isMesh) {
      // Make enemy materials emissive with higher intensity for visibility
      child.material.emissive = new THREE.Color(enemyType.color);
      child.material.emissiveIntensity = 0.8;

      // Add outline effect if not already present
      if (!child.material.userData.outlineApplied) {
        child.material.userData.outlineApplied = true;

        // Create a slightly larger clone with reverse-side rendering for outline effect
        const outlineGeometry = child.geometry.clone();
        const outlineMaterial = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          side: THREE.BackSide,
        });
        const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
        outline.scale.multiplyScalar(1.05);
        child.add(outline);
      }
    }
  });

  // Add a point light attached to enemy for better visibility
  const enemyLight = new THREE.PointLight(enemyType.color, 0.6, 5);
  enemyLight.position.set(0, 0, 0);
  enemy.mesh.add(enemyLight);

  return enemy;
}

// Enemy update function
function updateEnemies(delta) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];
    if (!enemy.isActive) continue;

    // Update enemy position
    const distanceToPlayer = enemy.mesh.position.distanceTo(camera.position);

    // Simple AI: if player is within certain distance, move toward player
    if (distanceToPlayer < 30) {
      const directionToPlayer = camera.position
        .clone()
        .sub(enemy.mesh.position)
        .normalize();
      enemy.mesh.position.addScaledVector(directionToPlayer, enemy.type.speed);
      enemy.mesh.lookAt(camera.position);
    }

    // Update enemy collider
    enemy.mesh.updateMatrixWorld(true);
    enemy.collider.setFromObject(enemy.mesh);

    // Check collision with player
    if (!gameState.isGameOver && distanceToPlayer < 1) {
      // Damage player
      takeDamage(enemy.type.damage);

      // Destroy enemy on collision
      destroyEnemy(i);
      continue;
    }

    // Check distance - if enemy is too far behind player, remove it
    if (distanceToPlayer > 50) {
      destroyEnemy(i);
      continue;
    }

    // Check projectile collision
    for (let j = projectiles.length - 1; j >= 0; j--) {
      const projectile = projectiles[j];
      // Create a temp box3 for the projectile
      const projectileBounds = new THREE.Box3().setFromObject(projectile.mesh);

      if (enemy.collider.intersectsBox(projectileBounds)) {
        // Enemy hit by projectile
        enemy.health -= 5 * projectile.power; // Projectile damage based on power

        // Remove projectile
        scene.remove(projectile.mesh);
        scene.remove(projectile.trail);
        projectile.mesh.geometry.dispose();
        projectile.mesh.material.dispose();
        projectile.trail.geometry.dispose();
        projectile.trail.material.dispose();
        projectiles.splice(j, 1);

        // Check if enemy destroyed
        if (enemy.health <= 0) {
          // Increase score
          gameState.score += enemy.type.pointValue;
          // Show score update notification
          showNotification(`+${enemy.type.pointValue} pts`, '#ffff00');
          destroyEnemy(i);
          break;
        }
      }
    }
  }
}

function destroyEnemy(index) {
  const enemy = enemies[index];
  scene.remove(enemy.mesh);

  // Play explosion sound
  if (audioManager.initialized) {
    // Calculate volume based on distance to player
    const distanceToPlayer = enemy.mesh.position.distanceTo(camera.position);
    const volume = Math.min(0.8, 10 / Math.max(1, distanceToPlayer));
    audioManager.playSound('explosion', { volume });
  }

  // Create explosion particle effect
  createExplosionEffect(enemy.mesh.position.clone());

  // Dispose of geometries
  enemy.mesh.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  enemies.splice(index, 1);
}

// Create an explosion visual effect at the given position
function createExplosionEffect(position) {
  const particleCount = 30;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    // Random position within a sphere
    const angle1 = Math.random() * Math.PI * 2;
    const angle2 = Math.random() * Math.PI * 2;
    const radius = 0.2 + Math.random() * 0.3;

    positions[i] = position.x + radius * Math.sin(angle1) * Math.cos(angle2);
    positions[i + 1] =
      position.y + radius * Math.sin(angle1) * Math.sin(angle2);
    positions[i + 2] = position.z + radius * Math.cos(angle1);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  // Bright orange-yellow color for explosion
  const material = new THREE.PointsMaterial({
    color: 0xff9500,
    size: 0.2,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });

  const explosion = new THREE.Points(geometry, material);
  scene.add(explosion);

  // Animation for explosion - expand and fade
  const expandSpeed = 1.5 + Math.random() * 1.0;
  const duration = 0.8; // seconds
  let elapsed = 0;

  // Create an animation function
  function animateExplosion(delta) {
    elapsed += delta;
    const progress = elapsed / duration;

    if (progress >= 1) {
      scene.remove(explosion);
      geometry.dispose();
      material.dispose();
      return true; // Animation complete
    }

    // Expand particles
    for (let i = 0; i < positions.length; i += 3) {
      const dx = positions[i] - position.x;
      const dy = positions[i + 1] - position.y;
      const dz = positions[i + 2] - position.z;

      positions[i] += dx * expandSpeed * delta;
      positions[i + 1] += dy * expandSpeed * delta;
      positions[i + 2] += dz * expandSpeed * delta;
    }

    // Fade out
    material.opacity = 0.8 * (1 - progress);
    material.size = 0.2 * (1 + progress);

    geometry.attributes.position.needsUpdate = true;
    return false; // Animation not yet complete
  }

  // Add to an array of active animations to be updated in the main loop
  activeAnimations.push(animateExplosion);
}

// Player health management
function takeDamage(amount) {
  gameState.playerHealth -= amount;

  // Play damage sound
  if (audioManager.initialized) {
    const damageSeverity = amount / gameState.maxPlayerHealth;
    const volume = 0.3 + damageSeverity * 0.4; // Volume increases with damage severity
    audioManager.playSound('playerDamage', { volume });

    // Also shake the camera for feedback
    shakeCamera(damageSeverity * 0.8);
  }

  if (gameState.playerHealth <= 0) {
    gameState.playerHealth = 0;
    gameOver();
  }

  updateHUD();

  // Visual feedback - screen flash
  const flashEffect = document.createElement('div');
  flashEffect.style.position = 'absolute';
  flashEffect.style.top = '0';
  flashEffect.style.left = '0';
  flashEffect.style.width = '100%';
  flashEffect.style.height = '100%';
  flashEffect.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
  flashEffect.style.pointerEvents = 'none';
  flashEffect.style.transition = 'opacity 0.5s';
  document.body.appendChild(flashEffect);

  setTimeout(() => {
    flashEffect.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(flashEffect);
    }, 500);
  }, 100);
}

function healPlayer(amount) {
  gameState.playerHealth = Math.min(
    gameState.playerHealth + amount,
    gameState.maxPlayerHealth
  );
  updateHUD();
}

// Power-ups
const powerups = [];
const powerupTypes = [
  {
    name: 'health',
    color: 0x00ff00,
    size: 0.5,
    duration: 0, // instant effect
    effect: function () {
      healPlayer(25);
      showNotification('Shield Repaired!', '#00ff00');
    },
    message: 'Shield Repaired!',
  },
  {
    name: 'speedBoost',
    color: 0x00ffff,
    size: 0.5,
    duration: 10000, // 10 seconds
    effect: function () {
      gameState.speedMultiplier = 2.0;
      showNotification('Speed Boost!', '#00ffff');
      setTimeout(() => {
        gameState.speedMultiplier = 1.0;
        showNotification('Speed Boost End', '#00ffff');
      }, this.duration);
    },
    message: 'Speed Boost!',
  },
  {
    name: 'weaponUpgrade',
    color: 0xffff00,
    size: 0.5,
    duration: 15000, // 15 seconds
    effect: function () {
      gameState.weaponPower = 2;
      showNotification('Weapons Upgraded!', '#ffff00');
      setTimeout(() => {
        gameState.weaponPower = 1;
        showNotification('Weapons Power Normal', '#ffff00');
      }, this.duration);
    },
    message: 'Weapons Upgraded!',
  },
];

// Create a power-up mesh
function createPowerupMesh(powerupType) {
  const geometry = new THREE.IcosahedronGeometry(powerupType.size, 1);
  const material = new THREE.MeshPhongMaterial({
    color: powerupType.color,
    emissive: powerupType.color,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.8,
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Add a pulsing effect
  mesh.userData.pulse = {
    initialScale: 1.0,
    phase: Math.random() * Math.PI * 2, // Random starting phase
    speed: 2.0,
  };

  return mesh;
}

// Spawn a power-up at a position
function spawnPowerup(position, typeName = null) {
  // If no specific type requested, choose randomly
  const powerupType = typeName
    ? powerupTypes.find((t) => t.name === typeName)
    : powerupTypes[Math.floor(Math.random() * powerupTypes.length)];

  const powerupMesh = createPowerupMesh(powerupType);
  powerupMesh.position.copy(position);

  // Store power-up data
  const powerup = {
    mesh: powerupMesh,
    type: powerupType,
    collider: new THREE.Box3(),
    isActive: true,
  };

  // Update the power-up collider
  powerup.collider.setFromObject(powerupMesh);

  powerups.push(powerup);
  scene.add(powerupMesh);
  // Immediately check for circular references after adding powerup
  if (detectCircularReferences(scene)) {
    throw new Error('Circular reference detected after adding powerup!');
  }

  return powerup;
}

// Spawn power-up in tunnel segments
function spawnPowerupInTunnel() {
  // Similar to spawnEnemiesInTunnel but for power-ups
  const validSegments = levelSegments.slice(1);

  // Choose a random segment
  if (validSegments.length === 0) return;

  // Power-ups should be placed further in the tunnel than enemies
  const segmentIndex =
    Math.floor(validSegments.length * 0.4) +
    Math.floor(Math.random() * (validSegments.length * 0.6));

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

  // Random position within segment bounds - more centered for better visibility
  const x = (Math.random() - 0.5) * segmentWidth * 0.6;
  const y = (Math.random() - 0.5) * segmentHeight * 0.6;
  const z = -segmentLength * (Math.random() * 0.7 + 0.15); // Position between 15% and 85% through segment

  const spawnPosition = new THREE.Vector3(x, y, z).applyMatrix4(
    segment.matrixWorld
  );

  // Add a debug marker for the power-up spawn point
  const debugPowerupSpawn = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
  );
  debugPowerupSpawn.position.copy(spawnPosition);
  scene.add(debugPowerupSpawn);
  // Immediately check for circular references after adding debug marker
  if (detectCircularReferences(scene)) {
    throw new Error('Circular reference detected after adding debug marker!');
  }

  // Remove debug marker after 5 seconds
  setTimeout(() => {
    scene.remove(debugPowerupSpawn);
    debugPowerupSpawn.geometry.dispose();
    debugPowerupSpawn.material.dispose();
  }, 5000);

  // Get a random powerup type
  const powerupIndex = Math.floor(Math.random() * powerupTypes.length);
  const powerupType = powerupTypes[powerupIndex];

  const powerup = spawnPowerup(spawnPosition, powerupType.name);

  // Add a pulsing point light to the powerup to make it more visible
  const powerupLight = new THREE.PointLight(powerupType.color, 1.0, 3.0);
  powerupLight.position.set(0, 0, 0);
  powerup.mesh.add(powerupLight);

  // Add animation for the light intensity
  const pulseAnimation = (delta) => {
    const time = performance.now() * 0.001; // Convert to seconds
    powerupLight.intensity = 0.7 + 0.5 * Math.sin(time * 5); // Pulsing between 0.2 and 1.2 intensity

    if (!scene.getObjectById(powerupLight.id)) {
      // Light has been removed, stop the animation
      return true;
    }
    return false;
  };

  activeAnimations.push(pulseAnimation);

  return powerup;
}

// Update power-ups
function updatePowerups(delta) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const powerup = powerups[i];
    if (!powerup.isActive) continue;

    // Animate the power-up (rotation and pulsing)
    powerup.mesh.rotation.y += delta;
    powerup.mesh.rotation.x += delta * 0.5;

    const pulse = powerup.mesh.userData.pulse;
    if (pulse) {
      const scale =
        pulse.initialScale +
        Math.sin(pulse.phase + clock.elapsedTime * pulse.speed) * 0.1;
      powerup.mesh.scale.set(scale, scale, scale);
    }

    // Update collider
    powerup.mesh.updateMatrixWorld(true);
    powerup.collider.setFromObject(powerup.mesh);

    // Check collision with player
    const distanceToPlayer = powerup.mesh.position.distanceTo(camera.position);
    if (distanceToPlayer < 1.5) {
      // Apply power-up effect
      powerup.type.effect();

      // Play appropriate sound based on powerup type
      if (audioManager.initialized) {
        switch (powerup.type.name) {
          case 'health':
            audioManager.playSound('heal', { volume: 0.5 });
            break;
          case 'speedBoost':
            audioManager.playSound('speedBoost', { volume: 0.5 });
            break;
          case 'weaponUpgrade':
            audioManager.playSound('weaponBoost', { volume: 0.5 });
            break;
          default:
            audioManager.playSound('powerup', { volume: 0.5 });
        }
      }

      // Remove power-up
      scene.remove(powerup.mesh);
      powerup.mesh.geometry.dispose();
      powerup.mesh.material.dispose();
      powerups.splice(i, 1);
    }

    // Check distance - if power-up is too far behind player, remove it
    if (distanceToPlayer > 50) {
      scene.remove(powerup.mesh);
      powerup.mesh.geometry.dispose();
      powerup.mesh.material.dispose();
      powerups.splice(i, 1);
    }
  }
}

// Collision detection function
function checkCollisions(position) {
  console.log('Checking collisions at position:', position);

  // Create a bounding box for the player at the proposed position
  const playerBox = new THREE.Box3();
  const playerSize = 0.8; // Adjust based on player collision size
  playerBox.setFromCenterAndSize(
    position,
    new THREE.Vector3(playerSize, playerSize, playerSize)
  );

  // Check collisions with level segments
  for (const segment of levelSegments) {
    console.log('Checking segment:', segment);
    // Check each wall/ceiling/floor in the segment
    for (const child of segment.children) {
      console.log('Checking child:', child);
      // Skip debug markers and lights (typically SphereMesh)
      if (child.geometry && child.geometry.type === 'SphereGeometry') {
        continue;
      }

      // Skip stone formations for smoother gameplay
      if (child.geometry && child.geometry.type === 'ConeGeometry') {
        continue;
      }

      // Create a bounding box for this wall or floor element
      const wallBox = new THREE.Box3().setFromObject(child);

      // Check intersection
      if (playerBox.intersectsBox(wallBox)) {
        console.log('Collision detected with:', child);
        // Play collision sound if we have audio
        if (audioManager && audioManager.initialized && Math.random() > 0.7) {
          audioManager.playSound('hit', { volume: 0.2 + Math.random() * 0.2 });
        }

        return true; // Collision detected
      }
    }
  }

  // Check collision with enemies for damage
  for (const enemy of enemies) {
    if (!enemy.isActive) continue;

    // We don't want to stop player movement on enemy collision
    // but rather handle it in the enemy update function
    // where we apply damage, so no collision return here
  }

  return false; // No collision
}

// Level elements
const levelSegments = [];
const segmentLength = 20; // Length of each tunnel segment
const wallThickness = 0.5;

// Sound initialization
async function initSounds() {
  // Load all game sounds
  await Promise.all([
    // Engine and movement sounds
    audioManager.loadSound('engine', 'public/sounds/engine.mp3'),
    audioManager.loadSound('thruster', 'public/sounds/thruster.mp3'),

    // Weapon sounds
    audioManager.loadSound('shoot', 'public/sounds/laser_shoot.mp3'),
    audioManager.loadSound('enemyShoot', 'public/sounds/enemy_shoot.mp3'),

    // Collision sounds
    audioManager.loadSound('hit', 'public/sounds/hit.mp3'),
    audioManager.loadSound('explosion', 'public/sounds/explosion.mp3'),
    audioManager.loadSound('playerDamage', 'public/sounds/player_damage.mp3'),

    // Powerup sounds
    audioManager.loadSound('powerup', 'public/sounds/powerup.mp3'),
    audioManager.loadSound('heal', 'public/sounds/heal.mp3'),
    audioManager.loadSound('weaponBoost', 'public/sounds/weapon_boost.mp3'),
    audioManager.loadSound('speedBoost', 'public/sounds/speed_boost.mp3'),

    // UI sounds
    audioManager.loadSound('menuSelect', 'public/sounds/menu_select.mp3'),
    audioManager.loadSound('gameOver', 'public/sounds/game_over.mp3'),

    // Music
    audioManager.loadSound(
      'backgroundMusic',
      'public/sounds/background_music.mp3'
    ),
  ]).catch((err) => {
    console.warn('Some sounds failed to load, but game will continue:', err);
  });

  // Use synthesized sounds for any missing audio files
  if (!audioManager.sounds.engine) createSynthesizedEngineSound();
  if (!audioManager.sounds.thruster) createSynthesizedThrusterSound();
  if (!audioManager.sounds.shoot) createSynthesizedShootSound();
  if (!audioManager.sounds.explosion) createSynthesizedExplosionSound();
  if (!audioManager.sounds.powerup) createSynthesizedPowerupSound();
  if (!audioManager.sounds.backgroundMusic) createSynthesizedBackgroundMusic();
}

// Create synthesized sounds using the Web Audio API for common game sounds
// This ensures we have sounds even without audio files
function createSynthesizedEngineSound() {
  if (!audioManager.initialized) audioManager.init();

  const ctx = audioManager.context;
  const duration = 1;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  // Create engine hum sound
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    data[i] =
      0.2 * Math.sin(2 * Math.PI * 120 * t) +
      0.1 * Math.sin(2 * Math.PI * 240 * t) +
      0.05 * Math.sin(2 * Math.PI * 480 * t) +
      0.02 * Math.random(); // Add a bit of noise
  }

  audioManager.sounds.engine = buffer;
}

function createSynthesizedShootSound() {
  if (!audioManager.initialized) audioManager.init();

  const ctx = audioManager.context;
  const duration = 0.3;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  // Create laser shoot sound
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const frequency = 1000 - 800 * t; // Descending pitch
    data[i] = 0.5 * Math.sin(2 * Math.PI * frequency * t) * (1 - t / duration);
  }

  audioManager.sounds.shoot = buffer;
}

function createSynthesizedExplosionSound() {
  if (!audioManager.initialized) audioManager.init();

  const ctx = audioManager.context;
  const duration = 0.8;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  // Create explosion sound with white noise and low frequency rumble
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const envelope =
      t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.1) / (duration - 0.1));
    data[i] =
      envelope *
      (0.5 * Math.random() + // Noise
        0.5 * Math.sin(2 * Math.PI * 60 * t)); // Low rumble
  }

  audioManager.sounds.explosion = buffer;
}

function createSynthesizedPowerupSound() {
  if (!audioManager.initialized) audioManager.init();

  const ctx = audioManager.context;
  const duration = 0.5;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  // Create ascending powerup pickup sound
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const frequency = 440 + 660 * t; // Ascending pitch
    data[i] = 0.3 * Math.sin(2 * Math.PI * frequency * t);
  }

  audioManager.sounds.powerup = buffer;
}

function createSynthesizedBackgroundMusic() {
  if (!audioManager.initialized) audioManager.init();

  const ctx = audioManager.context;
  const duration = 30; // 30 seconds of music that can loop
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  // Create a simple ambient background track
  // Using pentatonic scale for a sci-fi feel
  const notes = [220, 261.63, 329.63, 392, 440];
  const baseFreq = notes[0];

  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const noteIndex = Math.floor(t * 0.25) % 16;
    const octave = Math.floor(noteIndex / 5);
    const note = notes[noteIndex % 5];
    const freq = note * (1 + octave * 0.5);

    // Create a drone bass
    const bass = 0.15 * Math.sin(2 * Math.PI * baseFreq * 0.5 * t);

    // Create a melody
    const melody =
      noteIndex % 8 < 7 ? 0.1 * Math.sin(2 * Math.PI * freq * t) : 0;

    // Add some atmosphere
    const atmosphere =
      0.05 * Math.sin(2 * Math.PI * baseFreq * 2 * t) * Math.sin(0.5 * t);

    data[i] = bass + melody + atmosphere;
  }

  audioManager.sounds.backgroundMusic = buffer;
}

function createSynthesizedThrusterSound() {
  if (!audioManager.initialized) audioManager.init();

  const ctx = audioManager.context;
  const duration = 1;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
  const data = buffer.getChannelData(0);

  // Create thruster sound with white noise and a high-pass sweep
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    // Base noise component
    const noise = Math.random() * 0.2;

    // Sweep component
    const sweepFreq = 200 + 400 * Math.sin(t * 5);
    const sweep = 0.1 * Math.sin(2 * Math.PI * sweepFreq * t);

    data[i] = noise + sweep;
  }

  audioManager.sounds.thruster = buffer;
}

// --- State for procedural generation ---
let genParams = {
  width: 10,
  height: 10,
  turn: 0, // -1 for left, 1 for right, 0 for straight
  pitch: 0, // -1 for down, 1 for up, 0 for level (for future use)
  prevPosition: new THREE.Vector3(0, 0, 0),
  prevRotation: new THREE.Euler(0, 0, 0, 'YXZ'),
};
// --- End State ---

const generationThresholdDistance = segmentLength * 5; // Generate when player is this close to the end point
const segmentsToAddAtOnce = 5;
const maxVisibleSegments = 25; // Max segments to keep in scene
const initialSegmentsToGenerate = 15;

const wallMaterial = new THREE.MeshPhongMaterial({
  color: 0x808080,
  side: THREE.DoubleSide,
});

function createTunnelSegment(options) {
  const {
    width = 10,
    height = 10,
    turn = 0, // Yaw turn: 0: straight, 1: right, -1: left
    pitch = 0, // Pitch turn: 0: level, 1: up, -1: down (currently unused in random generation)
    prevPosition,
    prevRotation,
  } = options;

  // Create segment group
  const segmentGroup = new THREE.Group();

  // Position the segment according to previous segment's end
  segmentGroup.position.copy(prevPosition);
  segmentGroup.rotation.copy(prevRotation);

  // Debug visualization of segment position (temporary)
  const debugMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  segmentGroup.add(debugMarker);

  // Calculate the forward vector based on previous rotation
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(prevRotation);
  // Calculate the right vector
  const right = new THREE.Vector3(1, 0, 0).applyEuler(prevRotation);
  // Calculate the up vector
  const up = new THREE.Vector3(0, 1, 0).applyEuler(prevRotation);

  // Add some randomness to the segment dimensions for a more organic cave feel
  const randomWidth = width * (0.9 + Math.random() * 0.2);
  const randomHeight = height * (0.9 + Math.random() * 0.2);
  const segmentLength = 20; // Length of each segment

  // Create a more organic cave material with texture
  const caveMaterial = new THREE.MeshStandardMaterial({
    color: 0x505050,
    roughness: 0.8,
    metalness: 0.2,
    side: THREE.DoubleSide,
    flatShading: true,
    emissive: 0x050505, // Add slight emission for better visibility
  });

  // Create a more detailed floor with some bumps
  const floorGeometry = new THREE.PlaneGeometry(
    randomWidth,
    segmentLength,
    10,
    10
  );
  // Add some random displacement to vertices
  const floorVerts = floorGeometry.attributes.position.array;
  for (let i = 0; i < floorVerts.length; i += 3) {
    // Skip the very edges to avoid gaps
    if (i > 9 && i < floorVerts.length - 9) {
      floorVerts[i + 1] = (Math.random() - 0.5) * 0.3; // Random Y displacement
    }
  }
  floorGeometry.computeVertexNormals();

  const floorMesh = new THREE.Mesh(floorGeometry, caveMaterial);
  floorMesh.rotation.x = Math.PI / 2; // Rotate to horizontal
  floorMesh.position.set(0, -randomHeight / 2, -segmentLength / 2); // Position at bottom of tunnel
  segmentGroup.add(floorMesh);

  // Create ceiling
  const ceilingGeometry = new THREE.PlaneGeometry(
    randomWidth,
    segmentLength,
    10,
    10
  );
  // Add random displacement to ceiling vertices too
  const ceilingVerts = ceilingGeometry.attributes.position.array;
  for (let i = 0; i < ceilingVerts.length; i += 3) {
    if (i > 9 && i < ceilingVerts.length - 9) {
      ceilingVerts[i + 1] = (Math.random() - 0.5) * 0.5; // More pronounced bumps
    }
  }
  ceilingGeometry.computeVertexNormals();

  const ceilingMesh = new THREE.Mesh(ceilingGeometry, caveMaterial);
  ceilingMesh.rotation.x = -Math.PI / 2; // Rotate to horizontal
  ceilingMesh.rotation.z = Math.PI; // Flip so the normal faces inward
  ceilingMesh.position.set(0, randomHeight / 2, -segmentLength / 2); // Position at top of tunnel
  segmentGroup.add(ceilingMesh);

  // Create left wall
  const leftWallGeometry = new THREE.PlaneGeometry(
    segmentLength,
    randomHeight,
    10,
    10
  );
  // Add random displacement to left wall vertices
  const leftWallVerts = leftWallGeometry.attributes.position.array;
  for (let i = 0; i < leftWallVerts.length; i += 3) {
    if (i > 9 && i < leftWallVerts.length - 9) {
      leftWallVerts[i + 1] = (Math.random() - 0.5) * 0.4; // Random X displacement
    }
  }
  leftWallGeometry.computeVertexNormals();

  const leftWallMesh = new THREE.Mesh(leftWallGeometry, caveMaterial);
  leftWallMesh.rotation.y = Math.PI / 2; // Rotate to vertical
  leftWallMesh.position.set(-randomWidth / 2, 0, -segmentLength / 2); // Position at left of tunnel
  segmentGroup.add(leftWallMesh);

  // Create right wall
  const rightWallGeometry = new THREE.PlaneGeometry(
    segmentLength,
    randomHeight,
    10,
    10
  );
  // Add random displacement to right wall vertices
  const rightWallVerts = rightWallGeometry.attributes.position.array;
  for (let i = 0; i < rightWallVerts.length; i += 3) {
    if (i > 9 && i < rightWallVerts.length - 9) {
      rightWallVerts[i + 1] = (Math.random() - 0.5) * 0.4; // Random X displacement
    }
  }
  rightWallGeometry.computeVertexNormals();

  const rightWallMesh = new THREE.Mesh(rightWallGeometry, caveMaterial);
  rightWallMesh.rotation.y = -Math.PI / 2; // Rotate to vertical
  rightWallMesh.position.set(randomWidth / 2, 0, -segmentLength / 2); // Position at right of tunnel
  segmentGroup.add(rightWallMesh);

  // Add some stalactites and stalagmites for visual interest
  const addStoneFormation = (isUp) => {
    const count = Math.floor(Math.random() * 4) + 1; // 1-4 formations
    for (let i = 0; i < count; i++) {
      const height = 0.5 + Math.random() * 1.5; // Random height for the formation
      const radius = 0.2 + Math.random() * 0.4; // Random base radius

      const stoneGeometry = new THREE.ConeGeometry(radius, height, 5, 1, false);
      const stoneMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 1.0,
        metalness: 0.2,
        flatShading: true,
      });

      const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);

      // Random position along the segment
      const xPos = (Math.random() - 0.5) * randomWidth * 0.8; // Keep away from walls
      const zPos = -(Math.random() * segmentLength * 0.8); // Random position along segment

      if (isUp) {
        // Stalagmite pointing up from floor
        stone.position.set(xPos, -randomHeight / 2, zPos);
      } else {
        // Stalactite hanging from ceiling, need to rotate
        stone.rotation.x = Math.PI;
        stone.position.set(xPos, randomHeight / 2, zPos);
      }

      segmentGroup.add(stone);
    }
  };

  // Add random cave formations
  if (Math.random() > 0.5) addStoneFormation(true); // Stalagmites
  if (Math.random() > 0.5) addStoneFormation(false); // Stalactites

  // Apply rotation based on turn and pitch
  // Calculate ending position and rotation for this segment
  const segmentDirection = new THREE.Vector3(0, 0, -1); // Base direction is forward

  // Apply turn (yaw) - randomly adjust turn for more organic feel
  const turnFactor = turn + (Math.random() - 0.5) * 0.3; // Add some randomness to the turn
  const yawRotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    turnFactor * 0.3
  );
  segmentDirection.applyQuaternion(yawRotation);

  // Apply pitch
  const pitchFactor = pitch + (Math.random() - 0.5) * 0.2; // Add some randomness to the pitch
  const pitchRotation = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    pitchFactor * 0.2
  );
  segmentDirection.applyQuaternion(pitchRotation);

  // Apply rotation to the segment's local forward
  segmentDirection.applyEuler(prevRotation);

  // Calculate new position and rotation for the next segment
  const nextPosition = prevPosition.clone();
  nextPosition.addScaledVector(segmentDirection.normalize(), segmentLength);

  const nextRotation = prevRotation.clone();
  if (turn !== 0) {
    nextRotation.y += turn * 0.3; // Apply yaw rotation
  }
  if (pitch !== 0) {
    nextRotation.x += pitch * 0.2; // Apply pitch rotation
  }

  // Add the segment to the scene
  scene.add(segmentGroup);

  // Add the segment to the levelSegments array for tracking
  levelSegments.push(segmentGroup);

  // Update the generation parameters for the next segment
  const forwardVector = new THREE.Vector3(0, 0, -1).applyEuler(prevRotation);
  genParams.prevPosition.addScaledVector(forwardVector, segmentLength);
  genParams.prevRotation.copy(prevRotation);

  // Update generation parameters for the next segment
  genParams.prevPosition = nextPosition;
  genParams.prevRotation = nextRotation;

  // Choose random turn and pitch for next segment
  genParams.turn = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
  genParams.pitch = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1

  // Add segment to scene
  scene.add(segmentGroup);
  levelSegments.push(segmentGroup);

  return segmentGroup;
}

function addSegments(count) {
  for (let i = 0; i < count; i++) {
    // Create a new tunnel segment and get the reference to it
    const segment = createTunnelSegment(genParams);

    // Add lights to some segments
    if (Math.random() > 0.6) {
      // Choose a random color from a set of atmospheric colors
      const lightColors = [0x4466aa, 0x66aacc, 0x66ccff, 0x44aa66];
      const color = lightColors[Math.floor(Math.random() * lightColors.length)];
      addLightsToSegment(segment, color);
    }

    // For debugging - add a sphere to mark the start point of the next segment
    const debugNextPosition = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    debugNextPosition.position.copy(genParams.prevPosition);
    scene.add(debugNextPosition);

    // Schedule auto-removal of debug markers after 10 seconds
    setTimeout(() => {
      scene.remove(debugNextPosition);
      debugNextPosition.geometry.dispose();
      debugNextPosition.material.dispose();
    }, 10000);
  }
}

function removeOldestSegments() {
  while (levelSegments.length > maxVisibleSegments) {
    const oldestSegment = levelSegments.shift();
    scene.remove(oldestSegment);
    oldestSegment.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}

function generateInitialLevel() {
  for (let i = 0; i < initialSegmentsToGenerate; i++) {
    createTunnelSegment(genParams);
  }
}

// Enhanced manageLevelGeneration with difficulty progression
function manageLevelGeneration() {
  if (levelSegments.length === 0) return; // Should not happen after initial generation

  // genParams.prevPosition is the position where the *next* segment would start
  const distanceToTunnelEnd = camera.position.distanceTo(
    genParams.prevPosition
  );

  if (distanceToTunnelEnd < generationThresholdDistance) {
    // console.log(`Distance to end: ${distanceToTunnelEnd.toFixed(2)}. Generating new segments.`);
    addSegments(segmentsToAddAtOnce);

    // Calculate difficulty based on score
    const difficulty = Math.min(1 + gameState.score / 1000, 3);

    // Randomly spawn enemies and power-ups in the new segments
    // As difficulty increases, more enemies and fewer powerups
    const enemySpawnChance = 0.5 + difficulty * 0.1; // 60-80% chance based on difficulty
    if (Math.random() < enemySpawnChance) {
      const enemiesCount = Math.floor(Math.random() * difficulty) + 1; // 1-4 enemies based on difficulty
      for (let i = 0; i < enemiesCount; i++) {
        spawnEnemiesInTunnel();
      }
    }

    const powerupSpawnChance = 0.4 - difficulty * 0.05; // 35-25% chance based on difficulty
    if (Math.random() < powerupSpawnChance) {
      spawnPowerupInTunnel();
    }

    removeOldestSegments(); // Clean up segments that are too far back
  }
}

// Game initialization
function initGame() {
  // Clear all existing entities
  // Remove enemies
  while (enemies.length > 0) {
    const enemy = enemies[0];
    destroyEnemy(0);
  }

  // Remove powerups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const powerup = powerups[i];
    scene.remove(powerup.mesh);
    if (powerup.mesh.geometry) powerup.mesh.geometry.dispose();
    if (powerup.mesh.material) powerup.mesh.material.dispose();
  }
  powerups.length = 0;

  // Remove projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    scene.remove(projectile.mesh);
    scene.remove(projectile.trail);
    if (projectile.mesh.geometry) projectile.mesh.geometry.dispose();
    if (projectile.mesh.material) projectile.mesh.material.dispose();
    if (projectile.trail.geometry) projectile.trail.geometry.dispose();
    if (projectile.trail.material) projectile.trail.material.dispose();
  }
  projectiles.length = 0;

  // Initialize game state
  gameState.playerHealth = gameState.maxPlayerHealth;
  gameState.score = 0;
  gameState.isGameOver = false;
  gameState.speedMultiplier = 1.0;
  gameState.weaponPower = 1;

  // Reset camera position
  camera.position.set(0, 0, 5);
  camera.rotation.set(0, 0, 0);

  // Reset tunnel generation parameters
  genParams = {
    width: 10,
    height: 10,
    turn: 0,
    pitch: 0,
    prevPosition: new THREE.Vector3(0, 0, 0),
    prevRotation: new THREE.Euler(0, 0, 0, 'YXZ'),
  };

  // Remove any existing tunnel segments
  for (let i = levelSegments.length - 1; i >= 0; i--) {
    scene.remove(levelSegments[i]);
    levelSegments[i].traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
  levelSegments.length = 0;

  // Generate the initial tunnel
  generateInitialLevel();

  // Spawn initial enemies
  for (let i = 0; i < 3; i++) {
    spawnEnemiesInTunnel();
  }

  // Spawn initial power-ups
  spawnPowerupInTunnel();

  // Update HUD
  updateHUD();
}

// HUD elements
const hudContainer = document.createElement('div');
hudContainer.style.position = 'absolute';
hudContainer.style.top = '10px';
hudContainer.style.left = '10px';
hudContainer.style.width = '100%';
hudContainer.style.pointerEvents = 'none'; // Let clicks pass through
document.body.appendChild(hudContainer);

// Health bar
const healthBarContainer = document.createElement('div');
healthBarContainer.style.position = 'absolute';
healthBarContainer.style.top = '10px';
healthBarContainer.style.left = '10px';
healthBarContainer.style.width = '200px';
healthBarContainer.style.height = '20px';
healthBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
healthBarContainer.style.border = '1px solid #fff';
hudContainer.appendChild(healthBarContainer);

const healthBar = document.createElement('div');
healthBar.style.width = '100%';
healthBar.style.height = '100%';
healthBar.style.backgroundColor = '#00ff00';
healthBar.style.transition = 'width 0.3s';
healthBarContainer.appendChild(healthBar);

// Score display
const scoreDisplay = document.createElement('div');
scoreDisplay.style.position = 'absolute';
scoreDisplay.style.top = '10px';
scoreDisplay.style.right = '10px';
scoreDisplay.style.color = '#fff';
scoreDisplay.style.fontSize = '24px';
scoreDisplay.style.textShadow = '1px 1px 2px black';
scoreDisplay.textContent = 'Score: 0';
hudContainer.appendChild(scoreDisplay);

// Notification area for power-ups
const notificationArea = document.createElement('div');
notificationArea.style.position = 'absolute';
notificationArea.style.bottom = '50px';
notificationArea.style.left = '50%';
notificationArea.style.transform = 'translateX(-50%)';
notificationArea.style.color = '#fff';
notificationArea.style.fontSize = '24px';
notificationArea.style.textShadow = '1px 1px 2px black';
notificationArea.style.textAlign = 'center';
notificationArea.style.opacity = '0';
notificationArea.style.transition = 'opacity 0.5s';
hudContainer.appendChild(notificationArea);

// Game over screen
const gameOverScreen = document.createElement('div');
gameOverScreen.style.position = 'absolute';
gameOverScreen.style.top = '50%';
gameOverScreen.style.left = '50%';
gameOverScreen.style.transform = 'translate(-50%, -50%)';
gameOverScreen.style.color = '#f00';
gameOverScreen.style.fontSize = '48px';
gameOverScreen.style.textAlign = 'center';
gameOverScreen.style.display = 'none';
gameOverScreen.style.flexDirection = 'column';
gameOverScreen.style.gap = '20px';
gameOverScreen.style.textShadow = '2px 2px 4px black';
gameOverScreen.innerHTML = `
  <div>GAME OVER</div>
  <div id="final-score" style="font-size: 36px; color: #fff;">Score: 0</div>
  <div id="restart-btn" style="
    font-size: 24px;
    cursor: pointer;
    background-color: #f00; 
    padding: 10px 20px;
    border-radius: 5px;
    pointer-events: auto;
  ">Restart</div>
`;
hudContainer.appendChild(gameOverScreen);

document.getElementById('restart-btn').addEventListener('click', () => {
  // Play click sound
  if (audioManager.initialized) {
    audioManager.playSound('menuSelect', { volume: 0.5 });
  }

  // Reset game state and restart
  initGame();
  gameOverScreen.style.display = 'none';
});

// Update the HUD elements
function updateHUD() {
  // Update health bar
  const healthPercent =
    (gameState.playerHealth / gameState.maxPlayerHealth) * 100;
  healthBar.style.width = `${healthPercent}%`;

  // Update health bar color (green->yellow->red as health decreases)
  if (healthPercent > 60) {
    healthBar.style.backgroundColor = '#00ff00'; // Green
  } else if (healthPercent > 30) {
    healthBar.style.backgroundColor = '#ffff00'; // Yellow
  } else {
    healthBar.style.backgroundColor = '#ff0000'; // Red
  }

  // Update score display
  scoreDisplay.textContent = `Score: ${gameState.score}`;

  // If game is over, show game over screen
  if (gameState.isGameOver) {
    document.getElementById(
      'final-score'
    ).textContent = `Score: ${gameState.score}`;
    gameOverScreen.style.display = 'flex';
  }
}

// Show notifications for power-ups
function showNotification(text, color = '#fff') {
  notificationArea.textContent = text;
  notificationArea.style.color = color;
  notificationArea.style.opacity = '1';

  setTimeout(() => {
    notificationArea.style.opacity = '0';
  }, 2000); // Hide after 2 seconds
}

// Update animation loop to include pause functionality
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta(); // Time since last frame

  // Skip updates if game not started
  if (!gameState.isGameStarted) {
    // Just render the scene without updates while on start screen
    renderer.render(scene, camera);
    return;
  }

  // Skip updates if game over
  if (gameState.isGameOver) {
    // Just render the scene, no updates
    renderer.render(scene, camera);
    return;
  }

  // Skip game logic updates if pointer is not locked (paused)
  if (document.pointerLockElement !== canvas) {
    renderer.render(scene, camera);
    return;
  }

  // Handle movement
  const moveVector = new THREE.Vector3();
  let isMoving = false;

  if (keyStates['KeyW']) {
    // Forward
    moveVector.z -= 1;
    isMoving = true;
  }
  if (keyStates['KeyS']) {
    // Backward
    moveVector.z += 1;
    isMoving = true;
  }
  if (keyStates['KeyA']) {
    // Strafe Left
    moveVector.x -= 1;
    isMoving = true;
  }
  if (keyStates['KeyD']) {
    // Strafe Right
    moveVector.x += 1;
    isMoving = true;
  }

  // For up/down, we create a separate vector to apply globally or locally as desired
  const verticalMove = new THREE.Vector3();
  if (keyStates['Space']) {
    // Move Up
    verticalMove.y += moveSpeed;
    isMoving = true;
  }
  if (keyStates['ShiftLeft'] || keyStates['ControlLeft']) {
    // Move Down
    verticalMove.y -= moveSpeed;
    isMoving = true;
  }

  // Handle movement sounds
  if (audioManager.initialized) {
    // Start/stop thruster sounds based on movement
    if (isMoving && !thrusterSound) {
      thrusterSound = audioManager.playSound('thruster', {
        loop: true,
        volume: 0.15,
      });
    } else if (!isMoving && thrusterSound) {
      thrusterSound.fadeOut(0.3);
      thrusterSound = null;
    }
  }

  // Handle rotation (Roll)
  // Pitch and Yaw are handled by mouse
  if (keyStates['KeyQ']) {
    // Roll Left
    camera.rotateZ(rotationSpeed);
  }
  if (keyStates['KeyE']) {
    // Roll Right
    camera.rotateZ(-rotationSpeed);
  }

  // Calculate proposed movement for XZ plane (relative to camera)
  // Apply speed multiplier from power-ups
  const currentMoveSpeed = moveSpeed * (gameState.speedMultiplier || 1.0);
  const moveDirection = moveVector.clone().applyQuaternion(camera.quaternion);
  const proposedPosition = camera.position
    .clone()
    .addScaledVector(moveDirection, currentMoveSpeed);

  // Apply vertical movement (global Y for now, can be made relative if needed)
  proposedPosition.y += verticalMove.y * currentMoveSpeed;

  // Check for collisions before moving
  if (!checkCollisions(proposedPosition)) {
    camera.position.copy(proposedPosition);
  } else {
    // If collision, try moving only on XZ plane without vertical change
    const xzProposedPosition = camera.position
      .clone()
      .addScaledVector(moveDirection, currentMoveSpeed);
    if (!checkCollisions(xzProposedPosition)) {
      camera.position.copy(xzProposedPosition);
    } else {
      // If still collision, try moving only vertically
      const yProposedPosition = camera.position.clone();
      yProposedPosition.y += verticalMove.y * currentMoveSpeed;
      if (!checkCollisions(yProposedPosition)) {
        camera.position.copy(yProposedPosition);
      }
      // If all fail, don't move or implement sliding/bounce
    }
  }

  manageLevelGeneration(); // Check and manage infinite tunnel generation

  // Update game elements
  updateEnemies(delta);
  updatePowerups(delta);
  updateProjectiles(delta);
  updateCaveParticles(caveParticles, delta);

  // Process active animations (explosions, camera shakes, etc.)
  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    if (activeAnimations[i](delta)) {
      // If the animation returns true, it's done and should be removed
      activeAnimations.splice(i, 1);
    }
  }

  updateHUD();

  // Add a debug marker to visualize the camera's position
  const cameraDebugMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  cameraDebugMarker.position.copy(camera.position);
  scene.add(cameraDebugMarker);

  // Add debug markers to visualize tunnel segments
  levelSegments.forEach((segment, index) => {
    const segmentDebugMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    );
    segmentDebugMarker.position.copy(segment.position);
    scene.add(segmentDebugMarker);
  });

  renderer.render(scene, camera);
}

// Update the resize handler to adjust the HUD as well
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  // No need to explicitly resize HUD elements as they use percentages/positioning
});

// Start the animation loop
animate();
