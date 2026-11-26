import type { Vector3 } from 'three';
import type { EnemyType, MissionDefinition, EscapeDefinition } from './contracts.js';

export type Vec3 = readonly [number, number, number];
export type Rotation = readonly [number, number, number, number];
export type Face = 'negativeX' | 'positiveX' | 'negativeY' | 'positiveY' | 'negativeZ' | 'positiveZ';
export type MaterialPreset = 'industrial-blue' | 'industrial-red' | 'industrial-green';
export type PickupType = 'health' | 'pulseAmmo';
export type SurfacePattern = 'plain' | 'grid' | 'panels' | 'hazard' | 'lava' | 'water';
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
  /** Version 14: optional display name shown in the editor and in-mission guide. */
  readonly label?: string;
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
/** Version 16: releases up to `count` robots, `maxAlive` at a time, once a pilot enters its room. */
export interface GeneratorDocument extends Placement { readonly id: string; readonly enemyType: Exclude<EnemyType, 'boss'>; readonly count: number; readonly intervalSeconds: number; readonly maxAlive: number }
export interface LinkedRelays { readonly ids: readonly [string, string]; readonly windowSeconds: number }
export interface DeviceDocument extends Placement { readonly id: string; readonly label: string; readonly kind?: 'reactor'; readonly health?: number }
export interface DoorDocument { readonly id: string; readonly connectionId: string; readonly deviceId?: string; readonly activation?: 'shot'; readonly concealed?: boolean; readonly kind?: 'force-field' }
/** Version 13 story layer: radio messages, collectible data logs and rescuable survivors. */
export type StoryTrigger =
  | { readonly on: 'start' }
  | { readonly on: 'enter'; readonly roomId: string }
  | { readonly on: 'device'; readonly deviceId: string }
  | { readonly on: 'defeat'; readonly enemyId: string };
export interface StoryMessage { readonly id: string; readonly speaker: string; readonly text: string; readonly trigger: StoryTrigger }
export interface StoryLog extends Placement { readonly id: string; readonly title: string; readonly text: string }
export interface StorySurvivor extends Placement { readonly id: string; readonly name: string }
export interface StoryDocument {
  readonly messages: readonly StoryMessage[];
  readonly logs: readonly StoryLog[];
  readonly survivors: readonly StorySurvivor[];
}
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
  | { readonly formatVersion: 6; readonly devices: readonly DeviceDocument[]; readonly doors: readonly DoorDocument[];
      readonly mission: DocumentMission & { readonly type: 'relay-clear-and-exit'; readonly requiredDeviceIds: readonly string[] } }
  | { readonly formatVersion: 7; readonly devices: readonly DeviceDocument[]; readonly doors: readonly DoorDocument[];
      readonly mission: DocumentMission & { readonly type: 'relay-clear-and-exit'; readonly requiredDeviceIds: readonly string[] } }
  | { readonly formatVersion: 8; readonly devices: readonly DeviceDocument[]; readonly doors: readonly DoorDocument[];
      readonly mission: DocumentMission & { readonly type: 'relay-clear-and-exit'; readonly requiredDeviceIds: readonly string[] } }
  | { readonly formatVersion: 9; readonly devices: readonly DeviceDocument[]; readonly doors: readonly DoorDocument[];
      readonly mission: DocumentMission & { readonly type: 'relay-clear-and-exit'; readonly requiredDeviceIds: readonly string[] } }
  | { readonly formatVersion: 10 | 11 | 12; readonly devices: readonly DeviceDocument[]; readonly doors: readonly DoorDocument[];
      readonly mission: DocumentMission & { readonly type: 'relay-clear-and-exit'; readonly requiredDeviceIds: readonly string[]; readonly escape?: EscapeDefinition } }
  | { readonly formatVersion: 13 | 14 | 15 | 16 | 17; readonly devices: readonly DeviceDocument[]; readonly doors: readonly DoorDocument[];
      readonly mission: DocumentMission & { readonly type: 'relay-clear-and-exit'; readonly requiredDeviceIds: readonly string[]; readonly escape?: EscapeDefinition;
        /** Version 15: relays that count only when both are activated within a window. */
        readonly linkedRelays?: readonly LinkedRelays[];
        /** Version 17: relays of which only the first activated counts; the others lock. */
        readonly choice?: { readonly deviceIds: readonly string[] } };
      readonly story?: StoryDocument; readonly generators?: readonly GeneratorDocument[] }
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
  /** Compiled story layer with world positions (version 13). */
  readonly story?: {
    readonly messages: readonly StoryMessage[];
    readonly logs: readonly (StoryLog & { readonly world: Vec3 })[];
    readonly survivors: readonly (StorySurvivor & { readonly world: Vec3 })[];
  };
  readonly devices?: readonly { readonly id: string; readonly label: string; readonly kind?: 'reactor'; readonly health?: number; readonly position: Vec3 }[];
  readonly doors?: readonly (DoorDocument & { readonly solid: SolidDefinition; readonly sliding?: boolean; readonly slideAxis?: number; readonly reverseStyle?: { readonly color: number; readonly pattern?: SurfacePattern }; readonly normalAxis?: number; readonly direction?: number })[];
}
