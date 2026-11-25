/** Editor helpers for version-13 story content. Logs and miners behave like
 * ordinary placed content; radio messages are edited in the Story dialog. */

/** @typedef {import('../levelDocument.js').LevelDocument} LevelDocument */
/** @typedef {import('../levelDocument.js').StoryTrigger} StoryTrigger */
/** @typedef {(import('../levelDocument.js').StoryLog & {kind: 'log'}) | (import('../levelDocument.js').StorySurvivor & {kind: 'survivor'})} StoryPlacement */

/** @param {LevelDocument} document @returns {import('../levelDocument.js').StoryDocument | undefined} */
export function storyOf(document) {
  return document.formatVersion === 13 || document.formatVersion === 14 || document.formatVersion === 15 ? document.story : undefined;
}

/** Data logs and trapped miners as kind-tagged placements, in document order.
 * @param {LevelDocument} document @returns {StoryPlacement[]} */
export function storyPlacements(document) {
  const story = storyOf(document);
  if (!story) return [];
  return [...story.logs.map(log => ({ ...log, kind: /** @type {const} */ ('log') })), ...story.survivors.map(survivor => ({ ...survivor, kind: /** @type {const} */ ('survivor') }))];
}

/** A select value that round-trips through parseTrigger.
 * @param {StoryTrigger} trigger */
export function triggerValue(trigger) {
  return trigger.on === 'start' ? 'start' : trigger.on === 'enter' ? `enter:${trigger.roomId}` : trigger.on === 'device' ? `device:${trigger.deviceId}` : `defeat:${trigger.enemyId}`;
}

/** @param {string} value @returns {StoryTrigger} */
export function parseTrigger(value) {
  if (value === 'start') return { on: 'start' };
  const split = value.indexOf(':'), on = value.slice(0, split), id = value.slice(split + 1);
  if (split < 1 || !id) throw new Error('Choose when this message plays.');
  if (on === 'enter') return { on, roomId: id };
  if (on === 'device') return { on, deviceId: id };
  if (on === 'defeat') return { on, enemyId: id };
  throw new Error('Choose when this message plays.');
}

/** Every trigger the author can pick for the current document.
 * @param {LevelDocument} document @returns {{value: string, label: string}[]} */
export function triggerOptions(document) {
  const devices = document.formatVersion === 1 ? [] : document.devices;
  return [
    { value: 'start', label: 'Mission start' },
    ...document.rooms.map(room => ({ value: `enter:${room.id}`, label: `Pilot enters ${room.label ? `${room.label} (${room.id})` : room.id}` })),
    ...devices.map(device => ({ value: `device:${device.id}`, label: `${device.kind === 'reactor' ? 'Reactor destroyed' : 'Relay activated'}: ${device.label}` })),
    ...document.entities.filter(entity => entity.kind === 'enemy').map(enemy => ({ value: `defeat:${enemy.id}`, label: `Robot destroyed: ${enemy.id} (${enemy.kind === 'enemy' ? enemy.type : ''})` })),
  ];
}

/** Short, human description of a trigger for lists.
 * @param {StoryTrigger} trigger @param {LevelDocument} document */
export function describeTrigger(trigger, document) {
  const value = triggerValue(trigger);
  return triggerOptions(document).find(option => option.value === value)?.label ?? `Missing target (${value})`;
}
