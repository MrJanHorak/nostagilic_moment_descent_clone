import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import SessionRandom from '../src/js/core/SessionRandom.js';
import GameSession from '../src/js/core/GameSession.js';
import { headlessGame } from './helpers/headlessGame.mjs';

test('a seed always produces the same sequence, and different seeds differ', () => {
  const a = new SessionRandom(42), b = new SessionRandom(42), c = new SessionRandom(43);
  const first = Array.from({ length: 8 }, () => a.next());
  assert.deepEqual(Array.from({ length: 8 }, () => b.next()), first);
  assert.notDeepEqual(Array.from({ length: 8 }, () => c.next()), first);
  assert(first.every(value => value >= 0 && value < 1));
  assert.throws(() => new SessionRandom(Number.NaN), /finite/);
});

test('each session reseeds: a given seed repeats, and a fresh session draws a new one', () => {
  const session = new GameSession();
  session.begin(7); const first = [session.random(), session.random()]; assert.equal(session.seed, 7);
  session.end(); session.begin(7); assert.deepEqual([session.random(), session.random()], first);
  session.end(); session.begin(); assert.ok(Number.isInteger(session.seed) && session.seed >= 0);
});

/** Robots' positions, health, attack phases and shots after a fixed run. */
function runCrossfire(game, seed, seconds) {
  game.startSession({ endless: false, levelIndex: game.levelManager.levels.findIndex(level => level.id === 'crossfire-relay'), seed });
  // Hover in the fighter's view so robots fight; the ship never steers, so only the seed varies.
  game.spaceship.group.position.set(-3, 0, -24);
  for (let step = 0; step < seconds * 60; step++) game.updateSimulation(1 / 60);
  return JSON.stringify({
    time: Math.round(game.session.timeMs), health: game.gameState.playerHealth,
    robots: game.enemyManager.enemies.map(enemy => ({ id: enemy.mesh.userData.spawnPointId, p: enemy.mesh.position.toArray().map(value => value.toFixed(4)), hp: enemy.health, fire: enemy.fireRate, phase: enemy.fighterAttack?.phase ?? enemy.scoutAttack?.phase })),
    shots: game.enemyManager.projectileManager.enemyProjectiles.map(shot => shot.mesh.position.toArray().map(value => value.toFixed(4))),
  });
}

test('the same seed replays a live encounter exactly; another seed diverges', t => {
  const game = headlessGame(t);
  const first = runCrossfire(game, 1234, 8), again = runCrossfire(game, 1234, 8), other = runCrossfire(game, 99, 8);
  assert.equal(again, first, 'identical seed and inputs must give identical robots, shots and damage');
  assert.ok(JSON.parse(first).health < 100, 'the robots really fought: the ship took hits');
  assert.notEqual(other, first, 'a different seed changes fire timing');
});

test('pilots own their shields, weapons and boosts; single-player properties are views of the local pilot', async () => {
  const { default: GameState } = await import('../src/js/core/GameState.js');
  const state = new GameState(), feedback = [];
  state.setReferences(null, { playSound: name => feedback.push(name) }, { updateHUD() { feedback.push('hud'); }, updateWeaponUI() { feedback.push('weapons'); }, flash() { feedback.push('flash'); }, showMessage() {} }, [], { die: () => { feedback.push('die'); return true; } });
  state.session.begin(5); state.session.transition('playing');
  const wing = state.addPilot({ id: 'wing' });
  assert.throws(() => state.addPilot({ id: 'wing' }), /already/);
  assert.equal(state.pilots.length, 2); assert.equal(state.pilot('wing'), wing); assert.equal(wing.local, false);

  state.playerHealth = 80; assert.equal(state.localPilot.health, 80, 'old property writes reach the local pilot');
  feedback.length = 0;
  state.takeDamage(30, wing);
  assert.equal(wing.health, 70); assert.equal(state.playerHealth, 80);
  assert.deepEqual(feedback, [], 'damage to a remote pilot never reaches this screen: no HUD or audio');
  state.takeDamage(10);
  assert.equal(state.playerHealth, 70); assert(feedback.includes('playerDamage') && feedback.includes('hud'));

  state.addWeaponAmmo('laser', 5, wing); assert.equal(wing.weaponInventory.laser.ammo, 5); assert.equal(state.weaponInventory.laser.unlocked, false);
  assert.equal(state.switchWeapon('laser', wing), true); assert.equal(wing.currentWeapon, 'laser'); assert.equal(state.currentWeapon, 'pulse');
  state.applyTimedModifier('speedMultiplier', 1.5, 1000, 'done', wing);
  assert.equal(wing.speedMultiplier, 1.5); assert.equal(state.speedMultiplier, 1);
  state.session.advance(1.1); assert.equal(wing.speedMultiplier, 1, 'each pilot boost expires on its own');

  feedback.length = 0;
  state.takeDamage(500, wing);
  assert.equal(wing.alive, false); assert.equal(feedback.includes('die'), false, 'a remote pilot going down does not end the mission here');
  state.takeDamage(5, wing); assert.equal(wing.health, 0);
  state.takeDamage(500); assert(feedback.includes('die'), 'the local pilot going down still ends the mission');

  state.session.end(); state.session.begin(); state.resetForSession();
  assert.deepEqual(state.pilots.map(pilot => [pilot.health, pilot.alive, pilot.currentWeapon]), [[100, true, 'pulse'], [100, true, 'pulse']]);
  assert.equal(state.removePilot('local'), false); assert.equal(state.removePilot('wing'), true); assert.equal(state.pilots.length, 1);
});

/** Start Crossfire Relay with the local ship plus a wingmate, both at the spawn. */
function twoPilotCrossfire(t, seed = 77) {
  const game = headlessGame(t);
  const wing = game.addPilot('wing');
  game.startSession({ endless: false, levelIndex: game.levelManager.levels.findIndex(level => level.id === 'crossfire-relay'), seed });
  game.updateSimulation(1 / 60); // Robots spawn on the first step.
  return { game, wing };
}
/** @param {import('three').Object3D} ship @param {import('three').Vector3} target */
const face = (ship, target) => ship.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), target.clone().sub(ship.position).normalize());

test('robots attack the pilot they can see; the hidden pilot is left alone, and targets switch when the view changes', t => {
  const { game, wing } = twoPilotCrossfire(t);
  const fighter = game.enemyManager.enemies.find(enemy => enemy.mesh.userData.spawnPointId === 'crossfire:fighter');
  // The local ship waits at the spawn, out of sight; the wingmate hovers in the fighter's view.
  wing.ship.group.position.set(-3, 0, -24);
  for (let step = 0; step < 6 * 60; step++) game.updateSimulation(1 / 60);
  assert.equal(fighter.target?.id, 'wing');
  assert.ok(wing.health < 100, 'the visible wingmate takes fire');
  assert.equal(game.gameState.playerHealth, 100, 'the hidden local pilot is not hit');
  assert.equal(game.session.phase, 'playing');
  // Swap: the wingmate retreats to the spawn and the local ship moves into view.
  wing.ship.group.position.set(8, 0, 5);
  game.spaceship.group.position.set(-3, 0, -24);
  const wingHealth = wing.health;
  for (let step = 0; step < 6 * 60; step++) game.updateSimulation(1 / 60);
  assert.equal(fighter.target?.id, 'local');
  assert.ok(game.gameState.playerHealth < 100, 'fire follows the new target');
  assert.equal(wing.health, wingHealth);
});

test('a wingmate flies with their own commands, collides with walls and fires shots that carry their id', t => {
  const { game, wing } = twoPilotCrossfire(t);
  const start = wing.ship.group.position.clone();
  game.setPilotInput('wing', { forward: true });
  for (let step = 0; step < 20 * 60; step++) game.updateSimulation(1 / 60);
  assert.ok(wing.ship.group.position.distanceTo(start) > 5, 'the held command moves the ship');
  assert.ok(game.levelManager.solidColliders.every(collider => !('box' in collider) || !collider.box.containsPoint(wing.ship.group.position)), 'walls stop it');
  assert.ok(game.spaceship.group.position.distanceTo(start) < 0.5, 'the local ship did not move');
  game.setPilotInput('wing', {});
  const shot = game.pilotFire('wing');
  assert.equal(shot?.ownerId, 'wing');
  assert.throws(() => game.pilotFire('local'), /No remote pilot/);
});

test('kills are credited to the pilot who fired; score stays shared', t => {
  const { game, wing } = twoPilotCrossfire(t);
  const scout = game.enemyManager.enemies.find(enemy => enemy.mesh.userData.spawnPointId === 'crossfire:scout');
  wing.ship.group.position.set(14.5, 0, -24);
  for (let shot = 0; scout.isActive && shot < 20; shot++) {
    face(wing.ship.group, scout.mesh.position); wing.ship.group.updateMatrixWorld(true);
    game.pilotFire('wing');
    for (let frame = 0; frame < 12; frame++) game.updateSimulation(1 / 60);
  }
  assert.equal(scout.isActive, false, 'the wingmate destroyed the scout');
  assert.equal(wing.kills, 1); assert.equal(game.gameState.localPilot.kills, 0);
  assert.ok(game.gameState.score >= scout.type.pointValue, 'the shared score includes the kill');
});

test('pickups go to the pilot who touches them, with their own loadout', t => {
  const { game, wing } = twoPilotCrossfire(t);
  wing.health = 40; game.gameState.playerHealth = 60;
  wing.ship.group.position.set(22, 0, -4);
  for (let step = 0; step < 10; step++) game.updateSimulation(1 / 60);
  assert.equal(wing.health, 65, 'the repair pickup restores a quarter of the wingmate\\u2019s shields');
  assert.equal(game.gameState.playerHealth, 60, 'the local pilot is untouched');
  wing.weaponInventory.pulse.ammo = 10; wing.pulseAmmoCapacity = 80; game.gameState.weaponInventory.pulse.ammo = 5; game.gameState.pulseAmmoCapacity = 80;
  wing.ship.group.position.set(18, 0, 0);
  for (let step = 0; step < 10; step++) game.updateSimulation(1 / 60);
  assert.equal(wing.weaponInventory.pulse.ammo, 30); assert.equal(game.gameState.weaponInventory.pulse.ammo, 5);
});

test('two pilots with the same seed and the same commands replay identically', t => {
  const run = () => {
    const { game, wing } = twoPilotCrossfire(t, 2024);
    const snapshot = [];
    for (let step = 0; step < 10 * 60; step++) {
      if (step === 0) game.setPilotInput('wing', { forward: true, yawLeft: 0.3 });
      if (step === 120) game.setPilotInput('wing', { up: true });
      if (step === 300) game.setPilotInput('wing', { forward: 0.5, yawRight: true });
      if (step % 45 === 0) game.pilotFire('wing');
      game.updateSimulation(1 / 60);
      if (step % 60 === 59) snapshot.push([wing.ship.group.position.toArray().map(v => v.toFixed(5)), wing.health, game.gameState.playerHealth,
        game.enemyManager.enemies.map(enemy => [enemy.mesh.position.toArray().map(v => v.toFixed(5)), enemy.health, enemy.target?.id])]);
    }
    game.endSession(); game.removePilot('wing');
    return JSON.stringify(snapshot);
  };
  assert.equal(run(), run());
});

test('a bomb blast damages every pilot in range with a clear line to it', t => {
  const { game, wing } = twoPilotCrossfire(t);
  const shots = game.enemyManager.projectileManager;
  const bomber = { mesh: new THREE.Object3D(), type: { name: 'bomber', size: 0.8 } };
  bomber.mesh.position.set(8, 0, -2);
  game.spaceship.group.position.set(8, 0, 6); wing.ship.group.position.set(9, 0, 5);
  const bomb = shots.fireBomb(bomber, new THREE.Vector3(8.5, 0, 5.5));
  assert.ok(bomb); bomb.mesh.position.set(8.5, 0, 5.5);
  shots.detonateBomb(bomb, game.spaceship.group, game.gameState, null);
  assert.ok(game.gameState.playerHealth < 100, 'the local pilot is caught in the blast');
  assert.ok(wing.health < 100, 'so is the wingmate');
  const far = game.addPilot('far'); far.ship.group.position.set(8, 0, -30);
  const again = shots.fireBomb(bomber, new THREE.Vector3(8.5, 0, 5.5)); again.mesh.position.set(8.5, 0, 5.5);
  shots.detonateBomb(again, game.spaceship.group, game.gameState, null);
  assert.equal(far.health, 100, 'a pilot out of range is unharmed');
});
