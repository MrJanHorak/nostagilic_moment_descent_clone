import type { BufferGeometry, ColorRepresentation, Group, Mesh, MeshStandardMaterial, Object3D, PointLight, Points, PointsMaterial, Vector3 } from 'three';
import type { EnemyType, MissionDefinition, ShotTarget, SolidCollider } from './contracts.js';
import type ProjectileManager from './entities/ProjectileManager.js';

export interface EnemyDefinition {
  readonly name: EnemyType;
  readonly color: number;
  readonly size: number;
  readonly health: number;
  readonly speed: number;
  readonly damage: number;
  readonly pointValue: number;
}
export interface EnemyShooter {
  readonly mesh: Object3D;
  readonly type: Pick<EnemyDefinition, 'name' | 'size'>;
}
export interface EnemyCombatTarget extends ShotTarget, EnemyShooter {
  readonly type: EnemyDefinition;
  health: number;
  velocity: Vector3;
  collisionRadius: number;
  lastFireTime: number;
  fireRate: number;
}
export interface EnemyInstance extends EnemyCombatTarget {
  readonly mesh: Group;
  isActive: boolean;
}
export interface EnemyMeshBuilder {
  buildMesh(body: Group, enemyType: EnemyDefinition): void;
}
// Runtime collaborators consumed by enemy orchestration, not a JSON level schema.
export interface EnemySpawn {
  readonly id?: string;
  readonly position: Vector3;
  readonly enemyType: EnemyType;
}
export interface EnemyLevelView {
  readonly tunnelWidth: number;
  readonly tunnelHeight: number;
  readonly isEndless: boolean;
  readonly solidColliders: readonly SolidCollider[];
  readonly currentLevel: {
    readonly kind?: 'arena';
    readonly mission?: MissionDefinition;
    readonly enemySpawns: readonly EnemySpawn[];
    readonly rendering?: { readonly enemyAccentLights?: boolean };
  } | null;
}
export type EnemyDropType = 'health' | 'speedBoost' | 'weaponUpgrade' | 'ammoPickup' | 'weaponPickup';
export interface EnemyDropSink {
  spawnPowerup(position: Vector3, type: EnemyDropType): unknown;
}
export type ProjectileType = 'standard' | 'laser' | 'plasma' | 'bomb' | 'missile' | 'heavylaser' | 'nova';
export type TrailType = 'standard' | 'pulse' | 'laser' | 'missile' | 'plasma' | null;
export interface ProjectileOptions {
  type?: ProjectileType;
  color?: ColorRepresentation;
  power?: number;
  playerVelocity?: Vector3 | null;
  speed?: number;
  explosive?: boolean;
  explosionRadius?: number;
  guided?: boolean;
  gravity?: number;
  heatSeek?: boolean;
  pulsate?: boolean;
  unstable?: boolean;
  penetrating?: boolean;
  acceleration?: number;
  trailType?: TrailType;
  launchOrigin?: Vector3;
}
export interface ProjectileBase {
  readonly ownerManager: ProjectileManager;
  readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  readonly velocity: Vector3;
  type: ProjectileType;
  power: number;
  launchOrigin?: Vector3;
  trail?: Points<BufferGeometry, PointsMaterial>;
  trailPositions?: Float32Array;
  trailIndex?: number;
  trailLength?: number;
  lastTrailUpdate: number;
}
export interface PlayerProjectile extends ProjectileBase {
  readonly faction: 'player';
  createdAt: number;
  explosive: boolean;
  guided: boolean;
  gravity: number;
  heatSeek: boolean;
  pulsate: boolean;
  unstable: boolean;
  penetrating: boolean;
  acceleration: number;
  light: PointLight;
  pulseData?: { originalScale: number; pulseSpeed: number; pulseAmount: number; baseOpacity: number; lastPulse: number };
}
export interface EnemyProjectile extends ProjectileBase {
  readonly faction: 'enemy';
  timestamp: number;
  life: number;
}
export type Projectile = PlayerProjectile | EnemyProjectile;
export interface CombatWorld {
  getColliders?(): readonly SolidCollider[];
  getTargets?(): readonly EnemyCombatTarget[];
  getRules?(): { readonly pulseDamage: number } | null | undefined;
  onTargetHit?(enemy: EnemyCombatTarget, projectile: PlayerProjectile, position: Vector3): void;
}
export interface CombatAudio {
  readonly initialized: boolean;
  playSound(id: string, options?: { volume?: number; pitch?: number }): unknown;
}
export interface CombatEffects {
  createExplosion(position: Vector3, color: ColorRepresentation, explosive?: boolean, radius?: number): void;
}
