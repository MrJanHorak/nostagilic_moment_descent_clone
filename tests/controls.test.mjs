import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import ControlBindings, { CONTROLS_KEY, CONTROL_ACTIONS, DEFAULT_BINDINGS, isBindableKey, keyLabel, normalizeBindings } from '../src/js/core/ControlBindings.js';
import { GamepadTracker, applyDeadzone, choosePad, readFlight } from '../src/js/core/GamepadInput.js';
import InputManager from '../src/js/core/InputManager.js';
import GameState from '../src/js/core/GameState.js';
import Spaceship from '../src/js/entities/Spaceship.js';

function memoryStorage(initial = null) {
  let value = initial;
  return { getItem(key) { assert.equal(key, CONTROLS_KEY); return value; }, setItem(key, next) { assert.equal(key, CONTROLS_KEY); value = next; } };
}

test('default bindings are the original keyboard layout and every key has one owner', () => {
  const controls = new ControlBindings(() => memoryStorage());
  assert.deepEqual(controls.values.bindings, DEFAULT_BINDINGS);
  assert.deepEqual(CONTROL_ACTIONS.map(action => action.id), Object.keys(DEFAULT_BINDINGS));
  const expected = { KeyW: 'forward', KeyS: 'backward', KeyA: 'left', KeyD: 'right', Space: 'up', ShiftLeft: 'down', ControlLeft: 'down',
    ArrowLeft: 'yawLeft', ArrowRight: 'yawRight', ArrowUp: 'pitchUp', ArrowDown: 'pitchDown', KeyQ: 'rollLeft', KeyE: 'rollRight',
    KeyF: 'fire', KeyR: 'interact', KeyM: 'map', KeyC: 'cameraView', KeyL: 'headlights', KeyH: 'showHUD',
    Digit1: 'weapon1', Digit2: 'weapon2', Digit3: 'weapon3', Digit4: 'weapon4' };
  for (const [code, action] of Object.entries(expected)) assert.equal(controls.actionFor(code), action, code);
  assert.equal(controls.actionFor('Escape'), null);
  assert.deepEqual(controls.unboundActions(), []);
  assert.ok(Object.isFrozen(controls.values) && Object.isFrozen(controls.values.bindings) && Object.isFrozen(controls.values.bindings.down));
});

test('binding moves a key from its previous action, keeps a secondary key and persists', () => {
  const storage = memoryStorage();
  const controls = new ControlBindings(() => storage);
  assert.deepEqual(controls.bind('fire', 'Space'), { ok: true, displaced: 'up' });
  assert.deepEqual(controls.values.bindings.fire, ['Space', 'KeyF']);
  assert.deepEqual(controls.values.bindings.up, []);
  assert.deepEqual(controls.unboundActions(), ['up']);
  assert.equal(controls.actionFor('Space'), 'fire');
  controls.bind('fire', 'KeyG');
  assert.deepEqual(controls.values.bindings.fire, ['KeyG', 'Space'], 'at most two keys; the oldest drops');
  assert.equal(controls.actionFor('KeyF'), null);
  assert.deepEqual(controls.bind('fire', 'KeyG'), { ok: true, displaced: null });
  controls.clear('pitchUp');
  assert.equal(controls.describe('pitchUp'), 'Unbound');
  const reloaded = new ControlBindings(() => storage);
  assert.deepEqual(reloaded.values.bindings, controls.values.bindings);
  assert.equal(reloaded.actionFor('KeyG'), 'fire');
  controls.reset();
  assert.deepEqual(new ControlBindings(() => storage).values.bindings, DEFAULT_BINDINGS);
});

test('reserved and malformed keys are rejected; hostile stored bindings are cleaned', () => {
  const controls = new ControlBindings(() => memoryStorage());
  for (const code of ['Escape', 'Tab', 'MetaLeft', 'F5', '', ' ', 'Key W', '__proto__x!', 42]) {
    assert.equal(isBindableKey(code), false, String(code));
    assert.equal(controls.bind('fire', /** @type {any} */ (code)).ok, false);
  }
  assert.equal(controls.bind(/** @type {any} */ ('teleport'), 'KeyT').ok, false);
  assert.deepEqual(controls.values.bindings, DEFAULT_BINDINGS);
  const cleaned = normalizeBindings({ forward: ['KeyW', 'KeyW', 'Escape', 7, 'KeyI', 'KeyJ'], backward: ['KeyW', 'KeyS'], fire: 'KeyF', bogus: ['KeyZ'] });
  assert.deepEqual(cleaned.forward, ['KeyW', 'KeyI']);
  assert.deepEqual(cleaned.backward, ['KeyS'], 'a key already owned earlier is dropped');
  assert.deepEqual(cleaned.fire, []);
  assert.deepEqual(cleaned.interact, ['KeyR'], 'missing actions keep their defaults');
  assert.equal(Object.hasOwn(cleaned, 'bogus'), false);
  for (const raw of ['{bad', 'null', '{"version":2,"bindings":{"fire":["KeyZ"]}}']) {
    const storage = memoryStorage(raw);
    assert.deepEqual(new ControlBindings(() => storage).values.bindings, DEFAULT_BINDINGS);
    assert.equal(storage.getItem(CONTROLS_KEY), raw);
  }
  const tuned = new ControlBindings(() => memoryStorage(JSON.stringify({ version: 1, stickSensitivity: 99, invertStickY: 'yes' })));
  assert.equal(tuned.values.stickSensitivity, 3); assert.equal(tuned.values.invertStickY, false);
  const blocked = new ControlBindings(() => { throw new Error('denied'); });
  blocked.bind('fire', 'KeyG'); assert.equal(blocked.saveStatus, 'unavailable'); assert.equal(blocked.actionFor('KeyG'), 'fire');
  assert.deepEqual(['KeyQ', 'Digit3', 'Space', 'ArrowUp', 'ShiftLeft', 'Numpad4', 'Comma'].map(keyLabel), ['Q', '3', 'Space', '↑', 'Left Shift', 'Num 4', ',']);
});

function inputFixture(controls = new ControlBindings(() => memoryStorage())) {
  const state = new GameState(); state.session.begin(); state.session.transition('playing');
  const ship = new Spaceship(); const camera = new THREE.PerspectiveCamera(); ship.attachCamera(camera);
  const fired = [], events = [];
  const fire = { fireProjectile(_state, options) { fired.push(options); } };
  const input = new InputManager(camera, fire, state, { showMessage(text) { events.push(text); }, updateHUD() {}, updateWeaponUI() {} }, null, controls);
  input.game = { session: state.session, spaceship: ship, activeAnimations: [], pauseGame: () => true, releasePointerLock() {},
    togglePause() { events.push('pause'); state.session.transition(state.session.phase === 'paused' ? 'playing' : 'paused'); return true; },
    interact() { events.push('interact'); return true; }, toggleMap() { events.push('map'); }, toggleShipOption(option) { events.push(option); } };
  return { state, ship, input, fired, events, controls };
}

test('remapped keys drive flight and actions; the old keys stop working', () => {
  const { ship, input, fired, events, controls } = inputFixture();
  controls.bind('forward', 'KeyI'); controls.bind('fire', 'KeyJ'); controls.bind('interact', 'KeyF');
  input.keyStates.KeyW = true; input.updateMovement(1 / 60);
  assert.ok(ship.velocity.z < 0, 'W stays a secondary forward key after rebinding');
  ship.velocity.set(0, 0, 0); input.clearKeys();
  controls.update({ bindings: { ...controls.values.bindings, forward: ['KeyI'] } });
  input.keyStates.KeyW = true; input.updateMovement(1 / 60); assert.equal(ship.velocity.length(), 0);
  input.clearKeys(); input.keyStates.KeyI = true; input.updateMovement(1 / 60); assert.ok(ship.velocity.z < 0);
  input.onKeyDown({ code: 'KeyJ' }); assert.equal(fired.length, 1);
  input.onKeyDown({ code: 'KeyF' }); assert.equal(fired.length, 1, 'F now activates relays instead of firing');
  assert.deepEqual(events, ['interact']);
  input.onKeyDown({ code: 'KeyJ', repeat: true }); assert.equal(fired.length, 1);
});

test('analog thrust and turning scale with deflection while keyboard behavior is unchanged', () => {
  const full = new Spaceship(), half = new Spaceship(), diagonal = new Spaceship(), single = new Spaceship();
  full.update(0.1, { forward: true }); half.update(0.1, { forward: 0.5 });
  assert.ok(Math.abs(half.velocity.length() - full.velocity.length() / 2) < 1e-9);
  diagonal.update(0.1, { forward: true, right: true }); single.update(0.1, { forward: true });
  assert.ok(Math.abs(diagonal.velocity.length() - single.velocity.length()) < 1e-9, 'diagonal keys never exceed full thrust');
  const keyTurn = new Spaceship(), stickTurn = new Spaceship();
  keyTurn.update(0.1, { yawLeft: true }); stickTurn.update(0.1, { yawLeft: 2 });
  const angle = ship => 2 * Math.acos(Math.min(1, Math.abs(ship.group.quaternion.w)));
  assert.ok(Math.abs(angle(stickTurn) - 2 * angle(keyTurn)) < 1e-9);
  const clamped = new Spaceship(); clamped.update(0.1, { yawLeft: 50, forward: 9, backward: Number.NaN });
  assert.ok(angle(clamped) <= 3 * clamped.rotationSpeed * 0.1 + 1e-9);
  assert.ok(clamped.velocity.length() <= full.velocity.length() + 1e-9);
});

function pad(overrides = {}) {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  for (const [index, value] of Object.entries(overrides.buttons ?? {})) buttons[Number(index)] = { pressed: value >= 0.5, value };
  return { id: overrides.id ?? 'Test pad', index: 0, connected: true, mapping: 'standard', axes: overrides.axes ?? [0, 0, 0, 0], buttons };
}

test('sticks use a radial deadzone, map to flight directions and honor stick inversion', () => {
  assert.deepEqual(applyDeadzone(0.1, -0.1), { x: 0, y: 0 });
  const edge = applyDeadzone(1, 0); assert.ok(Math.abs(edge.x - 1) < 1e-12);
  const mid = applyDeadzone(0, 0.575); assert.ok(Math.abs(mid.y - 0.5) < 1e-9);
  assert.deepEqual(applyDeadzone(Number.NaN, Infinity), { x: 0, y: 0 });
  const flight = readFlight(pad({ axes: [0.5, -1, -1, -1], buttons: { 0: 1, 5: 0.6 } }));
  // A diagonal beyond the unit circle is clamped to full deflection along its direction.
  assert.ok(Math.abs(Math.hypot(flight.forward, flight.right) - 1) < 1e-9 && flight.backward === 0 && flight.right > 0 && flight.left === 0);
  assert.ok(flight.yawLeft > 0 && flight.pitchUp > 0 && flight.pitchDown === 0);
  assert.equal(flight.up, 1); assert.equal(flight.rollRight, 1, 'a pressed digital bumper is full roll');
  assert.equal(readFlight(pad({ buttons: { 5: 0.3 } })).rollRight, 0.3, 'an analog partial press stays partial');
  const inverted = readFlight(pad({ axes: [0, 0, 0, -1] }), { invertY: true });
  assert.ok(inverted.pitchDown > 0.99 && inverted.pitchUp === 0);
  assert.equal(choosePad([null, { ...pad(), mapping: '', id: 'raw' }, pad({ id: 'std' })])?.id, 'std');
  assert.equal(choosePad([{ ...pad(), connected: false }]), null);
});

test('button presses fire once per press, ignore buttons held when a pad connects and survive disconnects', () => {
  const tracker = new GamepadTracker();
  assert.deepEqual(tracker.presses(pad({ buttons: { 7: 1 } })), [], 'a trigger already held at connection does not fire');
  assert.deepEqual(tracker.presses(pad({ buttons: { 7: 1 } })), []);
  assert.deepEqual(tracker.presses(pad()), []);
  assert.deepEqual(tracker.presses(pad({ buttons: { 7: 0.4 } })), [], 'triggers need half travel');
  assert.deepEqual(tracker.presses(pad({ buttons: { 7: 0.8, 2: 1 } })), [2, 7]);
  assert.deepEqual(tracker.presses(pad({ buttons: { 7: 0.9, 2: 1 } })), []);
  assert.deepEqual(tracker.presses(null), []);
  assert.deepEqual(tracker.presses(pad({ buttons: { 7: 1 } })), [], 'reconnecting with the trigger held does not fire');
});

test('the controller flies the ship, fires, cycles weapons, pauses and goes neutral when paused', () => {
  const { state, ship, input, fired, events } = inputFixture();
  let current = pad();
  const poll = (next) => { current = next; return input.pollGamepad(() => [current], 1000); };
  poll(pad());
  assert.deepEqual(events, ['CONTROLLER CONNECTED · Settings lists the layout']);
  poll(pad({ axes: [0, -1, 0, 0] })); input.updateMovement(1 / 60);
  assert.ok(ship.velocity.z < 0, 'left stick up thrusts forward');
  poll(pad({ buttons: { 7: 1 } })); poll(pad()); poll(pad({ buttons: { 7: 1 } }));
  assert.equal(fired.length, 2); assert.deepEqual(fired[0], { requirePointerLock: false });
  state.weaponInventory.laser.unlocked = true; state.weaponInventory.plasma.unlocked = true;
  poll(pad({ buttons: { 3: 1 } })); assert.equal(state.currentWeapon, 'laser');
  poll(pad()); poll(pad({ buttons: { 3: 1 } })); assert.equal(state.currentWeapon, 'plasma', 'locked missiles are skipped');
  poll(pad()); poll(pad({ buttons: { 6: 1 } })); assert.equal(state.currentWeapon, 'laser');
  poll(pad()); poll(pad({ buttons: { 2: 1, 12: 1 } })); assert.deepEqual(events.slice(1), ['interact', 'map']);
  poll(pad()); poll(pad({ buttons: { 9: 1 }, axes: [0, -1, 1, 0] }));
  assert.equal(state.session.phase, 'paused');
  assert.ok(Object.values(input.analog).every(value => value === 0), 'no stick input is kept while paused');
  poll(pad({ buttons: { 7: 1 } })); assert.equal(fired.length, 2, 'triggers do nothing while paused');
  poll(pad()); poll(pad({ buttons: { 9: 1 } })); assert.equal(state.session.phase, 'playing', 'Menu resumes');
  input.pollGamepad(() => [], 2000); assert.equal(events.at(-1), 'CONTROLLER DISCONNECTED');
  assert.ok(Object.values(input.analog).every(value => value === 0));
  assert.deepEqual(input.pollGamepad(() => { throw new Error('blocked'); }), []);
});
