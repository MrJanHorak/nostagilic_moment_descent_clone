// A read-only summary of the current attempt for the pause menu and HUD. Pure: it
// reads mission, story and session state and never changes them.

/** @typedef {{ label: string, done: boolean, detail?: string }} StatusItem */
/** @typedef {{ label: string, count: number, total: number }} OptionalItem */
/** @typedef {{ name: string, required: StatusItem[], optional: OptionalItem[], timeMs: number,
 *   difficulty: string, escapeMs: number | null, exitReady: boolean }} MissionStatus */

/**
 * @param {{
 *   level: { name: string, devices?: readonly { id: string, label: string, kind?: string }[], enemySpawns?: readonly unknown[] },
 *   mission: import('./MissionObjective.js').default | null,
 *   story?: import('./StoryController.js').StorySummary | null,
 *   timeMs: number, difficulty: string, kills?: number,
 * }} input
 * @returns {MissionStatus} */
export function describeMissionStatus({ level, mission, story = null, timeMs, difficulty, kills = 0 }) {
  /** @type {StatusItem[]} */
  const required = [];
  const devices = new Map((level.devices ?? []).map(device => [device.id, device]));
  if (mission) {
    const escape = mission.definition.escape?.triggerDeviceId;
    for (const id of mission.requiredDeviceIds) {
      const device = devices.get(id), reactor = device?.kind === 'reactor';
      const label = `${reactor ? 'Destroy' : 'Activate'} ${device?.label ?? id}`;
      required.push({ label, done: mission.activatedDevices.has(id), ...(id === escape ? { detail: 'Starts the escape countdown' } : {}) });
    }
    if (mission.requiredIds.size) {
      required.push({ label: `Destroy required guards (${mission.defeats.size}/${mission.requiredIds.size})`, done: mission.defeats.size === mission.requiredIds.size });
    }
    required.push({ label: 'Reach extraction', done: mission.completed, detail: mission.ready ? 'Exit open: fly into the green ring' : 'Locked until the objectives above are complete' });
  }
  /** @type {OptionalItem[]} */
  const optional = [];
  if (story?.survivorsTotal) optional.push({ label: 'Survivors aboard', count: story.rescued, total: story.survivorsTotal });
  if (story?.logsTotal) optional.push({ label: 'Data logs recovered', count: story.logsFound, total: story.logsTotal });
  const robots = level.enemySpawns?.length ?? 0;
  if (robots) optional.push({ label: 'Robots destroyed', count: Math.min(kills, robots), total: robots });
  return {
    name: level.name, required, optional, timeMs: Math.max(0, timeMs), difficulty,
    escapeMs: mission ? mission.remainingEscapeMs(timeMs) : null, exitReady: !!mission?.ready,
  };
}

/** Short HUD form of the optional counts, e.g. "Aboard 1/2 · Logs 0/2". @param {MissionStatus} status */
export function optionalSummary(status) {
  return status.optional.filter(item => item.label !== 'Robots destroyed')
    .map(item => `${item.label === 'Survivors aboard' ? 'Aboard' : 'Logs'} ${item.count}/${item.total}`).join(' · ');
}
