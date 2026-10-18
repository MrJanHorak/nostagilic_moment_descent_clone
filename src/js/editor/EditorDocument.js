import { FACES, GRID, LIMITS, WALL_THICKNESS } from '../core/levels/document/LevelContent.js';
import { distance, portFrame } from '../core/levels/document/RoomMath.js';
import { parseLevelDocument, serializeLevelDocument, validateLevelDocument } from '../core/levels/document/validateLevelDocument.js';

/** @typedef {import('./DraftTypes.js').EditorLevelDocument} LevelDocument */
/** @typedef {import('./DraftTypes.js').EditorRoom} Room */
/** @typedef {import('../levelDocument.js').Face} Face */
/** @template T @param {T} value @returns {T} */
const copy = value => JSON.parse(JSON.stringify(value));

/** A minimal valid mission. Editing state never enters the exported JSON.
 * @returns {LevelDocument} */
export function createDocument() {
  return {
    formatVersion: 1, id: 'custom-mine', name: 'Untitled mine',
    rooms: [{ id: 'room-1', prefab: 'box-room', position: [0, 0, 0], size: [16, 12, 16], yaw: 0, materialPreset: 'industrial-blue' }],
    connections: [], playerSpawn: { roomId: 'room-1', position: [-3, 0, 3], rotation: [0, 0, 0, 1] },
    entities: [{ id: 'exit-1', kind: 'exit', roomId: 'room-1', position: [3, 0, -3], radius: 1.5 }],
    mission: { type: 'clear-and-exit', requiredEnemyIds: [], exitId: 'exit-1' },
    combat: { pulseDamage: 5, initialPulseAmmo: 60, maxPulseAmmo: 100 },
  };
}

/** @param {LevelDocument} document @param {string} prefix */
function nextId(document, prefix) {
  const ids = new Set([document.id, ...document.rooms.map(value => value.id), ...document.connections.map(value => value.id),
    ...document.entities.map(value => value.id), ...(document.formatVersion === 2 ? [...document.devices, ...document.doors].map(value => value.id) : [])]);
  let index = 1;
  while (ids.has(`${prefix}-${index}`)) index++;
  return `${prefix}-${index}`;
}

/** @param {LevelDocument} document @param {string} roomId @param {Face} port */
function occupied(document, roomId, port) {
  return document.connections.some(connection => [connection.a, connection.b].some(endpoint => endpoint.roomId === roomId && endpoint.port === port));
}

/** Room ports use the runtime's exact world plane and clearance conventions.
 * @param {LevelDocument} document @param {Room} a @param {Face} portA @param {Room} b @param {Face} portB */
function connectionFor(document, a, portA, b, portB) {
  if (a.id === b.id || occupied(document, a.id, portA) || occupied(document, b.id, portB)) throw new Error('Choose two different rooms with unused ports.');
  const frameA = portFrame(a, portA), frameB = portFrame(b, portB);
  if (distance(frameA.center, frameB.center) > 1e-6 || frameA.normal.some((value, axis) => value !== -frameB.normal[axis])) {
    throw new Error('Ports must meet at the same center and face opposite directions. Move or rotate the rooms first.');
  }
  const width = Math.min(6, Math.floor((Math.min(frameA.width, frameB.width) - 2 * WALL_THICKNESS - 0.5) / GRID) * GRID);
  const height = Math.min(6, Math.floor((Math.min(frameA.height, frameB.height) - 2 * WALL_THICKNESS - 0.5) / GRID) * GRID);
  if (width < 2 || height < 2) throw new Error('These ports have insufficient opening clearance.');
  return { id: nextId(document, 'connection'), a: { roomId: a.id, port: portA }, b: { roomId: b.id, port: portB }, openingSize: /** @type {[number, number]} */ ([width, height]) };
}

export default class EditorDocument {
  /** @param {import('../levelDocument.js').LevelDocument} [initial] */
  constructor(initial = createDocument()) {
    /** @type {LevelDocument} */ this.document = JSON.parse(serializeLevelDocument(initial));
    /** @type {LevelDocument[]} */ this.past = [];
    /** @type {LevelDocument[]} */ this.future = [];
    this.saved = JSON.stringify(this.document);
  }
  get dirty() { return JSON.stringify(this.document) !== this.saved; }
  get validation() { return validateLevelDocument(this.document); }
  /** Commands own their snapshots, including temporarily invalid semantic edits.
   * @param {(draft: LevelDocument) => void} edit */
  change(edit) {
    const draft = copy(this.document);
    edit(draft);
    if (JSON.stringify(draft) === JSON.stringify(this.document)) return;
    this.past.push(copy(this.document));
    if (this.past.length > 100) this.past.shift();
    this.document = draft; this.future = [];
  }
  undo() { const previous = this.past.pop(); if (previous) { this.future.push(this.document); this.document = previous; } }
  redo() { const next = this.future.pop(); if (next) { this.past.push(this.document); this.document = next; } }
  /** Invalid imports leave the current document, history and dirty state intact.
   * @param {string} text */
  import(text) {
    /** @type {LevelDocument} */ const candidate = JSON.parse(serializeLevelDocument(parseLevelDocument(text)));
    this.document = candidate; this.past = []; this.future = []; this.saved = JSON.stringify(candidate);
  }
  export() { return serializeLevelDocument(this.document); }
  markSaved() { this.saved = JSON.stringify(this.document); }
  /** @param {string} roomId */
  room(roomId) {
    const room = this.document.rooms.find(value => value.id === roomId);
    if (!room) throw new Error('Select a room first.');
    return room;
  }
  /** @param {string} roomId @param {{position?: number[], size?: number[], yaw?: number, materialPreset?: string}} values */
  updateRoom(roomId, values) {
    const original = this.room(roomId);
    const candidate = { ...original, ...values };
    if (![candidate.position, candidate.size].every(vector => vector.length === 3 && vector.every(number => Number.isFinite(number) && Number.isInteger(number / GRID)))) throw new Error('Position and size must use the 0.5 unit grid.');
    if (candidate.position.some(number => Math.abs(number) > 4096) || candidate.size.some(number => number < 4 || number > 64)) throw new Error('Positions must be within ±4096; dimensions must be 4–64 units.');
    if (![0, 90, 180, 270].includes(candidate.yaw)) throw new Error('Yaw must be 0, 90, 180 or 270 degrees.');
    if (!['industrial-blue', 'industrial-red', 'industrial-green'].includes(candidate.materialPreset)) throw new Error('Choose a registered material.');
    if (candidate.prefab === 'straight-corridor' && (candidate.size[0] > 8 || candidate.size[1] > 8 || candidate.size[2] < Math.max(candidate.size[0], candidate.size[1]))) throw new Error('Corridor width/height must be at most 8; length must be at least its width/height.');
    this.change(draft => { Object.assign(draft.rooms.find(room => room.id === roomId) ?? {}, copy(values)); });
  }
  /** Attach creates room + connection atomically, including vertical hatches.
   * @param {string} roomId @param {Face} face @param {'box-room' | 'straight-corridor'} prefab */
  attachRoom(roomId, face, prefab) {
    if (this.document.rooms.length >= LIMITS.rooms) throw new Error('Room limit reached (64).');
    const source = this.room(roomId);
    if (!FACES.includes(face) || occupied(this.document, roomId, face)) throw new Error('Choose an unused attachment port.');
    const frame = portFrame(source, face), id = nextId(this.document, 'room');
    /** @type {Room} */ const room = { id, prefab, position: [0, 0, 0], size: prefab === 'box-room' ? [16, 12, 16] : [8, 8, 16], yaw: 0, materialPreset: source.materialPreset };
    // Orient horizontal corridors along the selected world axis.
    if (prefab === 'straight-corridor' && frame.axis === 0) room.yaw = 90;
    const opposite = FACES.find(port => portFrame(room, port).normal.every((value, axis) => value === -frame.normal[axis]));
    if (!opposite) throw new Error('No compatible port.');
    const offset = portFrame(room, opposite).center;
    room.position = /** @type {[number, number, number]} */ (frame.center.map((value, axis) => value - offset[axis]));
    this.change(draft => {
      draft.rooms.push(room);
      draft.connections.push(connectionFor(draft, source, face, room, opposite));
      const result = validateLevelDocument(draft);
      if (!result.valid) throw new Error(result.errors.map(error => `${error.path}: ${error.message}`).join('\n'));
    });
    return id;
  }
  /** @param {string} aId @param {Face} portA @param {string} bId @param {Face} portB */
  connect(aId, portA, bId, portB) {
    if (this.document.connections.length >= LIMITS.connections) throw new Error('Connection limit reached (128).');
    const connection = connectionFor(this.document, this.room(aId), portA, this.room(bId), portB);
    this.change(draft => { draft.connections.push(connection); });
  }
}
