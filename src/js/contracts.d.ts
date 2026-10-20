import type { Box3, Plane, Triangle, Vector3 } from 'three';
import type GameSession from './core/GameSession.js';
import type GameState from './core/GameState.js';
import type Spaceship from './entities/Spaceship.js';

// Contracts for the initial checked modules; this is not a serialized level schema.
export type SessionPhase = 'menu' | 'loading' | 'playing' | 'paused' | 'dead' | 'completed' | 'error';
export interface SessionTask { due: number; callback: () => void; generation: number }
export interface UserPreferences {
  readonly mouseSensitivity: number;
  readonly invertY: boolean;
  readonly musicVolume: number;
  readonly effectsVolume: number;
  readonly muted: boolean;
  readonly cameraView: 'hud' | 'external';
  readonly headlights: boolean;
  readonly showHUD: boolean;
}
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type SettingsSaveStatus = 'ready' | 'saved' | 'unavailable';

export type WeaponType = 'pulse' | 'laser' | 'missile' | 'plasma';
export type EnemyType = 'scout' | 'fighter' | 'bomber' | 'destroyer' | 'boss';
export type TimedModifier = 'speedMultiplier' | 'weaponPower';
export type WeaponInventory = Record<WeaponType, { unlocked: boolean; ammo: number }>;
// Returns true when a presentation animation is complete; it is then removed.
export type SimulationAnimation = (delta: number) => boolean;
export interface FlightInput {
  readonly left?: boolean; readonly right?: boolean;
  readonly up?: boolean; readonly down?: boolean;
  readonly forward?: boolean; readonly backward?: boolean;
  readonly yawLeft?: boolean; readonly yawRight?: boolean;
  readonly pitchUp?: boolean; readonly pitchDown?: boolean;
  readonly rollLeft?: boolean; readonly rollRight?: boolean;
}
export interface PlayerFeedback {
  updateWeaponUI(): void;
  updateHUD(): void;
  showMessage(message: string, duration?: number, color?: string): void;
  flash?(color: string): void;
  updateKillCounter?(counts: Record<EnemyType, number>): void;
  updateEnemyCount?(defeated: number, total: number): void;
}
export interface PlayerAudio {
  playSound(id: string, options?: { volume?: number }): unknown;
}
export interface PlayerSessionActions {
  die(): boolean;
  completeSession(): boolean;
  spaceship?: Pick<Spaceship, 'viewEffects'>;
}
export interface InputGameActions {
  readonly session: Pick<GameSession, 'id' | 'phase'>;
  readonly spaceship: Pick<Spaceship, 'rotate' | 'update' | 'viewEffects'>;
  readonly activeAnimations: SimulationAnimation[];
  togglePause(): boolean;
  pauseGame(): boolean;
  releasePointerLock(): void;
  interact?(): boolean;
  toggleShipOption?(option: 'cameraView' | 'headlights' | 'showHUD'): void;
}
export interface PlayerFire {
  fireProjectile(state: GameState, options?: { requirePointerLock?: boolean }): unknown;
}
export type InputFeedback = Pick<PlayerFeedback, 'showMessage' | 'flash'> & { settingsDialog?: { readonly isOpen: boolean } };
export type KeyboardInput = Pick<KeyboardEvent, 'code'> & Partial<Pick<KeyboardEvent, 'repeat' | 'preventDefault'>>;
export interface MouseMotion {
  readonly movementX?: number; readonly movementY?: number;
  readonly mozMovementX?: number; readonly mozMovementY?: number;
  readonly webkitMovementX?: number; readonly webkitMovementY?: number;
}

export type DefeatCause = 'shot' | 'ram';
export interface MissionDefinition {
  readonly type: 'clear-and-exit' | 'relay-clear-and-exit';
  readonly requiredEnemyIds: readonly string[];
  readonly requiredDeviceIds?: readonly string[];
  readonly exit: { readonly id?: string; readonly position: readonly [number, number, number]; readonly radius: number };
}

export interface ConvexHull { readonly vertices: readonly Vector3[]; readonly planes: readonly Plane[]; readonly triangles: readonly Triangle[]; readonly box: Box3 }
export type SolidCollider = Box3 | { readonly box: Box3; readonly id?: string; readonly convex?: ConvexHull };
export interface ShotTarget { readonly isActive: boolean; readonly collider: Box3 }
export interface ShotPlayer { readonly position: Vector3; readonly radius: number }
export interface ShotOptions<T extends ShotTarget = ShotTarget> {
  colliders?: readonly SolidCollider[];
  targets?: readonly T[];
  player?: ShotPlayer | null;
  radius?: number;
}
export type TraceContact<T extends ShotTarget = ShotTarget> =
  | { kind: 'wall'; target: SolidCollider }
  | { kind: 'enemy'; target: T }
  | { kind: 'player'; target: ShotPlayer };
export type ShotHit<T extends ShotTarget = ShotTarget> = TraceContact<T> & { fraction: number; point: Vector3 };
