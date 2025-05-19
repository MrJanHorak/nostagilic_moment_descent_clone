import * as THREE from 'three';

class Spaceship {
  constructor() {
    this.group = new THREE.Group();
    this.createModel();

    this.velocity = new THREE.Vector3(); // Add velocity for drift
    this.acceleration = 8; // Lowered for better control
    this.damping = 0.96; // Slightly more friction
    this.maxSpeed = 6; // Cap the max speed

    this.pitch = 0; // Radians, for nose up/down
    this.pitchSpeed = 1.5; // Radians per second
    this.maxPitch = Math.PI / 3; // Clamp to +/- 60 degrees
  }

  createModel() {
    // === Main Body ===
    const bodyGeometry = new THREE.BoxGeometry(0.6, 0.25, 1);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c2c2c,
      roughness: 0.3,
      metalness: 0.8,
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.group.add(body);

    // === Cockpit Dome ===
    const cockpitGeometry = new THREE.SphereGeometry(
      0.25,
      32,
      32,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2
    );
    const cockpitMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x44ccff,
      transparent: true,
      opacity: 0.75,
      roughness: 0,
      metalness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.2, -0.25);
    cockpit.rotation.x = Math.PI;
    this.group.add(cockpit);

    // === Red Nose Cone ===
    const noseGeometry = new THREE.ConeGeometry(0.18, 0.4, 24);
    const noseMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc0000,
      roughness: 0.2,
      metalness: 0.6,
    });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.z = -0.75;
    nose.rotation.x = Math.PI / 2;
    this.group.add(nose);

    // === Wings (Flatter, Sleeker) ===
    const wingGeometry = new THREE.BoxGeometry(1.2, 0.05, 0.3);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e1e1e,
      metalness: 0.6,
      roughness: 0.3,
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.set(0, -0.05, 0.25);
    this.group.add(wings);

    // === Engine Glow ===
    const engineGlowGeometry = new THREE.CylinderGeometry(0.08, 0.12, 0.12, 20);
    const engineMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.9,
    });
    const engine = new THREE.Mesh(engineGlowGeometry, engineMaterial);
    engine.position.z = 0.6;
    engine.rotation.x = Math.PI / 2;
    this.group.add(engine);

    // === Side Thrusters (Rounder, Stylized) ===
    const thrusterGeometry = new THREE.CylinderGeometry(0.04, 0.06, 0.12, 16);
    const thrusterMaterial = new THREE.MeshStandardMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.6,
    });

    const leftThruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
    leftThruster.position.set(-0.35, 0, 0.3);
    leftThruster.rotation.x = Math.PI / 2;
    this.group.add(leftThruster);

    const rightThruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
    rightThruster.position.set(0.35, 0, 0.3);
    rightThruster.rotation.x = Math.PI / 2;
    this.group.add(rightThruster);
  }

  attachToCamera(camera) {
    this.group.position.set(0, -0.2, -1.5);
    camera.add(this.group);
  }

  update(delta, input) {
    // delta: time since last frame in seconds
    // input: { left, right, up, down, forward, backward, pitchUp, pitchDown }

    // Pitch control (nose up/down)
    if (input.pitchUp) this.pitch += this.pitchSpeed * delta;
    if (input.pitchDown) this.pitch -= this.pitchSpeed * delta;
    // Clamp pitch
    this.pitch = Math.max(-this.maxPitch, Math.min(this.maxPitch, this.pitch));
    this.group.rotation.x = this.pitch;

    // Apply input as acceleration (X/Y for lateral, Z for forward/back)
    let inputApplied = false;
    if (input.left) {
      this.velocity.x -= this.acceleration * delta;
      inputApplied = true;
    }
    if (input.right) {
      this.velocity.x += this.acceleration * delta;
      inputApplied = true;
    }
    if (input.up) {
      this.velocity.y += this.acceleration * delta;
      inputApplied = true;
    }
    if (input.down) {
      this.velocity.y -= this.acceleration * delta;
      inputApplied = true;
    }
    if (input.forward) {
      this.velocity.z -= this.acceleration * delta;
      inputApplied = true;
    }
    if (input.backward) {
      this.velocity.z += this.acceleration * delta;
      inputApplied = true;
    }

    // Clamp velocity to max speed
    this.velocity.clampLength(0, this.maxSpeed);

    // Only apply damping if no input is being applied
    if (!inputApplied) {
      this.velocity.multiplyScalar(this.damping);
    }
    // (Position update is now handled by main.js via tunnel offset)
  }
}

export default Spaceship;
