import { FACES } from '../core/levels/document/LevelContent.js';

/** @typedef {{roomId: string, face?: import('../levelDocument.js').Face, contentId?: string, connectionId?: string}} ValidationTarget */

/** Resolve a validator path against the current document, never an ID guessed
 * from the error's prose. Missing references have no selectable scene target.
 * @param {import('../levelDocument.js').LevelDocument} document
 * @param {string} path
 * @returns {ValidationTarget | null} */
export function validationTarget(document, path) {
  const devices = document.formatVersion === 1 ? [] : document.devices;
  const doors = document.formatVersion === 1 ? [] : document.doors;
  /** @param {string | undefined} id */
  const content = id => {
    const item = id === '@spawn' ? document.playerSpawn : [...document.entities, ...devices].find(item => item.id === id);
    return item && document.rooms.some(room => room.id === item.roomId) ? { roomId: item.roomId, contentId: id } : null;
  };
  /** @param {import('../levelDocument.js').ConnectionDocument | undefined} link @param {string} [side] */
  const connection = (link, side = 'a') => {
    if (!link) return null;
    const preferred = side === 'b' ? link.b : link.a, other = side === 'b' ? link.a : link.b;
    const end = [preferred, other].find(end => document.rooms.some(room => room.id === end.roomId));
    return end ? { roomId: end.roomId, face: end.port, connectionId: link.id } : null;
  };
  const indexed = path.match(/^\$\.(rooms|connections|entities|devices|doors)\[(\d+)\](?=\.|\[|$)/);
  if (indexed) {
    const index = Number(indexed[2]);
    switch (indexed[1]) {
      case 'rooms': {
        const room = document.rooms[index];
        const face = FACES.find(face => path.startsWith(`$.rooms[${index}].surfaces.${face}`));
        return room ? { roomId: room.id, ...(face ? { face } : {}) } : null;
      }
      case 'entities': return content(document.entities[index]?.id);
      case 'devices': return content(devices[index]?.id);
      case 'connections': return connection(document.connections[index], path.match(/\]\.([ab])(?:\.|$)/)?.[1]);
      case 'doors': {
        const door = doors[index];
        if (!door) return null;
        return connection(document.connections.find(link => link.id === door.connectionId));
      }
    }
  }
  if (/^\$\.playerSpawn(?:\.|$)/.test(path)) return content('@spawn');
  if (path === '$.mission.exitId') return content(document.mission.exitId);
  const required = path.match(/^\$\.mission\.(requiredEnemyIds|requiredDeviceIds)\[(\d+)\]$/);
  if (required) {
    const ids = required[1] === 'requiredEnemyIds' ? document.mission.requiredEnemyIds : document.formatVersion === 1 ? [] : document.mission.requiredDeviceIds;
    return content(ids[Number(required[2])]);
  }
  return null;
}
