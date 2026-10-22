import { Mesh, MeshBasicMaterial, MeshStandardMaterial, MathUtils } from 'three';

export const FIGHTER_WINDUP_MS = 650;
export const FIGHTER_RECOVERY_MS = 850;
export const FIGHTER_FLASH_MS = 120;
const REACQUIRE_DELAY_MS = 200;

/** All times are simulation milliseconds. No scheduled callbacks or timers can
 * survive the enemy/attempt that owns this state.
 * @param {number} now @param {number} interval
 * @param {{windupMs: number, recoveryMs: number}} [timing]
 * @returns {import('../combatContracts.js').FighterAttackState} */
export function createFighterAttack(now, interval, timing) {
  return { phase: 'idle', since: now, readyAt: now + Math.max(0, interval - (timing?.windupMs ?? FIGHTER_WINDUP_MS)), firedAt: -Infinity,
    ...(timing ? { windupMs: timing.windupMs, recoveryMs: timing.recoveryMs } : {}) };
}

/** Every shot requires a complete, uninterrupted visible wind-up. Long frames
 * advance at most one attack, never catch up with a burst of old shots.
 * @param {import('../combatContracts.js').FighterAttackState} state
 * @param {number} now @param {boolean} eligible @param {number} interval
 * @returns {'charge' | 'fire' | null} */
export function advanceFighterAttack(state, now, eligible, interval) {
  if (!Number.isFinite(now) || now < state.since) return null;
  const windup = state.windupMs ?? FIGHTER_WINDUP_MS, recovery = state.recoveryMs ?? FIGHTER_RECOVERY_MS;
  if (state.phase === 'windup') {
    if (!eligible) {
      state.phase = 'idle'; state.since = now; state.readyAt = now + REACQUIRE_DELAY_MS;
    } else if (now - state.since >= windup) {
      state.phase = 'recover'; state.since = now; state.firedAt = now; return 'fire';
    }
    return null;
  }
  if (state.phase === 'recover') {
    if (now - state.since < recovery) return null;
    state.phase = 'idle'; state.since = now;
    state.readyAt = state.firedAt + Math.max(interval, recovery + windup) - windup;
  }
  if (eligible && now >= state.readyAt) {
    state.phase = 'windup'; state.since = now; return 'charge';
  }
  return null;
}

/** @param {import('../combatContracts.js').EnemyCombatTarget} enemy */
export function fighterCommitted(enemy) {
  return enemy.fighterAttack?.phase === 'windup' || enemy.fighterAttack?.phase === 'recover';
}

/** Original parts provide the cue; no extra lights, full-screen flashes or
 * frame-dependent accumulated transforms. This never moves the combat body.
 * @param {import('../combatContracts.js').EnemyInstance} enemy @param {number} now */
export function presentFighterAttack(enemy, now) {
  const state = enemy.fighterAttack; if (!state) return;
  const charging = state.phase === 'windup', recovering = state.phase === 'recover';
  const flash = recovering && now - state.firedAt < FIGHTER_FLASH_MS;
  const windup = state.windupMs ?? FIGHTER_WINDUP_MS, recovery = state.recoveryMs ?? FIGHTER_RECOVERY_MS;
  const charge = MathUtils.clamp((now - state.since) / windup, 0, 1);
  const ring = enemy.mesh.getObjectByName('fighter_charge_ring');
  if (ring instanceof Mesh && ring.material instanceof MeshBasicMaterial) {
    ring.visible = charging || recovering;
    ring.material.color.setHex(flash ? 0xffffff : charging ? 0xffc34f : 0x235268);
    const size = flash ? 1 : charging ? 0.8 + charge * 0.2 : 0.75;
    ring.scale.set(size, size, 1); ring.rotation.z = charging ? charge * Math.PI : 0;
  }
  const weapon = enemy.mesh.getObjectByName('fighter_weapon');
  if (weapon) weapon.position.z = enemy.type.size * 1.2 + (charging ? charge * 0.08 : recovering ? -0.08 * Math.max(0, 1 - (now - state.since) / recovery) : 0);
  for (const name of ['fighter_weapon', 'fighter_wing_0']) {
    const part = enemy.mesh.getObjectByName(name);
    if (!(part instanceof Mesh)) continue;
    for (const material of Array.isArray(part.material) ? part.material : [part.material]) if (material instanceof MeshStandardMaterial) {
      material.emissive.setHex(flash ? 0xfff2ca : charging ? 0xffb244 : recovering ? 0x286d89 : enemy.type.color);
      material.emissiveIntensity = flash ? 2 : charging ? 0.9 + charge * 0.9 : recovering ? 0.35 : 0.8;
    }
  }
}
