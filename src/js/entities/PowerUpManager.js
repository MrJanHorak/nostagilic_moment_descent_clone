// PowerUp Manager for handling all power-ups in the game
import * as THREE from 'three';

// Power-up type definitions
export const powerupTypes = [
  {
    name: 'health',
    color: 0x00ff00,
    size: 0.5,
    duration: 0,
    effect: function (gameState, uiManager) {
      // Heal player for 25% of max health
      const healAmount = gameState.maxPlayerHealth * 0.25;
      gameState.playerHealth = Math.min(
        gameState.maxPlayerHealth,
        gameState.playerHealth + healAmount
      );
      uiManager.updateHUD();
      uiManager.showMessage('Shield Repaired!', 2000, '#00ff00');
    },
    message: 'Shield Repaired!',
  },
  {
    name: 'speedBoost',
    color: 0x00ffff,
    size: 0.5,
    duration: 10000,
    effect: function (gameState, uiManager) {
      // Boost player speed
      gameState.speedMultiplier = 1.5;
      uiManager.showMessage('Speed Boost!', 2000, '#00ffff');

      // Reset after duration
      setTimeout(() => {
        gameState.speedMultiplier = 1.0;
        uiManager.showMessage('Speed Boost Ended', 1500, '#00ffff');
      }, 10000);
    },
    message: 'Speed Boost!',
  },
  {
    name: 'weaponUpgrade',
    color: 0xffff00,
    size: 0.5,
    duration: 15000,
    effect: function (gameState, uiManager) {
      // Upgrade weapon power
      gameState.weaponPower = 2;
      uiManager.showMessage('Weapons Upgraded!', 2000, '#ffff00');

      // Reset after duration
      setTimeout(() => {
        gameState.weaponPower = 1;
        uiManager.showMessage('Weapon Upgrade Ended', 1500, '#ffff00');
      }, 15000);
    },
    message: 'Weapons Upgraded!',
  },
  {
    name: 'weaponPickup',
    color: 0xff00ff, // Purple for weapon pickups
    size: 0.5,
    duration: 0,
    effect: function (gameState, uiManager) {
      // Randomly choose a weapon to give
      const weapons = ['laser', 'missile', 'plasma'];
      const weaponWeights = {
        laser: 0.5, // 50% chance for laser
        missile: 0.3, // 30% chance for missile
        plasma: 0.2, // 20% chance for plasma
      };

      // Weighted random selection
      const rand = Math.random();
      let weapon;
      let cumulativeWeight = 0;

      for (const [w, weight] of Object.entries(weaponWeights)) {
        cumulativeWeight += weight;
        if (rand <= cumulativeWeight) {
          weapon = w;
          break;
        }
      }

      // Add ammo amounts based on weapon rarity
      const ammoAmounts = {
        laser: 30,
        missile: 15,
        plasma: 8,
      };

      // Unlock the weapon and give ammo
      gameState.weaponInventory[weapon].unlocked = true;
      gameState.weaponInventory[weapon].ammo += ammoAmounts[weapon];

      // Record weapon pickup for stats
      if (gameState.recordWeaponPickup) {
        gameState.recordWeaponPickup(weapon);
      }

      // Switch to the new weapon
      gameState.switchWeapon(weapon);

      // Show message
      uiManager.showMessage(
        `${weapon.toUpperCase()} WEAPON ACQUIRED!`,
        3000,
        '#ff00ff'
      );
    },
    message: 'Weapon Acquired!',
  },
  {
    name: 'ammoPickup',
    color: 0xff8800, // Orange for ammo pickups
    size: 0.4,
    duration: 0,
    effect: function (gameState, uiManager) {
      // Determine which weapon to give ammo for
      let ammoAdded = false;

      // First try to add ammo to the current weapon if it's not pulse
      const currentWeapon = gameState.currentWeapon;
      if (
        currentWeapon !== 'pulse' &&
        gameState.weaponInventory[currentWeapon].unlocked
      ) {
        const ammoAmounts = {
          laser: 15,
          missile: 8,
          plasma: 5,
        };

        gameState.weaponInventory[currentWeapon].ammo +=
          ammoAmounts[currentWeapon];
        uiManager.showMessage(
          `${currentWeapon.toUpperCase()} AMMO ADDED`,
          2000,
          '#ff8800'
        );
        ammoAdded = true;
      } else {
        // If not using a special weapon, add ammo to a random unlocked weapon
        const unlockedWeapons = Object.keys(gameState.weaponInventory).filter(
          (w) => w !== 'pulse' && gameState.weaponInventory[w].unlocked
        );

        if (unlockedWeapons.length > 0) {
          const weapon =
            unlockedWeapons[Math.floor(Math.random() * unlockedWeapons.length)];
          const ammoAmounts = {
            laser: 15,
            missile: 8,
            plasma: 5,
          };

          gameState.weaponInventory[weapon].ammo += ammoAmounts[weapon];
          uiManager.showMessage(
            `${weapon.toUpperCase()} AMMO ADDED`,
            2000,
            '#ff8800'
          );
          ammoAdded = true;
        }
      }

      // If no ammo could be added (no special weapons unlocked), give a health boost instead
      if (!ammoAdded) {
        // Heal player for 10% of max health
        const healAmount = gameState.maxPlayerHealth * 0.1;
        gameState.playerHealth = Math.min(
          gameState.maxPlayerHealth,
          gameState.playerHealth + healAmount
        );
        uiManager.updateHUD();
        uiManager.showMessage('Minor Shield Repair', 2000, '#00ff00');
      }

      // Update the weapon UI
      uiManager.updateWeaponUI();
    },
    message: 'Ammo Acquired!',
  },
];

class PowerUpManager {
  constructor(
    scene,
    camera,
    gameState,
    audioManager,
    uiManager,
    levelManager = null
  ) {
    this.scene = scene;
    this.camera = camera;
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.uiManager = uiManager;
    this.levelManager = levelManager; // Add this
    this.powerups = [];
  }

  // Create a power-up mesh
  createPowerupMesh(powerupType) {
    // Group for power-up
    const powerupGroup = new THREE.Group();
    powerupGroup.name = `powerup_${powerupType.name}`;

    // Core geometry - icosahedron for more interesting shape
    const coreGeometry = new THREE.IcosahedronGeometry(
      powerupType.size * 0.5,
      1
    );
    const coreMaterial = new THREE.MeshStandardMaterial({
      color: powerupType.color,
      emissive: powerupType.color,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.8,
    });

    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    powerupGroup.add(core);

    // Outer ring
    const ringGeometry = new THREE.TorusGeometry(
      powerupType.size * 0.7,
      powerupType.size * 0.05,
      16,
      32
    );
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: powerupType.color,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.8,
    });

    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    powerupGroup.add(ring);

    // Point light to make it glow
    const pointLight = new THREE.PointLight(powerupType.color, 1, 3);
    pointLight.position.set(0, 0, 0);
    powerupGroup.add(pointLight);

    return powerupGroup;
  }

  // Spawn a power-up at a position
  spawnPowerup(position, typeName = null) {
    // If no specific type requested, choose randomly
    const powerupType = typeName
      ? powerupTypes.find((t) => t.name === typeName)
      : powerupTypes[Math.floor(Math.random() * powerupTypes.length)];

    const powerupMesh = this.createPowerupMesh(powerupType);
    powerupMesh.position.copy(position);

    // Add unique identifier to mesh
    powerupMesh.userData.powerupId = Date.now() + Math.random();

    const powerup = {
      mesh: powerupMesh,
      type: powerupType,
      id: powerupMesh.userData.powerupId,
      collisionRadius: powerupType.size * 0.7,
    };

    this.powerups.push(powerup);
    this.scene.add(powerupMesh);

    // Animate the power-up
    this.animatePowerup(powerup);

    // Remove automatically after 20 seconds
    setTimeout(() => {
      this.removePowerup(powerup.id);
    }, 20000);

    return powerup;
  }

  // Animate power-up floating and rotating
  animatePowerup(powerup) {
    // Create unique animation values for this powerup
    const rotationSpeed = 0.5 + Math.random() * 0.5;
    const floatFrequency = 0.5 + Math.random() * 0.5;
    const floatAmplitude = 0.1 + Math.random() * 0.1;
    const startTime = performance.now();
    const initialY = powerup.mesh.position.y;

    // Create animation function
    function animate(time) {
      if (!powerup.mesh) return; // Stop if power-up was removed

      const elapsedSeconds = (time - startTime) / 1000;

      // Rotate the mesh
      powerup.mesh.rotation.y += rotationSpeed * 0.01;

      // Float up and down
      const yOffset =
        Math.sin(elapsedSeconds * floatFrequency) * floatAmplitude;
      powerup.mesh.position.y = initialY + yOffset;

      // Also rotate the ring differently
      if (powerup.mesh.children.length > 1) {
        powerup.mesh.children[1].rotation.x += rotationSpeed * 0.007;
        powerup.mesh.children[1].rotation.z += rotationSpeed * 0.005;
      }

      // Schedule the next update
      powerup.animationId = requestAnimationFrame(animate);
    }

    // Start animation
    powerup.animationId = requestAnimationFrame(animate);
  }

  // Update power-ups, check for collisions with player
  update() {
    const playerPosition = new THREE.Vector3();
    this.camera.getWorldPosition(playerPosition);

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const powerup = this.powerups[i];
      const distance = powerup.mesh.position.distanceTo(playerPosition);

      // Check collision with player
      if (distance < powerup.collisionRadius + 0.5) {
        // 0.5 is approx. player radius
        // Apply power-up effect
        powerup.type.effect(this.gameState, this.uiManager);

        // Play sound
        if (this.audioManager && this.audioManager.initialized) {
          this.audioManager.playSound('powerup', { volume: 0.5 });
        }

        // Remove power-up
        this.removePowerup(powerup.id);
      }
    }
  }

  // Remove a power-up by ID
  removePowerup(id) {
    const index = this.powerups.findIndex((p) => p.id === id);
    if (index !== -1) {
      const powerup = this.powerups[index];

      // Cancel animation
      if (powerup.animationId) {
        cancelAnimationFrame(powerup.animationId);
      }

      // Remove from scene and dispose resources
      this.scene.remove(powerup.mesh);
      powerup.mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });

      // Remove from array
      this.powerups.splice(index, 1);
    }
  }

  // Spawn a power-up in a random position in front of the player
  spawnRandomPowerup() {
    const playerPosition = new THREE.Vector3();
    this.camera.getWorldPosition(playerPosition);

    const playerDirection = new THREE.Vector3(0, 0, -1);
    playerDirection.applyQuaternion(this.camera.quaternion);

    // Position 10-20 units ahead of player
    const distance = 10 + Math.random() * 10;
    const position = playerPosition
      .clone()
      .add(playerDirection.multiplyScalar(distance));

    // Add some randomness to position
    position.x += (Math.random() - 0.5) * 8;
    position.y += (Math.random() - 0.5) * 4;

    return this.spawnPowerup(position);
  }

  // Spawn predefined power-ups from level blueprint
  spawnPredefinedPowerUps() {
    if (!this.levelManager || !this.levelManager.currentLevel) return;

    const level = this.levelManager.currentLevel;

    for (const spawnPoint of level.powerupSpawns) {
      // Check if power-up should be visible now (based on player position)
      const distanceToPlayer = spawnPoint.position.distanceTo(
        this.camera.position
      );

      // Only spawn if within reasonable distance and not already spawned
      if (distanceToPlayer < 50 && !spawnPoint.spawned) {
        this.spawnPowerup(spawnPoint.position, spawnPoint.type);
        spawnPoint.spawned = true;
      }
    }
  }
}

export default PowerUpManager;
