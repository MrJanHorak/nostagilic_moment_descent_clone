import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import MatchRoom from '../src/js/net/MatchRoom.js';
import LagHistory, { MAX_REWIND_MS, rewindFor } from '../src/js/net/LagCompensation.js';
import { parseClientMessage } from '../src/js/net/Protocol.js';

const pilot = (id, x) => ({ id, alive: true, ship: { group: { position: new THREE.Vector3(x, 0, 0) } } });

test('rewind is round trip plus interpolation, capped', () => {
  assert.equal(rewindFor(null), 0); assert.equal(rewindFor(-5), 0);
  assert.equal(rewindFor(60), 160);
  assert.equal(rewindFor(5000), MAX_REWIND_MS, 'a huge or faked ping gets no extra rewind');
});

test('the input message carries a clamped round trip', () => {
  const parse = rtt => /** @type {any} */ (parseClientMessage(JSON.stringify({ t: 'input', seq: 1, rtt }))).message;
  assert.equal(parse(87.4).rtt, 87); assert.equal(parse(99999).rtt, 1000);
  assert.equal('rtt' in parse(-3), false); assert.equal('rtt' in parse('x'), false);
});

test('history interpolates past positions, skips respawn jumps and resets with the session clock', () => {
  const history = new LagHistory(), a = pilot('a', 0), box = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1)), robot = { isActive: true, collider: box };
  history.record(0, [a], [robot]);
  a.ship.group.position.x = 2; box.translate(new THREE.Vector3(2, 0, 0));
  history.record(100, [a], [robot]);
  const view = history.view(50);
  assert.equal(view.pilotPosition('a').x, 1);
  assert.equal(view.enemyBox(robot).min.x, 1);
  assert.equal(view.pilotPosition('nobody'), null);
  a.ship.group.position.x = 80; history.record(200, [a], [robot]);
  assert.equal(history.view(150).pilotPosition('a').x, 80, 'a respawn teleport is never interpolated');
  history.record(10, [a], [robot]);
  assert.equal(history.frames.length, 1, 'a new session drops the old timeline');
  for (let t = 20; t < 2000; t += 16) history.record(t, [a], [robot]);
  assert.ok(history.frames[0].timeMs >= 2000 - MAX_REWIND_MS - 120, 'only a short history is kept');
});

/** Two pilots in Foundry Ring, 14 units apart. A fires straight at B. Just before
 * the shot arrives, B side-steps: the shooter (with a 50 ms round trip, so a 150 ms
 * rewind) has not seen that yet, so the shot should land. */
function duel(t, compensate) {
  t.mock.method(console, 'log', () => {});
  const match = new MatchRoom({ code: 'LAGC', seed: 3 });
  t.after(() => match.dispose());
  match.lagCompensation = compensate;
  const a = match.join('A'), b = match.join('B');
  const game = match.game, shooter = game.gameState.pilot(a.id), target = game.gameState.pilot(b.id);
  // The largest room of the arena gives a clear line.
  const room = [...game.levelManager.currentLevel.sourceDocument.rooms].sort((x, y) => y.size[0] * y.size[2] - x.size[0] * x.size[2])[0];
  const center = new THREE.Vector3(...room.position);
  const still = () => { for (const p of [shooter, target]) { p.ship.velocity.set(0, 0, 0); p.input = {}; } };
  shooter.ship.group.position.set(center.x, center.y, center.z + 7); target.ship.group.position.set(center.x, center.y, center.z - 7);
  shooter.ship.group.quaternion.identity();
  for (let i = 0; i < 30; i++) { still(); match.step(); }
  match.input(a.id, /** @type {any} */ (parseClientMessage(JSON.stringify({ t: 'input', seq: 1, fire: true, rtt: 50 }))).message);
  const shot = game.projectileManager.projectiles.at(-1), before = target.health;
  // Fly the shot until it is about 100 ms from B, then B dodges 3 units sideways.
  for (let i = 0; i < 200 && shot.mesh.position.z > target.ship.group.position.z + 2.5; i++) { still(); match.step(); }
  target.ship.group.position.x += 3;
  for (let i = 0; i < 40; i++) { still(); match.step(); }
  return { hit: target.health < before, rewound: shot.rewindMs };
}

test('lag compensation: a shot at where the target was on the shooter\'s screen hits', t => {
  const result = duel(t, true);
  assert.equal(result.rewound, 150);
  assert.equal(result.hit, true);
});

test('without lag compensation the same shot misses (control)', t => {
  assert.equal(duel(t, false).hit, false);
});
