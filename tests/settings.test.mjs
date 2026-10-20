import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import UserSettings, { DEFAULT_SETTINGS, SETTINGS_KEY } from '../src/js/core/UserSettings.js';
import InputManager from '../src/js/core/InputManager.js';
import Spaceship from '../src/js/entities/Spaceship.js';
import GameState from '../src/js/core/GameState.js';

function memoryStorage(initial = null) {
  let value = initial;
  return { getItem(key) { assert.equal(key, SETTINGS_KEY); return value; },
    setItem(key, next) { assert.equal(key, SETTINGS_KEY); value = next; } };
}

test('settings start at the original flight defaults and round-trip only versioned known fields', () => {
  const storage = memoryStorage();
  const settings = new UserSettings(() => storage);
  assert.deepEqual(settings.values, DEFAULT_SETTINGS);
  settings.update({ mouseSensitivity: 1.75, invertY: true, playerHealth: 999 });
  assert.deepEqual(JSON.parse(storage.getItem(SETTINGS_KEY)), { version: 1, ...DEFAULT_SETTINGS, mouseSensitivity: 1.75, invertY: true });
  assert.deepEqual(new UserSettings(() => storage).values, settings.values);
  assert.equal(settings.saveStatus, 'saved');
  assert.ok(Object.isFrozen(settings.values));
  assert.deepEqual(DEFAULT_SETTINGS, { mouseSensitivity: 1, invertY: false, musicVolume: 0.4, effectsVolume: 0.6, muted: false, cameraView: 'hud', headlights: true, showHUD: true });
});

test('invalid, malformed and future-version records fall back without rewriting stored data', () => {
  for (const raw of ['{bad json', 'null', '[]', '"bad"', '{"version":2,"mouseSensitivity":2}',
    '{"version":1,"mouseSensitivity":"2","invertY":"true"}']) {
    const storage = memoryStorage(raw);
    const settings = new UserSettings(() => storage);
    assert.deepEqual(settings.values, DEFAULT_SETTINGS);
    assert.equal(storage.getItem(SETTINGS_KEY), raw);
  }
});

test('sensitivity is finite, clamped and snapped; invalid partial updates preserve current values', () => {
  const settings = new UserSettings(() => memoryStorage());
  settings.update({ mouseSensitivity: 999 }); assert.equal(settings.values.mouseSensitivity, 3);
  settings.update({ mouseSensitivity: -10 }); assert.equal(settings.values.mouseSensitivity, 0.25);
  settings.update({ mouseSensitivity: 1.333, invertY: true }); assert.equal(settings.values.mouseSensitivity, 1.35);
  for (const value of [Infinity, NaN, '2', null]) {
    settings.update({ mouseSensitivity: value, invertY: 'false' });
    assert.deepEqual(settings.values, { ...DEFAULT_SETTINGS, mouseSensitivity: 1.35, invertY: true });
  }
});

test('denied storage access, read failures and write failures do not prevent live changes', () => {
  const providers = [() => undefined, () => { throw new Error('SecurityError'); },
    () => ({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } }),
    () => ({ getItem: () => null, setItem() { throw new Error('QuotaExceededError'); } })];
  for (const provider of providers) {
    const settings = new UserSettings(provider);
    settings.update({ mouseSensitivity: 2, invertY: true });
    assert.deepEqual(settings.values, { ...DEFAULT_SETTINGS, mouseSensitivity: 2, invertY: true });
    assert.equal(settings.saveStatus, 'unavailable');
  }
});

test('reset persists defaults and a later successful write recovers after a temporary storage failure', () => {
  const storage = memoryStorage();
  let blocked = true;
  const settings = new UserSettings(() => ({ getItem: storage.getItem,
    setItem(key, value) { if (blocked) throw new Error('quota'); storage.setItem(key, value); } }));
  settings.update({ invertY: true });
  blocked = false;
  settings.reset();
  assert.equal(settings.saveStatus, 'saved');
  assert.deepEqual(new UserSettings(() => storage).values, DEFAULT_SETTINGS);
});

test('old control-only records retain mouse preferences and acquire audio defaults without a storage rewrite', () => {
  const raw = JSON.stringify({ version: 1, mouseSensitivity: 2.25, invertY: true });
  const storage = memoryStorage(raw), applied = [];
  const settings = new UserSettings(() => storage, values => applied.push(values));
  assert.deepEqual(settings.values, { ...DEFAULT_SETTINGS, mouseSensitivity: 2.25, invertY: true });
  assert.equal(storage.getItem(SETTINGS_KEY), raw);
  assert.deepEqual(applied, [settings.values]);
  settings.update({ musicVolume: 0.23, effectsVolume: 0, muted: true });
  const reloaded = new UserSettings(() => storage);
  assert.deepEqual(reloaded.values, { ...DEFAULT_SETTINGS, mouseSensitivity: 2.25, invertY: true,
    musicVolume: 0.23, effectsVolume: 0, muted: true });
  assert.ok(Object.isFrozen(applied[1]));
});

test('audio preferences clamp, snap and reject nonfinite or wrong types without changing other preferences', () => {
  const settings = new UserSettings(() => memoryStorage());
  settings.update({ musicVolume: -1, effectsVolume: 100, muted: true });
  assert.equal(settings.values.musicVolume, 0); assert.equal(settings.values.effectsVolume, 1);
  settings.update({ musicVolume: 0.234, effectsVolume: 0.676 });
  const valid = settings.values;
  assert.equal(valid.musicVolume, 0.23); assert.equal(valid.effectsVolume, 0.68);
  for (const invalid of [Infinity, -Infinity, NaN, null, '0.5', {}, undefined]) {
    settings.update({ musicVolume: invalid, effectsVolume: invalid, muted: 'false' });
    assert.deepEqual(settings.values, valid);
  }
  const malformed = new UserSettings(() => memoryStorage('{"version":1,"musicVolume":"0.2","effectsVolume":null,"muted":"true"}'));
  assert.deepEqual(malformed.values, DEFAULT_SETTINGS);
});

test('storage failure still applies live audio changes and reset restores all defaults', () => {
  const applied = [];
  const settings = new UserSettings(() => ({ getItem: () => null, setItem() { throw new Error('quota'); } }),
    values => applied.push(values));
  settings.update({ musicVolume: 0, effectsVolume: 0.17, muted: true, invertY: true });
  assert.equal(applied.at(-1).muted, true);
  assert.equal(applied.at(-1).effectsVolume, 0.17);
  assert.equal(settings.saveStatus, 'unavailable');
  settings.reset();
  assert.deepEqual(applied.at(-1), DEFAULT_SETTINGS);
  assert.equal(applied.length, 3, 'load, update and reset each apply one snapshot');
});

function mouseFixture(t) {
  const state = new GameState(); state.session.begin(); state.session.transition('playing');
  const settings = new UserSettings(() => memoryStorage());
  const ship = new Spaceship(), canvas = {};
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { pointerLockElement: canvas } });
  t.after(() => original ? Object.defineProperty(globalThis, 'document', original) : delete globalThis.document);
  const input = new InputManager(null, null, state, null, settings);
  input.canvas = canvas; input.game = { spaceship: ship };
  return { state, settings, ship, input };
}

test('sensitivity changes the real root rotation immediately; invert Y changes pitch but preserves yaw', t => {
  const { settings, ship, input } = mouseFixture(t);
  input.onMouseMove({ movementX: 100, movementY: 0 });
  const defaultYaw = ship.group.quaternion.clone();
  ship.group.quaternion.identity();
  settings.update({ mouseSensitivity: 2 });
  input.onMouseMove({ movementX: 100, movementY: 0 });
  assert.ok(Math.abs(ship.group.quaternion.angleTo(new THREE.Quaternion()) - 0.4) < 1e-8);
  ship.group.quaternion.identity();
  settings.update({ mouseSensitivity: 1, invertY: true });
  input.onMouseMove({ movementX: 100, movementY: 0 });
  assert.ok(ship.group.quaternion.angleTo(defaultYaw) < 1e-7);
  ship.group.quaternion.identity();
  input.onMouseMove({ movementX: 0, movementY: -100 });
  const inverted = ship.group.quaternion.clone();
  ship.group.quaternion.identity(); settings.update({ invertY: false });
  input.onMouseMove({ movementX: 0, movementY: -100 });
  assert.ok(ship.group.quaternion.angleTo(inverted.invert()) < 1e-7);
});

test('changed settings preserve capture/phase guards and keyboard flight controls', t => {
  const { state, settings, ship, input } = mouseFixture(t);
  settings.update({ mouseSensitivity: 3, invertY: true });
  state.session.transition('paused'); input.onMouseMove({ movementX: 100, movementY: 100 });
  assert.ok(ship.group.quaternion.equals(new THREE.Quaternion()));
  state.session.transition('playing'); document.pointerLockElement = null;
  input.onMouseMove({ movementX: 100, movementY: 100 });
  assert.ok(ship.group.quaternion.equals(new THREE.Quaternion()));
  input.keyStates = { ArrowUp: true }; input.updateMovement(0.1);
  assert.ok(ship.group.quaternion.x > 0, 'keyboard pitch remains upward');
  const orientation = ship.group.quaternion.clone();
  state.resetForSession();
  assert.deepEqual(settings.values, { ...DEFAULT_SETTINGS, mouseSensitivity: 3, invertY: true });
  assert.ok(ship.group.quaternion.equals(orientation));
});

test('an open settings dialog prevents gameplay keys and Escape from reaching the session', () => {
  const state = new GameState(); state.session.begin(); state.session.transition('playing');
  const input = new InputManager(null, { fireProjectile() { assert.fail('dialog fired a shot'); } }, state,
    { settingsDialog: { isOpen: true } });
  input.game = { togglePause() { assert.fail('dialog Escape toggled pause'); } };
  for (const code of ['KeyF', 'Escape', 'KeyW', 'ArrowLeft', 'Digit2']) input.onKeyDown({ code });
  assert.deepEqual(input.keyStates, {});
});
