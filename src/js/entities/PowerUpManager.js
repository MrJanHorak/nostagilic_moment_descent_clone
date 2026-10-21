// PowerUp Manager for handling all power-ups in the game
import * as THREE from 'three';
import { hasLineOfSight } from '../utils/combatTrace.js';
import { AUTHORED_PICKUPS } from '../core/levels/document/LevelContent.js';

// Power-up type definitions
export const powerupTypes = [
  {
    ...AUTHORED_PICKUPS.health,
    canCollect: (state) => state.playerHealth < state.maxPlayerHealth,
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
    ...AUTHORED_PICKUPS.pulseAmmo, duration: 0,
    canCollect: (state) => Number.isFinite(state.weaponInventory.pulse.ammo) &&
      state.weaponInventory.pulse.ammo < state.pulseAmmoCapacity,
    effect(state, ui) {
      const weapon = state.weaponInventory.pulse;
      const before = weapon.ammo;
      weapon.ammo = Math.min(state.pulseAmmoCapacity, weapon.ammo + 20);
      ui.updateWeaponUI();
      ui.showMessage(`PULSE AMMO +${weapon.ammo - before}`, 2000, '#ffa64d');
    },
    message: 'Pulse ammo refilled',
  },
  {
    name: 'speedBoost',
    color: 0x00ffff,
    size: 0.5,
    duration: 10000,
    effect: function (gameState, uiManager) {
      // Boost player speed
      gameState.applyTimedModifier('speedMultiplier', 1.5, 10000, 'Speed Boost Ended');
      uiManager.showMessage('Speed Boost!', 2000, '#00ffff');

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
      gameState.applyTimedModifier('weaponPower', 2, 15000, 'Weapon Upgrade Ended');
      uiManager.showMessage('Weapons Upgraded!', 2000, '#ffff00');

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
    playerTransform,
    gameState,
    audioManager,
    uiManager,
    levelManager = null
  ) {
    this.scene = scene;
    this.playerTransform = playerTransform;
    this.gameState = gameState;
    this.audioManager = audioManager;
    this.uiManager = uiManager;
    this.levelManager = levelManager; // Add this
    this.powerups = [];
    this.spawnedIds = new Set();
    this.nextId = 0;
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

    // Emissive core/ring provide the glow in finite arenas. Adding/collecting
    // a pickup must not recompile the entire mine's lighting shaders.
    if (this.levelManager?.currentLevel?.kind !== 'arena') {
      const pointLight = new THREE.PointLight(powerupType.color, 1, 3);
      powerupGroup.add(pointLight);
    }

    return powerupGroup;
  }

  // Spawn a power-up at a position
  spawnPowerup(position, typeName = null, { persistent = false, spawnId = null } = {}) {
    // If no specific type requested, choose randomly
    const randomTypes = powerupTypes.filter(type => type.name !== 'pulseAmmo' || Number.isFinite(this.gameState?.weaponInventory.pulse.ammo));
    const powerupType = typeName
      ? powerupTypes.find((t) => t.name === typeName)
      : randomTypes[Math.floor(Math.random() * randomTypes.length)];

    if (!powerupType) {
      throw new RangeError(`Unknown power-up type: ${typeName}`);
    }

    const powerupMesh = this.createPowerupMesh(powerupType);
    powerupMesh.position.copy(position);

    // Add unique identifier to mesh
    powerupMesh.userData.powerupId = `${this.gameState?.session.id ?? 0}:pickup:${++this.nextId}`;

    const powerup = {
      mesh: powerupMesh,
      type: powerupType,
      id: powerupMesh.userData.powerupId,
      spawnId,
      collisionRadius: powerupType.size * 0.7,
      age: 0,
      lifetime: persistent ? Infinity : 20,
      baseY: position.y,
      rotationSpeed: 0.5 + Math.random() * 0.5,
      floatFrequency: 0.5 + Math.random() * 0.5,
      floatAmplitude: 0.1 + Math.random() * 0.1,
    };

    this.powerups.push(powerup);
    this.scene.add(powerupMesh);

    return powerup;
  }

  // Update power-ups, check for collisions with player
  update(delta = 0) {
    if (this.gameState?.session.phase !== 'playing') return;
    if (!this.levelManager?.isEndless) this.spawnPredefinedPowerUps();
    const playerPosition = new THREE.Vector3();
    this.playerTransform.getWorldPosition(playerPosition);

    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const powerup = this.powerups[i];
      powerup.age += delta;
      if (powerup.age >= powerup.lifetime) {
        this.removePowerup(powerup.id);
        continue;
      }
      powerup.mesh.rotation.y += powerup.rotationSpeed * delta;
      powerup.mesh.position.y = powerup.baseY + Math.sin(powerup.age * powerup.floatFrequency) * powerup.floatAmplitude;
      powerup.mesh.children[1].rotation.x += powerup.rotationSpeed * delta * 0.7;
      powerup.mesh.children[1].rotation.z += powerup.rotationSpeed * delta * 0.5;
      const distance = powerup.mesh.position.distanceTo(playerPosition);

      // Check collision with player
      if (distance < powerup.collisionRadius + 0.5 &&
        (powerup.type.canCollect?.(this.gameState) ?? true) &&
        hasLineOfSight(playerPosition, powerup.mesh.position, this.levelManager?.solidColliders)) {
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
    this.playerTransform.getWorldPosition(playerPosition);

    const playerDirection = new THREE.Vector3(0, 0, -1);
    playerDirection.applyQuaternion(this.playerTransform.quaternion);

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

    for (const [index, spawnPoint] of level.powerupSpawns.entries()) {
      const spawnId = spawnPoint.id ?? `pickup:${index}`;
      // Check if power-up should be visible now (based on player position)
      const distanceToPlayer = spawnPoint.position.distanceTo(
        this.playerTransform.position
      );

      // Only spawn if within reasonable distance and not already spawned
      if (distanceToPlayer < 50 && !this.spawnedIds.has(spawnId)) {
        this.spawnPowerup(spawnPoint.position, spawnPoint.powerupType, { persistent: true, spawnId });
        this.spawnedIds.add(spawnId);
      }
    }
  }

  // Move all power-ups by offset (Vector3)
  offsetPowerUps(offset) {
    for (const powerUp of this.powerups) {
      if (powerUp && powerUp.mesh && powerUp.mesh.position) {
        powerUp.mesh.position.add(offset);
        powerUp.baseY += offset.y;
      }
    }
  }

  clear() {
    for (const powerup of [...this.powerups]) this.removePowerup(powerup.id);
    this.spawnedIds.clear();
  }
}

export default PowerUpManager;
