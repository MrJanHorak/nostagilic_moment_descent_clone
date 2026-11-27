import { Vector3 } from 'three';
import RoomNavigation from '../core/levels/document/RoomNavigation.js';
import { hasLineOfSight, traceShot } from '../utils/combatTrace.js';

const SKILLS = Object.freeze({
  easy: { turn: 0.025, fireMs: 650, aim: 0.07, strafe: 0 },
  normal: { turn: 0.045, fireMs: 300, aim: 0.1, strafe: 1.4 },
  hard: { turn: 0.065, fireMs: 180, aim: 0.13, strafe: 2.5 },
});

/** A server-controlled Anarchy pilot. It uses the same flight, weapons and pickups as players. */
export default class BotPilot {
  /** @param {import('../levelDocument.js').LevelDocument} document @param {'easy' | 'normal' | 'hard'} [difficulty] @param {string} [id] */
  constructor(document, difficulty = 'normal', id = '') {
    this.navigation = new RoomNavigation(document);
    this.skill = SKILLS[difficulty] ?? SKILLS.normal;
    this.strafeOffset = [...id].reduce((hash, letter) => (hash * 31 + letter.charCodeAt(0)) >>> 0, 0) % 3000;
    /** @type {Vector3[]} */ this.route = [];
    this.goal = ''; this.goalRoom = null; this.replanAt = 0;
  }

  /** @param {any} game @param {any} pilot @param {any[]} opponents @param {number} lastFireMs */
  command(game, pilot, opponents, lastFireMs) {
    const ship = pilot.ship, position = ship.group.position, now = game.session.timeMs;
    const solids = game.levelManager.solidColliders ?? [];
    const enemies = opponents.filter(other => other?.alive && other.ship);
    enemies.sort((a, b) => position.distanceToSquared(a.ship.group.position) - position.distanceToSquared(b.ship.group.position));
    const enemy = enemies.find(other => hasLineOfSight(position, other.ship.group.position, solids)) ?? enemies[0];
    const visible = !!enemy && hasLineOfSight(position, enemy.ship.group.position, solids);
    const targetDistance = enemy ? position.distanceTo(enemy.ship.group.position) : Infinity;
    const inventory = pilot.weaponInventory;
    const usable = /** @param {string} type */ type => inventory[type]?.unlocked && inventory[type].ammo > 0;
    const weapon = usable('laser') ? 'laser' : usable('plasma') ? 'plasma' : targetDistance > 12 && usable('missile') ? 'missile' : usable('pulse') ? 'pulse' : null;

    // Seek real ammunition pickups before the starting supply runs dry. Taken
    // pickups are skipped until they respawn, even if they have not been rendered.
    const ammo = pilot.weaponInventory.pulse.ammo;
    const pickups = ammo <= 10 && !['laser', 'plasma', 'missile'].some(usable) ? (game.levelManager.currentLevel?.powerupSpawns ?? [])
      .filter(spot => spot.powerupType === 'pulseAmmo' && !game.powerUpManager.respawnAt.has(spot.id))
      .sort((a, b) => position.distanceToSquared(a.position) - position.distanceToSquared(b.position)) : [];
    const pickup = pickups[0];
    const destination = pickup?.position ?? enemy?.ship.group.position;
    if (!destination) return { input: {}, look: [0, 0], fire: false, weapon };
    const goal = pickup ? `pickup:${pickup.id}` : `pilot:${enemy.id}`;
    const goalRoom = this.navigation.roomAt(destination);
    const direct = !traceShot(position, destination, { colliders: solids, radius: ship.radius + 0.05 });
    let waypoint = destination;
    if (!direct) {
      if (goal !== this.goal || goalRoom !== this.goalRoom || now >= this.replanAt) {
        this.route = this.navigation.route(position, destination, ship.radius, game.levelManager.interaction?.closedConnections) ?? [];
        this.goal = goal; this.goalRoom = goalRoom; this.replanAt = now + 2500;
      }
      while (this.route.length && position.distanceToSquared(this.route[0]) < 1) this.route.shift();
      waypoint = this.route[0] ?? position;
    } else { this.route = []; this.goal = ''; }

    const fighting = !pickup && visible;
    const aim = fighting ? enemy.ship.group.position : waypoint;
    const localAim = new Vector3().subVectors(aim, position).applyQuaternion(ship.group.quaternion.clone().invert());
    const yaw = Math.atan2(-localAim.x, -localAim.z);
    const pitch = Math.atan2(localAim.y, Math.hypot(localAim.x, localAim.z));
    const turn = /** @param {number} value */ value => Math.max(-this.skill.turn, Math.min(this.skill.turn, value));

    // Limit speed near turns and use all six thrust directions to brake and fly
    // through portals even while the ship is turning.
    const travel = new Vector3().subVectors(waypoint, position), distance = travel.length();
    let speed = Math.min(4, distance * 1.5);
    if (fighting) speed = distance > 15 ? Math.min(4, (distance - 15) * 1.5) : distance < (weapon ? 7 : 13) ? -2 : 0;
    const thrust = distance > 0.001 ? travel.multiplyScalar(speed / distance) : new Vector3();
    if (fighting && distance > 8 && this.skill.strafe) {
      const side = new Vector3().subVectors(waypoint, position).cross(new Vector3(0, 1, 0)).normalize();
      const sign = Math.floor((now + this.strafeOffset) / 3000) % 2 ? 1 : -1;
      const next = position.clone().addScaledVector(side, sign * 2);
      if (this.navigation.roomAt(next) === this.navigation.roomAt(position) && !traceShot(position, next, { colliders: solids, radius: ship.radius + 0.05 })) thrust.addScaledVector(side, sign * this.skill.strafe);
    }
    thrust.sub(ship.velocity).applyQuaternion(ship.group.quaternion.clone().invert());
    const amount = /** @param {number} value */ value => Math.min(1, Math.max(0, value / 2));
    const input = { right: amount(thrust.x), left: amount(-thrust.x), up: amount(thrust.y), down: amount(-thrust.y), backward: amount(thrust.z), forward: amount(-thrust.z) };
    return { input, look: [turn(yaw), turn(pitch)], weapon, fire: !!weapon && fighting && localAim.length() < 65 && Math.abs(yaw) < this.skill.aim && Math.abs(pitch) < this.skill.aim && now - lastFireMs >= this.skill.fireMs };
  }
}
