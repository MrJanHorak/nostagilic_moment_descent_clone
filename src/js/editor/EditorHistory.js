/** Short, human names for undo steps, worked out by comparing two documents.
 * Every edit gets a name without each command having to supply one. */

/** @typedef {import('./DraftTypes.js').EditorLevelDocument} LevelDocument */

/** @template {{id: string}} T @param {readonly T[]} before @param {readonly T[]} after */
function delta(before, after) {
  const old = new Map(before.map(item => [item.id, item])), next = new Map(after.map(item => [item.id, item]));
  return {
    added: after.filter(item => !old.has(item.id)),
    removed: before.filter(item => !next.has(item.id)),
    changed: after.filter(item => old.has(item.id) && JSON.stringify(old.get(item.id)) !== JSON.stringify(item)),
  };
}
/** @param {string} word @param {number} count */
const plural = (word, count) => count === 1 ? word : `${count} ${word}s`;
/** @param {{kind?: string, type?: string}} item */
function noun(item) {
  if (item.kind === 'enemy') return 'enemy';
  if (item.kind === 'pickup') return item.type === 'health' ? 'health pickup' : 'ammo pickup';
  if (item.kind === 'reactor') return 'reactor';
  return item.kind ?? 'relay';
}
/** @param {LevelDocument} document */
function devices(document) { return document.formatVersion === 1 ? [] : document.devices; }
/** @param {LevelDocument} document */
function doors(document) { return document.formatVersion === 1 ? [] : document.doors; }
/** @param {LevelDocument} document */
function story(document) { return 'story' in document ? /** @type {{logs?: {id: string, position: unknown}[], survivors?: {id: string, position: unknown}[], messages?: unknown[]}} */ (document.story) : undefined; }

/** @param {LevelDocument} before @param {LevelDocument} after @returns {string} */
export function describeChange(before, after) {
  if (before.name !== after.name) return 'Rename mine';
  const rooms = delta(before.rooms, after.rooms);
  if (rooms.added.length) return rooms.added.length === 1 ? 'Add room' : `Add ${rooms.added.length} rooms`;
  if (rooms.removed.length) return rooms.removed.length === 1 ? 'Delete room' : `Delete ${rooms.removed.length} rooms`;
  const items = delta([...before.entities, ...devices(before)], [...after.entities, ...devices(after)]);
  if (items.added.length) return `Place ${plural(noun(items.added[0]), items.added.length)}`;
  if (items.removed.length) return items.removed.length === 1 ? `Delete ${noun(items.removed[0])}` : `Delete ${items.removed.length} items`;
  const beforeStory = story(before), afterStory = story(after);
  for (const [key, word] of /** @type {const} */ ([['logs', 'data log'], ['survivors', 'miner']])) {
    const change = delta(beforeStory?.[key] ?? [], afterStory?.[key] ?? []);
    if (change.added.length) return `Place ${plural(word, change.added.length)}`;
    if (change.removed.length) return `Delete ${plural(word, change.removed.length)}`;
  }
  const links = delta(before.connections, after.connections);
  if (links.added.length) return 'Connect rooms';
  if (links.removed.length) return 'Disconnect rooms';
  if (JSON.stringify(doors(before)) !== JSON.stringify(doors(after))) return 'Edit door';
  if (links.changed.length) return 'Edit opening';
  if (rooms.changed.length) {
    const old = before.rooms.find(room => room.id === rooms.changed[0].id), next = rooms.changed[0];
    const count = rooms.changed.length > 1 ? ` (${rooms.changed.length} rooms)` : '';
    if (JSON.stringify(old?.size) !== JSON.stringify(next.size)) return `Resize ${next.id}${count}`;
    if (old?.yaw !== next.yaw || old?.pitch !== next.pitch || old?.roll !== next.roll) return `Rotate ${next.id}`;
    if (JSON.stringify(old?.surfaces) !== JSON.stringify(next.surfaces)) return `Style ${next.id} walls`;
    if (old?.materialPreset !== next.materialPreset) return `Change ${next.id} material`;
    if (/** @type {{label?: string}} */ (old ?? {}).label !== /** @type {{label?: string}} */ (next).label) return `Rename ${next.id}`;
    if (JSON.stringify(old?.position) !== JSON.stringify(next.position)) return rooms.changed.length > 1 ? `Move ${rooms.changed.length} rooms` : `Move ${next.id}`;
    return `Edit ${next.id}`;
  }
  /** @type {{id: string, position?: unknown}[]} */ const moved = [...items.changed, ...delta(beforeStory?.logs ?? [], afterStory?.logs ?? []).changed, ...delta(beforeStory?.survivors ?? [], afterStory?.survivors ?? []).changed];
  if (JSON.stringify(before.playerSpawn) !== JSON.stringify(after.playerSpawn)) {
    if (!moved.length) return JSON.stringify(before.playerSpawn.position) === JSON.stringify(after.playerSpawn.position) && before.playerSpawn.roomId === after.playerSpawn.roomId ? 'Turn player spawn' : 'Move player spawn';
    moved.unshift({ id: 'player spawn', position: after.playerSpawn.position });
  }
  if (moved.length) {
    const first = /** @type {{id: string, position?: unknown}} */ (moved[0]), old = [...before.entities, ...devices(before), ...(beforeStory?.logs ?? []), ...(beforeStory?.survivors ?? [])].find(item => item.id === first.id);
    if (moved.length > 1) return `Edit ${moved.length} items`;
    return old && JSON.stringify(old.position) === JSON.stringify(first.position) ? `Edit ${first.id}` : `Move ${first.id}`;
  }
  if (JSON.stringify(beforeStory?.messages) !== JSON.stringify(afterStory?.messages)) return 'Edit radio messages';
  if (JSON.stringify(before.mission) !== JSON.stringify(after.mission)) return 'Edit mission';
  return 'Edit level';
}
