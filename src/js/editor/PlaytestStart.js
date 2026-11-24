import EditorDocument from './EditorDocument.js';

/** Export a copy of the level whose player spawn sits in the given room, for
 * testing a late section quickly. Tries the room centre, then nearby points on
 * the floor; the original document is never changed.
 * @param {EditorDocument} model @param {string} roomId @returns {string} */
export function playtestFromRoom(model, roomId) {
  const room = model.room(roomId);
  if (model.document.playerSpawn.roomId === roomId) return model.export();
  const floor = -room.size[1] / 2, reach = Math.min(room.size[0], room.size[2]) / 2;
  const points = [[0, 0, 0], [0, floor, 0]];
  for (const radius of [2, 4, 6]) if (radius < reach) for (const [x, z] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius]]) points.push([x, 0, z], [x, floor, z]);
  for (const point of points) {
    const copy = new EditorDocument(model.document);
    try { copy.placeAt(roomId, point, 'spawn'); return copy.export(); } catch { /* Try the next clear point. */ }
  }
  throw new Error(`No clear spot for the ship in ${roomId}. Playtest from the spawn, or make the room larger.`);
}
