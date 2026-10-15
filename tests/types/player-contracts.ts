// Compile-only examples for the actual checked player classes and their collaborators.
import { Group, PerspectiveCamera, Scene } from 'three';
import GameState from '../../src/js/core/GameState.js';
import InputManager from '../../src/js/core/InputManager.js';
import UserSettings from '../../src/js/core/UserSettings.js';
import Spaceship from '../../src/js/entities/Spaceship.js';
import { createCaveParticles, shakeCamera, updateCaveParticles } from '../../src/js/utils/effectsUtils.js';
import type { FlightInput, PlayerFire, WeaponType } from '../../src/js/contracts.js';

const state = new GameState(), ship = new Spaceship(), camera = new PerspectiveCamera();
ship.attachCamera(camera);
const controls: FlightInput = { forward: true, rollLeft: true };
ship.update(1 / 60, controls, state.speedMultiplier);
const fire: PlayerFire = { fireProjectile(current, options) {
  const weapon: WeaponType = current.currentWeapon;
  const requireLock: boolean | undefined = options?.requirePointerLock;
  void weapon; void requireLock;
} };
const feedback = { showMessage() {}, updateHUD() {}, updateWeaponUI() {}, flash() {} };
const input = new InputManager(camera, fire, state, feedback, new UserSettings(() => undefined));
input.game = { session: state.session, spaceship: ship, activeAnimations: [],
  pauseGame: () => true, togglePause: () => true, releasePointerLock() {} };
state.setReferences(camera, null, feedback, input.game.activeAnimations,
  { die: () => true, completeSession: () => true, spaceship: ship });
state.playerVelocity = ship.velocity;
state.switchWeapon('pulse'); state.recordEnemyKill('fighter'); state.recordWeaponPickup('laser');
state.applyTimedModifier('weaponPower', 2, 1000, 'expired');
state.activeAnimations.push(shakeCamera(ship.viewEffects, 0.3, { x: 0, y: 0, z: 0 }));
input.onMouseMove({ mozMovementX: 4, webkitMovementY: -1 });
input.onKeyDown(new KeyboardEvent('keydown', { code: 'KeyW' }));
input.onKeyUp({ code: 'KeyW' });
const particles = createCaveParticles(new Scene());
updateCaveParticles(particles, 1 / 60);

// @ts-expect-error Input flags are immutable values supplied to movement.
controls.forward = false;
// @ts-expect-error Misspelled movement flags must not silently become no input.
ship.update(1 / 60, { forwards: true });
// @ts-expect-error Thrust flags must be booleans.
ship.update(1 / 60, { forward: 1 });
// @ts-expect-error Speed multipliers must be numeric.
ship.update(1 / 60, {}, 'fast');
// @ts-expect-error Only a camera can be mounted as the view.
ship.attachCamera(new Group());
// @ts-expect-error Weapon names must be declared inventory keys.
state.switchWeapon('railgun');
// @ts-expect-error Ammo must remain numeric.
state.weaponInventory.pulse.ammo = 'unlimited';
// @ts-expect-error Kill statistics accept supported enemy types.
state.recordEnemyKill('drone');
// @ts-expect-error Pulse is not tracked as an unlock pickup.
state.recordWeaponPickup('pulse');
// @ts-expect-error Timed modifiers must not overwrite arbitrary state fields.
state.applyTimedModifier('score', 2, 1000, 'expired');
// @ts-expect-error Damage must be numeric.
state.takeDamage('10');
// @ts-expect-error Presentation callbacks return a completion boolean.
state.activeAnimations.push(() => 'done');
// @ts-expect-error Mouse motion must use numeric deltas.
input.onMouseMove({ movementX: '10' });
// @ts-expect-error Keyboard handlers consume physical key codes.
input.onKeyDown({ key: 'w' });
// @ts-expect-error Pointer capture is attached to the rendering canvas.
input.init(document.createElement('div'));
// @ts-expect-error Firing collaborators must receive player state, not a string.
const badFire: PlayerFire = { fireProjectile(current: string) { return current; } };
// @ts-expect-error Terminal callbacks must provide both death and completion actions.
state.setReferences(camera, null, feedback, [], { die: () => true });
// @ts-expect-error Input must be able to release capture on late acquisition.
input.game = { session: state.session, spaceship: ship, activeAnimations: [], pauseGame: () => true, togglePause: () => true };
void badFire;
