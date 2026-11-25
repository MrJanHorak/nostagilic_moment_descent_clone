// Input Manager for handling keyboard and mouse inputs
import { shakeCamera } from '../utils/effectsUtils.js';
import ControlBindings from './ControlBindings.js';
import { GAMEPAD_BUTTONS, GamepadTracker, MENU_BUTTONS, choosePad, neutralFlight, readFlight } from './GamepadInput.js';

/** @typedef {import('./ControlBindings.js').ControlAction} ControlAction */
/** @type {readonly (keyof import('./GamepadInput.js').AnalogFlight)[]} */
const FLIGHT_ACTIONS = ['forward', 'backward', 'left', 'right', 'up', 'down', 'yawLeft', 'yawRight', 'pitchUp', 'pitchDown', 'rollLeft', 'rollRight'];
/** @type {readonly import('../contracts.js').WeaponType[]} */
const WEAPONS = ['pulse', 'laser', 'missile', 'plasma'];
/** Full stick deflection turns this much faster than a held key at stick sensitivity 1. */
const STICK_TURN_SCALE = 1.5;
/** Recent controller use suppresses the "click to capture the mouse" prompt for this long. */
const GAMEPAD_RECENT_MS = 5000;

class InputManager {
  /** @param {import('three').Camera | null} camera
   * @param {import('../contracts.js').PlayerFire | null} projectileManager
   * @param {import('./GameState.js').default} gameState
   * @param {import('../contracts.js').InputFeedback | null} [uiManager]
   * @param {Pick<import('./UserSettings.js').default, 'values'> | null} [settings]
   * @param {ControlBindings | null} [controls] keyboard bindings and controller preferences
   */
  constructor(camera, projectileManager, gameState, uiManager = null, settings = null, controls = null) {
    this.camera = camera;
    this.projectileManager = projectileManager;
    this.gameState = gameState;
    this.uiManager = uiManager;
    this.settings = settings;
    this.controls = controls ?? new ControlBindings(() => undefined);
    this.gamepad = new GamepadTracker();
    this.analog = neutralFlight();
    this.gamepadConnected = false;
    this.lastGamepadUse = -Infinity;
    /** @type {import('../contracts.js').InputGameActions | null} */
    this.game = null; // Will be set from main.js

    /** @type {Partial<Record<string, boolean>>} */
    this.keyStates = {};
    /** @type {HTMLCanvasElement | null} */
    this.canvas = null;
    this.wasPointerLocked = false;
    /** @type {number | undefined} */
    this.lastLockMessage = undefined;
    this.mouseSensitivity = 0.002;

    // Bind methods
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onClick = this.onClick.bind(this);
    this.onPointerlockChange = this.onPointerlockChange.bind(this);
    this.onPointerlockError = this.onPointerlockError.bind(this);
    this.clearKeys = this.clearKeys.bind(this);
    this.onBlur = this.onBlur.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
  }

  // Initialize with canvas
  /** @param {HTMLCanvasElement} canvas */
  init(canvas) {
    this.canvas = canvas;

    // Add event listeners
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onPointerlockChange);
    document.addEventListener('pointerlockerror', this.onPointerlockError);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.canvas.addEventListener('click', this.onClick);

    return this;
  }

  // Mouse movement handler for camera rotation
  /** @param {import('../contracts.js').MouseMotion} event */
  onMouseMove(event) {
    if (
      document.pointerLockElement !== this.canvas ||
      this.gameState.session.phase !== 'playing'
    ) {
      return;
    }

    const movementX =
      event.movementX || event.mozMovementX || event.webkitMovementX || 0;
    const movementY =
      event.movementY || event.mozMovementY || event.webkitMovementY || 0;

    const sensitivity = this.mouseSensitivity * (this.settings?.values.mouseSensitivity ?? 1);
    const pitchSign = this.settings?.values.invertY ? 1 : -1;
    const yaw = -movementX * sensitivity, pitch = pitchSign * movementY * sensitivity;
    this.game?.spaceship.rotate(yaw, pitch);
    // Online: the same turn goes to the server with the next input.
    this.game?.online?.addLook(yaw, pitch);
  } // Handle key down
  /** @param {import('../contracts.js').KeyboardInput} event */
  onKeyDown(event) {
    if (this.uiManager?.settingsDialog?.isOpen) return;
    const action = this.controls.actionFor(event.code);
    const playing = this.gameState.session.phase === 'playing';
    // Bound keys (Space, arrows...) must not scroll the page or trigger browser shortcuts in flight.
    if (playing && action) event.preventDefault?.();
    // Quick-chat open: number keys send a phrase instead of switching weapons.
    const quick = /^Digit([1-8])$/.exec(event.code ?? '');
    if (playing && quick && this.game?.quickChatOpen && !event.repeat) {
      event.preventDefault?.(); this.game.sendQuickChat?.(Number(quick[1]) - 1); return;
    }
    // Always set keyStates, even if pointer lock is not active
    this.keyStates[event.code] = true;

    if (playing && !event.repeat && action) this.performAction(action);

    // Handle escape key for pause menu
    if (
      event.code === 'Escape' &&
      !event.repeat &&
      this.gameState &&
      this.gameState.isGameStarted
    ) {
      // Toggle pause state
      if (this.uiManager) {
        this.game?.togglePause();
      }
    }

  }

  /** One-shot actions shared by keyboard and controller. Callers check the session phase.
   * @param {ControlAction | 'weaponNext' | 'weaponPrevious'} action */
  performAction(action) {
    switch (action) {
      case 'fire': this.fireWeapon({ requirePointerLock: false }); break;
      case 'interact': this.game?.interact?.(); break;
      case 'map': this.game?.toggleMap?.(); break;
      case 'missionLog': this.game?.openMissionLog?.(); break;
      case 'quickChat': this.game?.toggleQuickChat?.(); break;
      case 'markTarget': this.game?.markTarget?.(); break;
      case 'cameraView': case 'headlights': case 'showHUD': this.game?.toggleShipOption?.(action); break;
      case 'weapon1': case 'weapon2': case 'weapon3': case 'weapon4':
        this.gameState.switchWeapon(WEAPONS[Number(action.slice(6)) - 1]); break;
      case 'weaponNext': case 'weaponPrevious': this.cycleWeapon(action === 'weaponNext' ? 1 : -1); break;
      default: break;
    }
  }

  /** Select the next/previous unlocked weapon. @param {1 | -1} step */
  cycleWeapon(step) {
    const start = Math.max(0, WEAPONS.indexOf(this.gameState.currentWeapon));
    for (let offset = 1; offset < WEAPONS.length; offset++) {
      const weapon = WEAPONS[(start + step * offset + WEAPONS.length * offset) % WEAPONS.length];
      if (this.gameState.weaponInventory[weapon]?.unlocked) return this.gameState.switchWeapon(weapon);
    }
    return false;
  }

  /** Poll the first connected controller once per rendered frame (also while paused, so
   * Menu can resume and menus can be navigated).
   * @param {() => ArrayLike<import('./GamepadInput.js').GamepadSnapshot | null> | null | undefined} [getPads]
   * @param {number} [now] */
  pollGamepad(getPads, now) {
    // Defaults live in the body: the production build mis-scopes optional calls inside
    // default parameter values, which crashed every frame in the browser.
    const time = now ?? (typeof performance === 'undefined' ? 0 : performance.now());
    /** @type {(import('./GamepadInput.js').GamepadSnapshot | null)[]} */
    let pads;
    try {
      const source = getPads ? getPads() : (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : null);
      pads = Array.from(source ?? []);
    } catch { pads = []; }
    const pad = choosePad(pads);
    if (!!pad !== this.gamepadConnected) {
      this.gamepadConnected = !!pad;
      this.uiManager?.showMessage(pad ? 'CONTROLLER CONNECTED · Settings lists the layout' : 'CONTROLLER DISCONNECTED', 2200, '#8be8f0');
    }
    const pressed = this.gamepad.presses(pad);
    const phase = this.gameState.session.phase;
    if (!pad || phase !== 'playing') this.analog = neutralFlight();
    else {
      const flight = readFlight(pad, { invertY: this.controls.values.invertStickY });
      const scale = STICK_TURN_SCALE * this.controls.values.stickSensitivity;
      // A gentle response curve gives fine aim near the centre and full speed at the edge.
      for (const key of /** @type {const} */ (['yawLeft', 'yawRight', 'pitchUp', 'pitchDown'])) flight[key] = Math.pow(flight[key], 1.5) * scale;
      this.analog = flight;
      if (Object.values(flight).some(value => value > 0)) this.lastGamepadUse = time;
    }
    if (pressed.length) this.lastGamepadUse = time;
    if (this.uiManager?.settingsDialog?.isOpen) { for (const index of pressed) this.navigateMenu(index, true); return pressed; }
    for (const index of pressed) {
      if (index === MENU_BUTTONS.pause && this.gameState.isGameStarted && ['playing', 'paused'].includes(phase)) { this.game?.togglePause(); continue; }
      if (phase === 'playing') {
        const action = GAMEPAD_BUTTONS[index];
        if (action && !['up', 'down', 'rollLeft', 'rollRight', 'pause'].includes(action)) this.performAction(/** @type {any} */ (action));
        continue;
      }
      // View/Share opens the comms log from the pause menu too.
      if (index === 8 && phase === 'paused') { this.game?.openMissionLog?.(); continue; }
      this.navigateMenu(index, false);
    }
    // A press may have paused or ended the run; never carry stick input out of active flight.
    if (this.gameState.session.phase !== 'playing') this.analog = neutralFlight();
    return pressed;
  }

  /** D-pad focus movement and A/B activation for menus, pause and result screens.
   * @param {number} index @param {boolean} inDialog */
  navigateMenu(index, inDialog) {
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    const scope = document.querySelector('dialog[open]') ?? [...document.querySelectorAll('[role="dialog"]')].at(-1) ?? document.body;
    if (!scope) return;
    const focusable = [...scope.querySelectorAll('button, a[href], select, summary, input')]
      .filter(node => node instanceof HTMLElement && !(/** @type {HTMLButtonElement} */ (node).disabled) && node.getClientRects().length > 0);
    if (!focusable.length) return;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const position = active ? focusable.indexOf(active) : -1;
    if (index === MENU_BUTTONS.next || index === MENU_BUTTONS.previous) {
      const step = index === MENU_BUTTONS.next ? 1 : -1;
      const target = focusable[position === -1 ? (step > 0 ? 0 : focusable.length - 1) : (position + step + focusable.length) % focusable.length];
      if (target instanceof HTMLElement) { target.focus(); target.scrollIntoView?.({ block: 'nearest' }); }
    } else if (index === MENU_BUTTONS.confirm && active && position !== -1) {
      if (active instanceof HTMLInputElement && active.type === 'checkbox') active.click();
      else if (!(active instanceof HTMLSelectElement) && !(active instanceof HTMLInputElement)) active.click();
    } else if (index === MENU_BUTTONS.back) {
      (active ?? scope).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      if (inDialog) this.uiManager?.settingsDialog?.close?.();
    }
  }

  // Handle key up
  /** @param {Pick<KeyboardEvent, 'code'>} event */
  onKeyUp(event) {
    // Always unset keyStates, even if pointer lock is not active
    this.keyStates[event.code] = false;
  }

  // Handle click - request pointer lock and fire projectile if appropriate
  onClick() {
    if (this.gameState.session.phase !== 'playing') return;
    if (document.pointerLockElement !== this.canvas) {
      this.requestPointerLock();
      return;
    }

    // Only shoot if game has started and is in progress
    if (
      this.gameState.isGameStarted &&
      !this.gameState.isGameOver &&
      !this.gameState.isPaused &&
      document.pointerLockElement === this.canvas &&
      this.projectileManager
    ) {
      this.fireWeapon();
    }
  }

  /** Fire the selected weapon. Online, shots keep to the server's rate and go with the
   * next input; the shot drawn here is this screen's prediction of it.
   * @param {{requirePointerLock?: boolean}} [options] */
  fireWeapon(options) {
    const online = this.game?.online;
    if (online && !online.canFire()) return;
    const shot = this.projectileManager?.fireProjectile(this.gameState, options);
    if (shot && online) online.queueFire();
    return shot;
  }

  requestPointerLock() {
    const generation = this.game?.session.id;
    if (this.canvas && document.pointerLockElement === this.canvas) return Promise.resolve(true);
    try {
      if (!this.canvas?.requestPointerLock) throw new Error('Pointer lock is unavailable');
      return Promise.resolve(this.canvas.requestPointerLock()).then(
        () => true,
        () => {
          if (generation === this.game?.session.id) this.onPointerlockError();
          return false;
        }
      );
    } catch {
      this.onPointerlockError();
      return Promise.resolve(false);
    }
  }

  onPointerlockError() {
    if (this.game && this.game.session.phase !== 'playing') return;
    // Controller players fly without mouse capture; do not nag them to click.
    if (performance.now() - this.lastGamepadUse < GAMEPAD_RECENT_MS) return;
    if (performance.now() - (this.lastLockMessage ?? -Infinity) < 500) return;
    this.lastLockMessage = performance.now();
    this.uiManager?.showMessage('Click the game view to capture mouse controls.', 2500, '#ffcc66');
  }

  clearKeys() {
    this.keyStates = {};
    this.analog = neutralFlight();
  }

  // Handle pointer lock change
  onPointerlockChange() {
    if (document.pointerLockElement === this.canvas) {
      if (this.game && this.game.session.phase !== 'playing') {
        this.game.releasePointerLock();
        return;
      }
      this.wasPointerLocked = true;
      console.log('Pointer Lock active');
      document.addEventListener('mousemove', this.onMouseMove, false);
    } else {
      const wasLocked = this.wasPointerLocked;
      this.wasPointerLocked = false;
      this.clearKeys();
      console.log('Pointer Lock inactive');
      document.removeEventListener('mousemove', this.onMouseMove, false);
      if (wasLocked) this.game?.pauseGame();
    }
  }

  onBlur() {
    this.clearKeys();
    this.game?.pauseGame();
  }

  onVisibilityChange() { if (document.hidden) this.onBlur(); }
  // Update player movement based on key states
  /** @param {number} delta */
  updateMovement(delta) {
    // Skip if game not started or is over
    if (this.gameState.session.phase !== 'playing') {
      return;
    }

    // Bound keys report full deflection; a controller adds analog amounts. The stronger wins.
    /** @type {Partial<Record<ControlAction, boolean | number>>} */
    const input = {};
    for (const action of FLIGHT_ACTIONS) {
      const key = this.controls.isHeld(action, this.keyStates);
      const stick = this.analog[action];
      input[action] = stick > 0 ? Math.max(key ? 1 : 0, stick) : key;
    }

    // Pass input to spaceship for drift/inertia physics
    if (this.game && this.game.spaceship) {
      this.game.spaceship.update(delta, input, this.gameState.speedMultiplier);
    }
    return input;
  } // Provide feedback when player collides with an obstacle
  activateCollisionFeedback() {
    if (this.gameState.session.phase !== 'playing') return;
    // Small screen shake for collision
    if (this.camera && this.game) {
      const shakeAnim = shakeCamera(this.game.spaceship.viewEffects, 0.3, { x: 0, y: 0, z: 0 });
      if (this.game && this.game.activeAnimations) {
        this.game.activeAnimations.push(shakeAnim);
      }
    }

    this.uiManager?.flash?.('rgba(255, 255, 255, 0.15)');
  }

  // Cleanup resources
  dispose() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onPointerlockChange);
    document.removeEventListener('pointerlockerror', this.onPointerlockError);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    if (this.canvas) {
      this.canvas.removeEventListener('click', this.onClick);
    }
  }
}

export default InputManager;
