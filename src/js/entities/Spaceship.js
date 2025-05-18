import * as THREE from 'three';

class Spaceship {
  constructor() {
    this.group = new THREE.Group();
    this.createModel();

    this.velocity = new THREE.Vector3(); // Add velocity for drift
    this.acceleration = 40; // Tune as needed
    this.damping = 0.98; // 1.0 = pure zero-g, <1 = slight friction
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
    // input: { left, right, up, down, forward, backward }

    // Apply input as acceleration (X/Y for lateral, Z for forward/back)
    if (input.left) this.velocity.x -= this.acceleration * delta;
    if (input.right) this.velocity.x += this.acceleration * delta;
    if (input.up) this.velocity.y += this.acceleration * delta;
    if (input.down) this.velocity.y -= this.acceleration * delta;
    if (input.forward) this.velocity.z -= this.acceleration * delta;
    if (input.backward) this.velocity.z += this.acceleration * delta;

    // Optionally clamp velocity to a max speed
    const maxSpeed = 30;
    this.velocity.x = THREE.MathUtils.clamp(this.velocity.x, -maxSpeed, maxSpeed);
    this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -maxSpeed, maxSpeed);
    this.velocity.z = THREE.MathUtils.clamp(this.velocity.z, -maxSpeed, maxSpeed);

    // Apply damping (simulate minimal space friction)
    this.velocity.multiplyScalar(this.damping);

    // Update group position by velocity
    this.group.position.add(this.velocity.clone().multiplyScalar(delta));
  }
}

export default Spaceship;
