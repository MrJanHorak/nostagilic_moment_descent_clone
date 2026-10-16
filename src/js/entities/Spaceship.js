import * as THREE from 'three';
import { PLAYER_RADIUS } from '../core/levels/document/LevelContent.js';

class Spaceship {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'playerRoot';
    this.model = new THREE.Group();
    this.model.name = 'externalShipModel';
    this.model.visible = false;
    this.viewEffects = new THREE.Group();
    this.viewEffects.name = 'viewEffects';
    this.group.add(this.model, this.viewEffects);
    this.createModel();

    this.velocity = new THREE.Vector3(); // Add velocity for drift
    this.acceleration = 8; // Lowered for better control
    this.damping = 0.96; // Slightly more friction
    this.maxSpeed = 6; // Cap the max speed

    this.rotationSpeed = 1.5; // Radians/second for keyboard rotation
    this.radius = PLAYER_RADIUS;
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
    this.model.add(body);

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
    this.model.add(cockpit);

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
    this.model.add(nose);

    // === Wings (Flatter, Sleeker) ===
    const wingGeometry = new THREE.BoxGeometry(1.2, 0.05, 0.3);
    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e1e1e,
      metalness: 0.6,
      roughness: 0.3,
    });
    const wings = new THREE.Mesh(wingGeometry, wingMaterial);
    wings.position.set(0, -0.05, 0.25);
    this.model.add(wings);

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
    this.model.add(engine);

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
    this.model.add(leftThruster);

    const rightThruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
    rightThruster.position.set(0.35, 0, 0.3);
    rightThruster.rotation.x = Math.PI / 2;
    this.model.add(rightThruster);
  }

  // Mount the first-person camera once; the root is the only gameplay pose.
  /** @param {THREE.Camera} camera */
  attachCamera(camera) {
    const scene = camera.parent;
    this.group.position.copy(camera.position);
    this.group.quaternion.copy(camera.quaternion);
    this.viewEffects.add(camera);
    camera.position.set(0, 0, 0);
    camera.quaternion.identity();
    scene?.add(this.group);
  }

  reset() {
    this.group.position.set(0, 0, 5);
    this.group.quaternion.identity();
    this.velocity.set(0, 0, 0);
    this.viewEffects.position.set(0, 0, 0);
  }

  // Ordered, intrinsic yaw -> pitch -> roll. No world-up constraint.
  /** @param {number} [yaw] @param {number} [pitch] @param {number} [roll] */
  rotate(yaw = 0, pitch = 0, roll = 0) {
    this.group.rotateY(yaw);
    this.group.rotateX(pitch);
    this.group.rotateZ(roll);
    this.group.quaternion.normalize();
  }

  // Integrate world velocity; Game resolves collision before committing position.
  /** @param {number} delta @param {import('../contracts.js').FlightInput} [input]
   * @param {number} [speedMultiplier]
   */
  update(delta, input = {}, speedMultiplier = 1) {
    this.rotate(
      ((+!!input.yawLeft) - (+!!input.yawRight)) * this.rotationSpeed * delta,
      ((+!!input.pitchUp) - (+!!input.pitchDown)) * this.rotationSpeed * delta,
      ((+!!input.rollLeft) - (+!!input.rollRight)) * this.rotationSpeed * delta
    );
    const thrust = new THREE.Vector3(
      (+!!input.right) - (+!!input.left),
      (+!!input.up) - (+!!input.down),
      (+!!input.backward) - (+!!input.forward)
    );
    if (thrust.lengthSq() > 0) {
      thrust.normalize().applyQuaternion(this.group.quaternion);
      this.velocity.addScaledVector(thrust, this.acceleration * speedMultiplier * delta);
    } else this.velocity.multiplyScalar(Math.pow(this.damping, delta * 60));
    this.velocity.clampLength(0, this.maxSpeed * speedMultiplier);
  }
}

export default Spaceship;
