import type { Box3, Vector3 } from 'three';

// Contracts for the initial checked modules; this is not a serialized level schema.
export type SessionPhase = 'menu' | 'loading' | 'playing' | 'paused' | 'dead' | 'completed' | 'error';
export interface SessionTask { due: number; callback: () => void; generation: number }
export interface ControlSettings { readonly mouseSensitivity: number; readonly invertY: boolean }
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type SettingsSaveStatus = 'ready' | 'saved' | 'unavailable';

export type DefeatCause = 'shot' | 'ram';
export interface MissionDefinition {
  readonly type: 'clear-and-exit';
  readonly requiredEnemyIds: readonly string[];
  readonly exit: { readonly id?: string; readonly position: readonly [number, number, number]; readonly radius: number };
}

export type SolidCollider = Box3 | { readonly box: Box3; readonly id?: string };
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
