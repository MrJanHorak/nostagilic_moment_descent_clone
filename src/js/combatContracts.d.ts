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
/** The pilot a robot is attacking (multiplayer: the nearest visible pilot). */
export interface EnemyTargetChoice { readonly id: string; readonly transform: Pick<Object3D, 'position'>; readonly pilot: import('./core/Pilot.js').default | null }
export interface EnemyShooter {
  readonly mesh: Object3D;
  readonly type: Pick<EnemyDefinition, 'name' | 'size'>;
  target?: EnemyTargetChoice;
  targetUntil?: number;
}
export interface EnemyCombatTarget extends ShotTarget, EnemyShooter {
  readonly type: EnemyDefinition;
  health: number;
  velocity: Vector3;
  collisionRadius: number;
  /** Hit box enlargement when the visible model is drawn smaller than full size. */
  hitScale?: number;
  lastFireTime: number;
  fireRate: number;
  fighterAttack?: FighterAttackState;
  /** Authored-mine bombers: same warning/launch/recovery cycle, lobbing area-denial bombs. */
  bomberAttack?: FighterAttackState;
  fighterMovement?: FighterMovementState;
  scoutAttack?: ScoutAttackState;
}
export interface FighterAttackState {
  phase: 'idle' | 'windup' | 'recover';
  since: number;
  readyAt: number;
  firedAt: number;
  windupMs?: number;
  recoveryMs?: number;
}
export interface FighterMovementState {
  target: Vector3;
  nextDecisionAt: number;
  interval: number;
  side: number;
  lift: number;
  decisions: number;
  mode: 'hold' | 'brace' | 'blocked' | 'approach' | 'retreat' | 'strafe';
}
export interface ScoutAttackState {
  phase: 'approach' | 'windup' | 'lunge' | 'recover';
  since: number;
  readyAt: number;
  direction: Vector3;
  aggressive?: boolean;
}
export interface EnemyInstance extends EnemyCombatTarget {
  readonly mesh: Group;
  isActive: boolean;
  /** Shields at spawn (boss phases are fractions of it). */
  maxHealth?: number;
  /** A boss's current phase, 1–3. */
  bossPhase?: number;
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
  readonly interaction?: { readonly closedConnections: ReadonlySet<string>; readonly revision: number } | null;
  readonly tunnelWidth: number;
  readonly tunnelHeight: number;
  readonly isEndless: boolean;
  readonly solidColliders: readonly SolidCollider[];
  readonly currentLevel: {
    readonly kind?: 'arena';
    readonly mission?: MissionDefinition;
    readonly sourceDocument?: import('./levelDocument.js').LevelDocument;
    readonly enemySpawns: readonly EnemySpawn[];
    readonly rendering?: { readonly enemyAccentLights?: boolean };
  } | null;
}
export type EnemyDropType = 'health' | 'pulseAmmo' | 'speedBoost' | 'weaponUpgrade' | 'ammoPickup' | 'weaponPickup' | 'laserSalvage' | 'missileSalvage' | 'plasmaSalvage';
export interface EnemyDropSink {
  spawnPowerup(position: Vector3, type: EnemyDropType, options?: { persistent?: boolean; spawnId?: string | null }): unknown;
}
export type ProjectileType = 'standard' | 'laser' | 'plasma' | 'bomb' | 'missile' | 'heavylaser' | 'nova';
export type TrailType = 'standard' | 'pulse' | 'laser' | 'missile' | 'plasma' | null;
export interface ProjectileOptions {
  /** Pilot who fired it. */
  ownerId?: string;
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
  /** Pilot who fired it, for kill credit and shooter memory. */
  readonly ownerId?: string;
  createdAt: number;
  explosive: boolean;
  explosionRadius: number;
  guided: boolean;
  gravity: number;
  heatSeek: boolean;
  pulsate: boolean;
  unstable: boolean;
  penetrating: boolean;
  acceleration: number;
  hitTargets: Set<EnemyCombatTarget>;
  resolving?: boolean;
  light?: PointLight;
  pulseData?: { originalScale: number; pulseSpeed: number; pulseAmount: number; baseOpacity: number; lastPulse: number };
}
export interface BombState {
  /** Where the bomb lands if nothing intercepts it. */
  readonly target: Vector3;
  readonly launchedAt: number;
  readonly flightMs: number;
  readonly armMs: number;
  readonly radius: number;
  readonly damage: number;
  readonly edgeFactor: number;
  /** Simulation time the bomb landed and began arming; null while in flight. */
  armedAt: number | null;
  warning?: Mesh;
}
export interface EnemyProjectile extends ProjectileBase {
  readonly faction: 'enemy';
  timestamp: number;
  life: number;
  bomb?: BombState;
}
export type Projectile = PlayerProjectile | EnemyProjectile;
export interface CombatWorld {
  /** Finite mines keep illumination stable; emissive shot meshes/trails remain. */
  readonly transientLights?: boolean;
  getColliders?(): readonly SolidCollider[];
  getTargets?(): readonly EnemyCombatTarget[];
  /** Pilot-vs-pilot modes: every live pilot's body except `ownerId` (null: all pilots). */
  getPilotTargets?(ownerId: string | null | undefined): readonly import('./contracts.js').ShotPlayer[];
  /** A player shot or blast reached a pilot. */
  onPilotHit?(pilot: import('./core/Pilot.js').default, power: number, attackerId: string | null, point: import('three').Vector3): void;
  getRules?(): { readonly pulseDamage: number } | null | undefined;
  onTargetHit?(enemy: EnemyCombatTarget, projectile: PlayerProjectile, position: Vector3): void;
  onWallHit?(collider: SolidCollider, projectile: PlayerProjectile, position: Vector3): void;
  onExplosion?(position: Vector3, radius: number): void;
}
export interface CombatAudio {
  readonly initialized: boolean;
  playSound(id: string, options?: { volume?: number; pitch?: number }): unknown;
}
export interface CombatEffects {
  createExplosion(position: Vector3, color: ColorRepresentation, explosive?: boolean, radius?: number): void;
}
