import type { Vector3 } from 'three';
import type { EnemyType, MissionDefinition } from './contracts.js';

export type Vec3 = readonly [number, number, number];
export type Rotation = readonly [number, number, number, number];
export type Face = 'negativeX' | 'positiveX' | 'negativeY' | 'positiveY' | 'negativeZ' | 'positiveZ';
export type MaterialPreset = 'industrial-blue' | 'industrial-red' | 'industrial-green';
export type PickupType = 'health' | 'pulseAmmo';
export type SurfacePattern = 'plain' | 'grid' | 'panels' | 'hazard';
export interface SurfaceStyle { readonly color: number; readonly pattern: SurfacePattern }
export interface RoomDocument {
  readonly id: string;
  readonly prefab: 'box-room' | 'straight-corridor' | 'offset-corridor';
  readonly position: Vec3;
  readonly size: Vec3;
  readonly yaw: 0 | 90 | 180 | 270;
  readonly pitch?: 0 | 90 | 180 | 270;
  readonly roll?: 0 | 90 | 180 | 270;
  readonly endOffset?: readonly [number, number];
  readonly materialPreset: MaterialPreset;
  readonly surfaces?: Readonly<Partial<Record<Face, SurfaceStyle>>>;
}
export interface PortReference { readonly roomId: string; readonly port: Face; readonly offset?: readonly [number, number] }
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
export interface DeviceDocument extends Placement { readonly id: string; readonly label: string }
export interface DoorDocument { readonly id: string; readonly connectionId: string; readonly deviceId: string }
interface LevelDocumentBase {
  readonly id: string;
  readonly name: string;
  readonly rooms: readonly RoomDocument[];
  readonly connections: readonly ConnectionDocument[];
  readonly playerSpawn: Placement & { readonly rotation: Rotation };
  readonly entities: readonly EntityDocument[];
  readonly combat: { readonly pulseDamage: number; readonly initialPulseAmmo: number; readonly maxPulseAmmo: number };
}
interface DocumentMission { readonly requiredEnemyIds: readonly string[]; readonly exitId: string }
export type LevelDocument = LevelDocumentBase & (
  | { readonly formatVersion: 1; readonly mission: DocumentMission & { readonly type: 'clear-and-exit' } }
  | { readonly formatVersion: 2; readonly devices: readonly DeviceDocument[]; readonly doors: readonly DoorDocument[];
      readonly mission: DocumentMission & { readonly type: 'relay-clear-and-exit'; readonly requiredDeviceIds: readonly string[] } }
  | { readonly formatVersion: 3; readonly devices: readonly DeviceDocument[]; readonly doors: readonly DoorDocument[];
      readonly mission: DocumentMission & { readonly type: 'relay-clear-and-exit'; readonly requiredDeviceIds: readonly string[] } }
  | { readonly formatVersion: 4; readonly devices: readonly DeviceDocument[]; readonly doors: readonly DoorDocument[];
      readonly mission: DocumentMission & { readonly type: 'relay-clear-and-exit'; readonly requiredDeviceIds: readonly string[] } }
  | { readonly formatVersion: 5; readonly devices: readonly DeviceDocument[]; readonly doors: readonly DoorDocument[];
      readonly mission: DocumentMission & { readonly type: 'relay-clear-and-exit'; readonly requiredDeviceIds: readonly string[] } }
);
export interface ValidationIssue { readonly path: string; readonly code: string; readonly message: string }
export type ValidationResult = { readonly valid: true; readonly document: LevelDocument }
  | { readonly valid: false; readonly errors: readonly ValidationIssue[] };
export interface SolidDefinition { readonly id: string; readonly center: Vec3; readonly size: Vec3; readonly color: number; readonly pattern?: SurfacePattern; readonly vertices?: readonly Vec3[] }
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
  readonly devices?: readonly { readonly id: string; readonly label: string; readonly position: Vec3 }[];
  readonly doors?: readonly { readonly id: string; readonly connectionId: string; readonly deviceId: string; readonly solid: SolidDefinition }[];
}
