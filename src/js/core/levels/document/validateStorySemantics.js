import { LOG_RADIUS, SURVIVOR_RADIUS } from './LevelContent.js';
import { distance, fitsInside, toWorld } from './RoomMath.js';

/** Version 13 story references and placements. Runs after relay semantics, so devices
 * already appear in `ids` and `placements`.
 * @param {Extract<import('../../../levelDocument.js').LevelDocument, {formatVersion: 13 | 14 | 15 | 16}>} document
 * @param {(path: string, code: string, message: string) => void} issue
 * @param {Set<string>} ids
 * @param {{id: string, path: string, position: import('../../../levelDocument.js').Vec3, radius: number}[]} placements
 * @param {ReadonlySet<string>} reachable */
export default function validateStorySemantics(document, issue, ids, placements, reachable) {
  const story = document.story;
  if (!story) return;
  const rooms = new Map(document.rooms.map(room => [room.id, room]));
  const devices = new Set(document.devices.map(device => device.id));
  const enemies = new Set(document.entities.filter(entity => entity.kind === 'enemy').map(entity => entity.id));
  for (const [key, values] of /** @type {const} */ ([['messages', story.messages], ['logs', story.logs], ['survivors', story.survivors]])) {
    for (const [index, value] of values.entries()) {
      if (ids.has(value.id)) issue(`$.story.${key}[${index}].id`, 'duplicate-id', `Duplicate ID: ${value.id}`);
      ids.add(value.id);
    }
  }
  for (const [index, message] of story.messages.entries()) {
    const path = `$.story.messages[${index}].trigger`, trigger = message.trigger;
    if (trigger.on === 'enter' && !rooms.has(trigger.roomId)) issue(`${path}.roomId`, 'reference', `Unknown room: ${trigger.roomId}`);
    else if (trigger.on === 'enter' && !reachable.has(trigger.roomId)) issue(`${path}.roomId`, 'unreachable', `Message ${message.id} waits for an unreachable room`);
    if (trigger.on === 'device' && !devices.has(trigger.deviceId)) issue(`${path}.deviceId`, 'reference', `Unknown relay: ${trigger.deviceId}`);
    if (trigger.on === 'defeat' && !enemies.has(trigger.enemyId)) issue(`${path}.enemyId`, 'reference', `Unknown enemy: ${trigger.enemyId}`);
  }
  /** @type {readonly [string, readonly (import('../../../levelDocument.js').StoryLog | import('../../../levelDocument.js').StorySurvivor)[], number, string][]} */
  const collectibles = [['logs', story.logs, LOG_RADIUS, 'Data log'], ['survivors', story.survivors, SURVIVOR_RADIUS, 'Survivor']];
  for (const [key, values, radius, label] of collectibles) {
    for (const [index, item] of values.entries()) {
      const path = `$.story.${key}[${index}]`, room = rooms.get(item.roomId);
      if (!room) { issue(`${path}.roomId`, 'reference', `Unknown room: ${item.roomId}`); continue; }
      if (!fitsInside(room, item.position, radius)) issue(`${path}.position`, 'clearance', `${label} ${item.id} does not fit inside ${room.id}`);
      if (!reachable.has(room.id)) issue(`${path}.roomId`, 'unreachable', `${label} ${item.id} is unreachable from spawn`);
      const position = toWorld(room, item.position);
      for (const other of placements) if (distance(position, other.position) < radius + other.radius - 1e-6) {
        issue(`${path}.position`, 'placement-overlap', `${label} ${item.id} overlaps ${other.id}`);
      }
      placements.push({ id: item.id, path: `${path}.position`, position, radius });
    }
  }
}
