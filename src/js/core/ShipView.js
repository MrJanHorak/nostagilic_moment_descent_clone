import * as THREE from 'three';
import { traceShot } from '../utils/combatTrace.js';

/** Presentation follows the flight root; moving a camera never moves the ship,
 * weapon origin, collision body or the headlights.
 */
export default class ShipView {
  /** @param {import('../entities/Spaceship.js').default} ship @param {THREE.PerspectiveCamera} camera */
  constructor(ship, camera) {
    this.ship = ship; this.camera = camera;
    /** @type {'hud' | 'external'} */ this.mode = 'hud';
    this.lights = new THREE.Group(); this.lights.name = 'shipHeadlights';
    for (const x of [-0.28, 0.28]) {
      const lamp = new THREE.SpotLight(0xd5efff, 3, 36, Math.PI / 6, 0.65, 1);
      lamp.position.set(x, 0, -0.4); lamp.target.position.set(x, 0, -8);
      this.lights.add(lamp, lamp.target);
    }
    ship.group.add(this.lights);
  }
  /** @param {Pick<import('../contracts.js').UserPreferences, 'cameraView' | 'headlights'>} values */
  apply(values) { this.mode = values.cameraView; this.lights.visible = values.headlights; }

  /** The camera retracts before a wall/closed door using the same convex/AABB
   * tracing as projectiles. No orbit, collision sliding or detached flight pose.
   * @param {readonly import('../contracts.js').SolidCollider[]} [colliders] */
  update(colliders = []) {
    const { ship, camera } = this;
    camera.quaternion.identity();
    if (this.mode === 'hud') {
      camera.position.set(0, 0, 0); ship.model.visible = false;
      return new THREE.Vector3(0, 0, 0);
    }
    const offset = new THREE.Vector3(0, 0.7, 4);
    const start = ship.group.position;
    ship.group.updateMatrixWorld(true);
    if (this.mode === 'external') {
      const desired = ship.viewEffects.localToWorld(offset.clone());
      const hit = traceShot(start, desired, { colliders, radius: 0.22 });
      if (hit) desired.lerpVectors(start, desired, Math.max(0, hit.fraction - 0.03));
      camera.position.copy(ship.viewEffects.worldToLocal(desired));
    } else camera.position.set(0, 0, 0);
    ship.model.visible = this.mode === 'external' && camera.position.length() > 1.3;
    ship.group.updateMatrixWorld(true);
    const end = new THREE.Vector3(0, 0, -100).applyQuaternion(ship.group.quaternion).add(start);
    const aim = traceShot(start, end, { colliders })?.point ?? end;
    return aim.project(camera);
  }
}
