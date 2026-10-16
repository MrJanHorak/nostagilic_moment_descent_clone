import type { Vector3 } from 'three';
import type { EnemyType, MissionDefinition } from './contracts.js';

export type Vec3 = readonly [number, number, number];
export type Rotation = readonly [number, number, number, number];
export type Face = 'negativeX' | 'positiveX' | 'negativeY' | 'positiveY' | 'negativeZ' | 'positiveZ';
export type MaterialPreset = 'industrial-blue' | 'industrial-red' | 'industrial-green';
export type PickupType = 'health' | 'pulseAmmo';
export interface RoomDocument {
  readonly id: string;
  readonly prefab: 'box-room' | 'straight-corridor';
  readonly position: Vec3;
  readonly size: Vec3;
  readonly yaw: 0 | 90 | 180 | 270;
  readonly materialPreset: MaterialPreset;
}
export interface PortReference { readonly roomId: string; readonly port: Face }
export interface ConnectionDocument {
  readonly id: string;
  readonly a: PortReference;
  readonly b: PortReference;
  readonly openingSize: readonly [number, number];
}
export interface Placement { readonly roomId: string; readonly position: Vec3 }
export type EntityDocument = Placement & (
  | { readonly id: string; readonly kind: 'enemy'; readonly type: EnemyType }
  | { readonly id: string; readonly kind: 'pickup'; readonly type: PickupType }
  | { readonly id: string; readonly kind: 'exit'; readonly radius: number }
);
export interface LevelDocument {
  readonly formatVersion: 1;
  readonly id: string;
  readonly name: string;
  readonly rooms: readonly RoomDocument[];
  readonly connections: readonly ConnectionDocument[];
  readonly playerSpawn: Placement & { readonly rotation: Rotation };
  readonly entities: readonly EntityDocument[];
  readonly mission: { readonly type: 'clear-and-exit'; readonly requiredEnemyIds: readonly string[]; readonly exitId: string };
  readonly combat: { readonly pulseDamage: number; readonly initialPulseAmmo: number; readonly maxPulseAmmo: number };
}
export interface ValidationIssue { readonly path: string; readonly code: string; readonly message: string }
export type ValidationResult = { readonly valid: true; readonly document: LevelDocument }
  | { readonly valid: false; readonly errors: readonly ValidationIssue[] };
export interface SolidDefinition { readonly id: string; readonly center: Vec3; readonly size: Vec3; readonly color: number }
export interface ArenaLevel {
  readonly id: string;
  readonly kind: 'arena';
  readonly name: string;
  readonly spawn: Vec3;
  readonly spawnRotation?: Rotation;
  readonly solids: readonly SolidDefinition[];
  readonly rendering?: { readonly enemyAccentLights?: boolean; readonly trainingDecorations?: boolean };
  readonly enemySpawns: readonly { readonly id: string; readonly enemyType: EnemyType; readonly position: Vector3 }[];
  readonly powerupSpawns: readonly { readonly id: string; readonly powerupType: PickupType; readonly position: Vector3 }[];
  readonly mission?: MissionDefinition;
  readonly combat?: LevelDocument['combat'];
  readonly sourceDocument?: LevelDocument;
}
