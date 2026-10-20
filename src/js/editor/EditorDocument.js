import { AUTHORED_PICKUPS, FACES, GRID, LIMITS, EXPANDED_LIMITS, MATERIALS, SURFACE_PATTERNS, WALL_THICKNESS, openingRules } from '../core/levels/document/LevelContent.js';
import { faceOverlap, sharedOpening, connectedBranch } from './ConnectionTools.js';
import { enemyTypes } from '../entities/EnemyTypes.js';
import { connectableFace, distance, portFrame } from '../core/levels/document/RoomMath.js';
import { parseLevelDocument, serializeLevelDocument, validateLevelDocument, validateLevelDraft } from '../core/levels/document/validateLevelDocument.js';
import resizeRoom from './ResizeRoom.js';
import { placementPosition } from './EditorPicking.js';
import { toLocal, toWorld } from '../core/levels/document/RoomMath.js';

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
    ...document.entities.map(value => value.id), ...(document.formatVersion !== 1 ? [...document.devices, ...document.doors].map(value => value.id) : [])]);
  let index = 1;
  while (ids.has(`${prefix}-${index}`)) index++;
  return `${prefix}-${index}`;
}

/** @param {LevelDocument} document @param {string} roomId @param {Face} port */
function occupied(document, roomId, port) {
  return document.connections.some(connection => [connection.a, connection.b].some(endpoint => endpoint.roomId === roomId && endpoint.port === port));
}

/** Upgrade a copy only when an edit needs v3. Old files retain their version on import.
 * @param {LevelDocument} draft @returns {Extract<LevelDocument, {formatVersion: 3 | 4 | 5 | 6 | 7 | 8}>} */
function modernize(draft) {
  if (draft.formatVersion === 1 || draft.formatVersion === 2) Object.assign(draft, {
    formatVersion: 3, devices: draft.formatVersion === 1 ? [] : draft.devices,
    doors: draft.formatVersion === 1 ? [] : draft.doors,
    mission: { ...draft.mission, type: 'relay-clear-and-exit', requiredDeviceIds: draft.formatVersion === 1 ? [] : draft.mission.requiredDeviceIds },
  });
  return /** @type {Extract<LevelDocument, {formatVersion: 3 | 4 | 5 | 6 | 7 | 8}>} */ (draft);
}

/** Room ports use the runtime's exact world plane and clearance conventions.
 * @param {LevelDocument} document @param {Room} a @param {Face} portA @param {Room} b @param {Face} portB */
function connectionFor(document, a, portA, b, portB) {
  if (!connectableFace(a, portA) || !connectableFace(b, portB)) throw new Error('Sloped side faces stay solid. Connect through a corridor end face.');
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
  /** Recovery does not turn a draft into a validated export or a saved file.
   * @param {unknown} input */
  restoreDraft(input) {
    const result = validateLevelDraft(input); if (!result.valid) throw new Error('Saved draft is malformed or unsupported. Import a JSON backup instead.');
    this.document = copy(/** @type {LevelDocument} */ (result.document)); this.past = []; this.future = []; this.saved = '';
  }
  /** Compose a direct manipulation as one atomic, validated undo command.
   * @param {(candidate: EditorDocument) => void} action */
  checked(action) {
    const candidate = new EditorDocument(); candidate.document = copy(this.document);
    action(candidate);
    const result = candidate.validation;
    if (!result.valid) throw new Error(result.errors.slice(0, 3).map(issue => issue.message).join('\n'));
    this.change(draft => Object.assign(draft, candidate.document));
  }
  /** @param {string} roomId @param {number[]} point @param {import('./EditorPicking.js').PlacementKind} kind @param {import('../contracts.js').EnemyType} [type] */
  placeAt(roomId, point, kind, type = 'scout') {
    const exit = this.document.entities.find(entity => entity.kind === 'exit');
    const position = placementPosition(this.room(roomId), point, kind, type, exit?.kind === 'exit' ? exit.radius : 1.5);
    let id = '';
    this.checked(candidate => {
      if (kind === 'spawn' || kind === 'exit') {
        id = kind === 'spawn' ? '@spawn' : candidate.document.mission.exitId;
        const rotation = candidate.document.playerSpawn.rotation;
        const yaw = (Math.round(2 * Math.atan2(rotation[1], rotation[3]) * 180 / Math.PI / 90) * 90 + 360) % 360;
        candidate.updateContent(id, roomId, position, false, yaw);
      } else id = candidate.addContent(roomId, kind === 'enemy' ? 'enemy' : kind === 'relay' ? 'relay' : 'pickup', kind === 'enemy' ? type : kind, position);
    });
    return id;
  }
  /** @param {string} roomId @param {Face} face @param {number[]} point @param {Room['prefab']} prefab @param {number[]} [endOffset] */
  attachAt(roomId, face, point, prefab, endOffset) {
    let id = '';
    if (occupied(this.document, roomId, face)) {
      this.checked(candidate => { id = candidate.attachRoom(roomId, face, prefab, endOffset, point); });
      return id;
    }
    this.checked(candidate => {
      id = candidate.attachRoom(roomId, face, prefab, endOffset);
      const connection = candidate.document.connections[candidate.document.connections.length - 1];
      const source = portFrame(candidate.room(roomId), face), world = toWorld(candidate.room(roomId), /** @type {[number, number, number]} */ (point));
      const offsets = [source.u, source.v].map((axis, index) => {
        const half = (index === 0 ? source.width : source.height) / 2 - WALL_THICKNESS - 0.25 - connection.openingSize[index] / 2;
        const bound = Math.floor(half / GRID) * GRID;
        return Math.max(-bound, Math.min(bound, Math.round((world[axis] - source.center[axis]) / GRID) * GRID));
      });
      const room = candidate.room(id), position = [...room.position]; position[source.u] += offsets[0]; position[source.v] += offsets[1];
      candidate.updateRoom(id, { position });
      candidate.updateOpening(connection.id, ...connection.openingSize, offsets);
    });
    return id;
  }
  /** Duplicates the room's geometry, styles and ordinary content. Unique spawn/
   * exit and external door links stay in the original room.
   * @param {string} roomId @param {Face} face */
  duplicateRoom(roomId, face) {
    const source = copy(this.room(roomId)); let id = '';
    this.checked(candidate => candidate.change(draft => {
      if (draft.rooms.length >= EXPANDED_LIMITS.rooms) throw new Error('Room limit reached (256).');
      if (draft.rooms.length >= LIMITS.rooms) { modernize(draft); if (draft.formatVersion < 6) Object.assign(draft, { formatVersion: 6 }); }
      if (occupied(draft, roomId, face)) throw new Error('Choose an unused face for the duplicate.');
      id = nextId(draft, 'room'); const room = { ...copy(source), id, position: /** @type {[number, number, number]} */ ([0, 0, 0]) };
      const frame = portFrame(source, face), opposite = FACES.find(face => portFrame(room, face).normal.every((value, axis) => value === -frame.normal[axis]));
      if (!opposite) throw new Error('No compatible duplicate face.');
      const offset = portFrame(room, opposite).center;
      room.position = /** @type {[number, number, number]} */ (frame.center.map((value, axis) => value - offset[axis]));
      draft.rooms.push(room); draft.connections.push(connectionFor(draft, source, face, room, opposite));
      for (const entity of [...draft.entities].filter(entity => entity.roomId === roomId && entity.kind !== 'exit')) {
        if (draft.entities.length >= LIMITS.entities) throw new Error('Entity limit reached.');
        const next = { ...copy(entity), id: nextId(draft, entity.kind), roomId: id }; draft.entities.push(next);
        if (draft.mission.requiredEnemyIds.includes(entity.id)) draft.mission.requiredEnemyIds.push(next.id);
      }
      if (draft.formatVersion !== 1) for (const device of [...draft.devices].filter(device => device.roomId === roomId)) {
        if (draft.devices.length >= 16) throw new Error('Relay limit reached (16).');
        const deviceId = nextId(draft, 'relay');
        const next = { ...copy(device), id: deviceId, label: `${device.label.slice(0, 22)} · ${deviceId}`, roomId: id }; draft.devices.push(next); draft.mission.requiredDeviceIds.push(next.id);
      }
    }));
    return id;
  }
  /** @param {string} roomId */
  deleteRoom(roomId) {
    this.room(roomId);
    if (this.document.rooms.length === 1) throw new Error('Keep at least one room.');
    if (this.document.playerSpawn.roomId === roomId || this.document.entities.some(entity => entity.kind === 'exit' && entity.roomId === roomId)) throw new Error('Move the player spawn and exit to another room before deleting this room.');
    this.change(draft => {
      const removed = new Set(draft.entities.filter(entity => entity.roomId === roomId).map(entity => entity.id));
      const connections = new Set(draft.connections.filter(connection => connection.a.roomId === roomId || connection.b.roomId === roomId).map(connection => connection.id));
      draft.rooms = draft.rooms.filter(room => room.id !== roomId); draft.connections = draft.connections.filter(connection => !connections.has(connection.id));
      draft.entities = draft.entities.filter(entity => !removed.has(entity.id)); draft.mission.requiredEnemyIds = draft.mission.requiredEnemyIds.filter(id => !removed.has(id));
      if (draft.formatVersion !== 1) {
        const modern = modernize(draft), devices = new Set(modern.devices.filter(device => device.roomId === roomId).map(device => device.id));
        modern.devices = modern.devices.filter(device => !devices.has(device.id)); modern.doors = modern.doors.filter(door => !connections.has(door.connectionId) && (!door.deviceId || !devices.has(door.deviceId)));
        modern.mission.requiredDeviceIds = modern.mission.requiredDeviceIds.filter(id => !devices.has(id));
      }
    });
  }
  /** @param {string} roomId */
  room(roomId) {
    const room = this.document.rooms.find(value => value.id === roomId);
    if (!room) throw new Error('Select a room first.');
    return room;
  }
  /** @param {string} roomId @param {{position?: number[], size?: number[], yaw?: number, pitch?: number, roll?: number, endOffset?: number[], materialPreset?: string}} values */
  updateRoom(roomId, values) {
    const original = this.room(roomId);
    const candidate = { ...original, ...values }, expanded = this.document.formatVersion >= 6;
    if (![candidate.position, candidate.size].every((vector, index) => vector.length === 3 && vector.every(number => Number.isFinite(number) && Number.isInteger(number / (expanded && index === 0 ? 0.25 : GRID))))) throw new Error('Use the position grid (0.25 in format 6, otherwise 0.5) and 0.5 dimension grid.');
    if (candidate.position.some(number => Math.abs(number) > 4096) || candidate.size.some(number => number < 4 || number > (expanded ? 256 : 64))) throw new Error(`Positions must be within ±4096; dimensions must be 4–${expanded ? 256 : 64} units. Use Resize to expand an older document.`);
    if (![candidate.yaw, candidate.pitch ?? 0, candidate.roll ?? 0].every(value => [0, 90, 180, 270].includes(value))) throw new Error('Yaw, pitch and roll must be 0, 90, 180 or 270 degrees. Use corridor end offsets for slopes.');
    if (!Object.hasOwn(MATERIALS, candidate.materialPreset)) throw new Error('Choose a registered material.');
    if (!expanded && candidate.prefab !== 'box-room' && (candidate.size[0] > 8 || candidate.size[1] > 8 || candidate.size[2] < Math.max(candidate.size[0], candidate.size[1]))) throw new Error('Corridor width/height must be at most 8; length must be at least its width/height.');
    if (candidate.prefab === 'offset-corridor') {
      if (!candidate.endOffset || candidate.endOffset.length !== 2 || !candidate.endOffset.every(value => Number.isInteger(value) && Math.abs(value) <= (expanded ? 256 : 32)) || Math.hypot(...candidate.endOffset) > candidate.size[2]) throw new Error(`End offsets are whole units within ±${expanded ? 256 : 32}; their combined distance cannot exceed corridor length.`);
    } else if (candidate.endOffset) throw new Error('End offsets require a shaped corridor.');
    this.change(draft => {
      const updates = copy(values);
      // Unchanged zero controls must not silently upgrade old imported files.
      if (updates.pitch === 0 && original.pitch === undefined) delete updates.pitch;
      if (updates.roll === 0 && original.roll === undefined) delete updates.roll;
      if (updates.pitch !== undefined || updates.roll !== undefined) { modernize(draft); if (draft.formatVersion < 5) Object.assign(draft, { formatVersion: 4 }); }
      if (updates.endOffset !== undefined) { modernize(draft); if (draft.formatVersion < 5) Object.assign(draft, { formatVersion: 5 }); }
      Object.assign(draft.rooms.find(room => room.id === roomId) ?? {}, updates);
    });
  }
  /** Precise, atomic stretching keeps openings aligned and rejects unsafe
   * shrinks/loop constraints before touching history or the current document.
   * @param {string} roomId @param {number[]} size @param {string} [anchor] */
  resizeRoom(roomId, size, anchor = this.document.connections.find(link => link.a.roomId === roomId || link.b.roomId === roomId)?.id ?? 'center') {
    if (size.length === 3 && this.room(roomId).size.every((value, axis) => value === size[axis])) return;
    this.checked(candidate => {
      modernize(candidate.document); if (candidate.document.formatVersion < 6) Object.assign(candidate.document, { formatVersion: 6 });
      resizeRoom(candidate.document, roomId, size, anchor);
    });
  }
  /** Repair a disconnected draft by holding the neighboring anchor room still.
   * Existing content travels with each translated piece.
   * @param {string} roomId @param {string} [anchor] */
  snapConnections(roomId, anchor = this.document.connections.find(link => link.a.roomId === roomId || link.b.roomId === roomId)?.id) {
    if (!anchor) throw new Error('This room has no connection to snap. Attach it from an unused face first.');
    this.checked(candidate => {
      modernize(candidate.document); if (candidate.document.formatVersion < 6) Object.assign(candidate.document, { formatVersion: 6 });
      resizeRoom(candidate.document, roomId, candidate.room(roomId).size, anchor, true);
    });
  }
  /** Numeric dimensions use the same safe resize as direct stretching. Raw
   * transform edits remain available when dimensions are unchanged.
   * @param {string} roomId @param {Parameters<EditorDocument['updateRoom']>[1]} values */
  applyRoomProperties(roomId, values) {
    const original = this.room(roomId);
    if (!values.size || values.size.every((value, axis) => value === original.size[axis]) && values.size.length === 3) { this.updateRoom(roomId, values); return; }
    this.checked(candidate => {
      candidate.resizeRoom(roomId, values.size ?? original.size);
      const rest = copy(values); delete rest.size;
      if (rest.position?.length === 3 && rest.position.every((value, axis) => value === original.position[axis])) delete rest.position;
      candidate.updateRoom(roomId, rest);
    });
  }
  /** Attach creates room + connection atomically, including vertical hatches.
   * @param {string} roomId @param {Face} face @param {Room['prefab']} prefab @param {number[]} [endOffset] @param {number[]} [point] */
  attachRoom(roomId, face, prefab, endOffset = [0, 8], point) {
    if (this.document.rooms.length >= EXPANDED_LIMITS.rooms) throw new Error('Room limit reached (256).');
    const source = this.room(roomId);
    if (!connectableFace(source, face)) throw new Error('Sloped side faces stay solid. Continue from a corridor end face.');
    if (!FACES.includes(face) || occupied(this.document, roomId, face) && !point) throw new Error('Choose an unused attachment port, or right-click another area of this wall.');
    const frame = portFrame(source, face), id = nextId(this.document, 'room');
    /** @type {Room} */ const room = { id, prefab, position: [0, 0, 0], size: prefab === 'box-room' ? [16, 12, 16] : [8, 8, 16], yaw: 0, materialPreset: source.materialPreset };
    // Corridors run along the selected world axis, including vertical shafts.
    if (prefab === 'straight-corridor' && frame.axis === 0) room.yaw = 90;
    if (prefab === 'straight-corridor' && frame.axis === 1) room.pitch = 90;
    if (prefab === 'offset-corridor') {
      room.endOffset = /** @type {[number, number]} */ ([...endOffset]);
      if (frame.axis === 0) room.yaw = frame.direction > 0 ? 270 : 90;
      if (frame.axis === 1) room.pitch = frame.direction > 0 ? 90 : 270;
      if (frame.axis === 2) room.yaw = frame.direction > 0 ? 180 : 0;
    }
    const opposite = FACES.find(port => portFrame(room, port).normal.every((value, axis) => value === -frame.normal[axis]));
    if (!opposite) throw new Error('No compatible port.');
    const offset = portFrame(room, opposite).center;
    room.position = /** @type {[number, number, number]} */ (frame.center.map((value, axis) => value - offset[axis]));
    if (point) {
      if (point.length !== 3 || !point.every(Number.isFinite)) throw new Error('Choose a finite point on the wall.');
      const world = toWorld(source, /** @type {[number, number, number]} */ (point));
      for (const axis of [frame.u, frame.v]) room.position[axis] += Math.round((world[axis] - frame.center[axis]) / GRID) * GRID;
    }
    this.change(draft => {
      if (point) { modernize(draft); Object.assign(draft, { formatVersion: Math.max(7, draft.formatVersion) }); }
      if (room.pitch) { modernize(draft); if (draft.formatVersion < 5) Object.assign(draft, { formatVersion: 4 }); }
      if (prefab === 'offset-corridor') { modernize(draft); if (draft.formatVersion < 5) Object.assign(draft, { formatVersion: 5 }); }
      if (draft.rooms.length >= LIMITS.rooms) { modernize(draft); if (draft.formatVersion < 6) Object.assign(draft, { formatVersion: 6 }); }
      draft.rooms.push(room);
      draft.connections.push(point ? { id: nextId(draft, 'connection'), ...sharedOpening(source, face, room, opposite, false, toWorld(source, /** @type {[number, number, number]} */ (point))) } : connectionFor(draft, source, face, room, opposite));
      const result = validateLevelDocument(draft);
      if (!result.valid) throw new Error(result.errors.map(error => `${error.path}: ${error.message}`).join('\n'));
    });
    return id;
  }
  /** @param {string} aId @param {Face} portA @param {string} bId @param {Face} portB */
  connect(aId, portA, bId, portB) {
    if (this.document.connections.length >= EXPANDED_LIMITS.connections) throw new Error('Connection limit reached (512).');
    const connection = connectionFor(this.document, this.room(aId), portA, this.room(bId), portB);
    this.change(draft => { if (draft.connections.length >= LIMITS.connections) { modernize(draft); if (draft.formatVersion < 6) Object.assign(draft, { formatVersion: 6 }); } draft.connections.push(connection); });
  }

  /** Opposing faces with shared projected area; gaps may be fitted explicitly.
   * @param {string} roomId @param {Face} face */
  connectionTargets(roomId, face) {
    const source = this.room(roomId);
    /** @type {{roomId: string, face: Face, gap: number}[]} */ const targets = [];
    for (const room of this.document.rooms) for (const port of FACES) {
      if (room.id === roomId) continue;
      try {
        const area = faceOverlap(source, face, room, port);
        if (Math.abs(area.gap) <= 256 && (room.position[area.source.axis] - area.source.center[area.source.axis]) * area.source.direction >= -1e-6) targets.push({ roomId: room.id, face: port, gap: area.gap });
      } catch { /* Non-opposing, sloped or non-overlapping faces are not targets. */ }
    }
    return targets.sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap) || a.roomId.localeCompare(b.roomId));
  }

  /** Close a loop or align a free end to an existing wall. V7 supports exact
   * shared-face openings and multiple non-overlapping passages per wall.
   * @param {string} aId @param {Face} portA @param {string} bId @param {Face} portB
   * @param {{mode?: 'touch' | 'snap' | 'fit', full?: boolean, point?: number[]}} [options] */
  connectFaces(aId, portA, bId, portB, options = {}) {
    if (this.document.connections.length >= EXPANDED_LIMITS.connections) throw new Error('Connection limit reached (512).');
    let id = '';
    this.checked(candidate => {
      modernize(candidate.document); Object.assign(candidate.document, { formatVersion: Math.max(7, candidate.document.formatVersion) });
      const area = faceOverlap(candidate.room(aId), portA, candidate.room(bId), portB);
      if (Math.abs(area.gap) > 1e-6) {
        if (options.mode === 'fit') {
          const room = candidate.room(aId), anchor = candidate.document.connections.find(link => [link.a, link.b].some(end => end.roomId === aId && end.port === (portA === 'negativeZ' ? 'positiveZ' : 'negativeZ')));
          if (room.prefab === 'box-room' || !portA.endsWith('Z') || !anchor) throw new Error('Fit requires a corridor end with its opposite end already connected.');
          const target = [...candidate.room(bId).position];
          resizeRoom(candidate.document, aId, [room.size[0], room.size[1], room.size[2] + area.gap], anchor.id);
          if (candidate.room(bId).position.some((value, axis) => Math.abs(value - target[axis]) > 1e-6)) throw new Error('Fitting this branch would move the target room. Rework its other connections first.');
        } else if (options.mode === 'snap') {
          const branch = connectedBranch(candidate.document, aId);
          if (branch.has(bId)) throw new Error('These rooms already share a route. Use Fit corridor end or align the loop without moving the target.');
          for (const room of candidate.document.rooms) if (branch.has(room.id)) room.position[area.source.axis] += area.gap * area.source.direction;
        } else throw new Error('Faces do not share a plane. Choose Snap branch or Fit corridor end.');
      }
      const opening = sharedOpening(candidate.room(aId), portA, candidate.room(bId), portB, options.full ?? false, options.point);
      id = nextId(candidate.document, 'connection'); candidate.document.connections.push({ id, ...opening });
    });
    return id;
  }

  /** Fill the shared clear face, retaining its existing door/relay identity.
   * @param {string} id */
  fitOpening(id) {
    this.checked(candidate => {
      const link = candidate.document.connections.find(link => link.id === id); if (!link) throw new Error('Select a connection.');
      modernize(candidate.document); Object.assign(candidate.document, { formatVersion: Math.max(7, candidate.document.formatVersion) });
      Object.assign(link, sharedOpening(candidate.room(link.a.roomId), link.a.port, candidate.room(link.b.roomId), link.b.port, true));
    });
  }

  /** @param {string} roomId @param {Face | 'all'} face @param {number} color @param {import('../levelDocument.js').SurfacePattern} pattern */
  setSurface(roomId, face, color, pattern) {
    if ((!FACES.includes(/** @type {Face} */ (face)) && face !== 'all') || !Number.isInteger(color) || color < 0 || color > 0xffffff || !SURFACE_PATTERNS.includes(pattern)) throw new Error('Choose a face, color and supported wall pattern.');
    this.room(roomId);
    this.change(draft => {
      modernize(draft);
      const room = draft.rooms.find(room => room.id === roomId); if (!room) return;
      room.surfaces ??= {};
      for (const key of face === 'all' ? FACES : [face]) room.surfaces[key] = { color, pattern };
    });
  }

  /** @param {string} roomId @param {Face | 'all'} face */
  resetSurface(roomId, face) {
    this.room(roomId);
    this.change(draft => {
      const room = draft.rooms.find(room => room.id === roomId); if (!room?.surfaces) return;
      for (const key of face === 'all' ? FACES : [face]) delete room.surfaces[key];
      if (!Object.keys(room.surfaces).length) delete room.surfaces;
    });
  }

  /** @param {string} id */
  disconnect(id) {
    this.change(draft => {
      if (draft.formatVersion === 2) modernize(draft);
      draft.connections = draft.connections.filter(connection => connection.id !== id);
      if (draft.formatVersion !== 1) draft.doors = draft.doors.filter(door => door.connectionId !== id);
    });
  }

  /** Source-side offset ranges that leave frame clearance in both rooms.
   * @param {string} id @param {number} width @param {number} height */
  openingBounds(id, width, height) {
    const connection = this.document.connections.find(connection => connection.id === id);
    if (!connection) throw new Error('Select a connection.');
    const a = portFrame(this.room(connection.a.roomId), connection.a.port), b = portFrame(this.room(connection.b.roomId), connection.b.port);
    if (a.axis !== b.axis || a.direction !== -b.direction || a.center[a.axis] !== b.center[b.axis]) throw new Error('The room faces must share a plane and face opposite directions.');
    const { margin, grid } = openingRules(this.document.formatVersion);
    const ranges = [width, height].map((size, index) => {
      const axis = index === 0 ? a.u : a.v, halfA = (index === 0 ? a.width : a.height) / 2, halfB = (index === 0 ? b.width : b.height) / 2;
      const delta = a.center[axis] - b.center[axis];
      return { min: Math.ceil(Math.max(-halfA + margin + size / 2, -halfB + margin + size / 2 - delta) / grid - 1e-6) * grid,
        max: Math.floor(Math.min(halfA - margin - size / 2, halfB - margin - size / 2 - delta) / grid + 1e-6) * grid, delta };
    });
    if (ranges.some(range => range.min > range.max)) throw new Error('The opening is too large for the shared wall area.');
    return ranges;
  }

  /** @param {string} id @param {number} width @param {number} height @param {number[]} offset */
  updateOpening(id, width, height, offset) {
    const { grid, maxSize } = openingRules(this.document.formatVersion);
    if (offset.length !== 2 || ![width, height, ...offset].every(value => Number.isFinite(value) && Number.isInteger(value / grid)) || width < 2 || height < 2 || width > maxSize || height > maxSize) throw new Error(`Opening dimensions/offsets use the ${grid} unit grid; dimensions must be 2–${maxSize}.`);
    const ranges = this.openingBounds(id, width, height);
    if (ranges.some((range, index) => offset[index] < range.min || offset[index] > range.max)) throw new Error(`Opening must remain inside both wall frames: U ${ranges[0].min}…${ranges[0].max}, V ${ranges[1].min}…${ranges[1].max}.`);
    this.change(draft => {
      modernize(draft);
      const connection = draft.connections.find(connection => connection.id === id); if (!connection) return;
      connection.openingSize = [width, height]; connection.a.offset = [offset[0], offset[1]];
      connection.b.offset = [offset[0] + ranges[0].delta, offset[1] + ranges[1].delta];
    });
  }

  /** @param {string} id @param {number} width @param {number} height @param {string} anchor */
  anchorOpening(id, width, height, anchor) {
    const ranges = this.openingBounds(id, width, height);
    const u = anchor.includes('left') ? ranges[0].min : anchor.includes('right') ? ranges[0].max : Math.max(ranges[0].min, Math.min(ranges[0].max, 0));
    const v = anchor.includes('bottom') ? ranges[1].min : anchor.includes('top') ? ranges[1].max : Math.max(ranges[1].min, Math.min(ranges[1].max, 0));
    this.updateOpening(id, width, height, [u, v]);
  }

  /** @param {string} id */
  content(id) {
    if (id === '@spawn') return { ...this.document.playerSpawn, id, kind: 'spawn' };
    const value = this.document.entities.find(value => value.id === id)
      ?? (this.document.formatVersion !== 1 ? this.document.devices.find(value => value.id === id) : undefined);
    if (!value) throw new Error('Select mission content.');
    return 'kind' in value ? value : { ...value, kind: 'relay' };
  }

  /** @param {string} roomId @param {'enemy' | 'pickup' | 'relay'} kind @param {string} type @param {number[]} position */
  addContent(roomId, kind, type, position) {
    this.room(roomId);
    if (position.length !== 3 || !position.every(value => Number.isFinite(value) && Math.abs(value) <= 4096)) throw new Error('Enter finite room-local coordinates.');
    if (kind === 'enemy' && !enemyTypes.some(enemy => enemy.name === type)) throw new Error('Choose a registered enemy.');
    if (kind === 'pickup' && !Object.hasOwn(AUTHORED_PICKUPS, type)) throw new Error('Choose a registered pickup.');
    if (this.document.entities.length >= LIMITS.entities) throw new Error('Entity limit reached.');
    const id = nextId(this.document, kind);
    this.change(draft => {
      const local = /** @type {[number, number, number]} */ ([...position]);
      if (kind === 'relay') {
        const modern = modernize(draft); if (modern.devices.length >= 16) throw new Error('Relay limit reached (16).');
        modern.devices.push({ id, label: id, roomId, position: local }); modern.mission.requiredDeviceIds.push(id);
      } else if (kind === 'enemy') {
        draft.entities.push({ id, kind, roomId, position: local, type: /** @type {import('../contracts.js').EnemyType} */ (type) }); draft.mission.requiredEnemyIds.push(id);
      } else draft.entities.push({ id, kind, roomId, position: local, type: /** @type {import('../levelDocument.js').PickupType} */ (type) });
    });
    return id;
  }

  /** @param {string} id @param {string} roomId @param {number[]} position @param {boolean} required @param {number} [yaw] */
  updateContent(id, roomId, position, required, yaw = 0) {
    this.room(roomId); this.content(id);
    if (position.length !== 3 || !position.every(value => Number.isFinite(value) && Math.abs(value) <= 4096) || ![0, 90, 180, 270].includes(yaw)) throw new Error('Enter finite room-local coordinates and a quarter-turn spawn heading.');
    this.change(draft => {
      const value = id === '@spawn' ? draft.playerSpawn : draft.entities.find(value => value.id === id) ?? (draft.formatVersion !== 1 ? draft.devices.find(value => value.id === id) : undefined);
      if (!value) return;
      value.roomId = roomId; value.position = /** @type {[number, number, number]} */ ([...position]);
      if (id === '@spawn') draft.playerSpawn.rotation = [0, Math.sin(yaw * Math.PI / 360), 0, Math.cos(yaw * Math.PI / 360)];
      if ('kind' in value && value.kind === 'enemy') draft.mission.requiredEnemyIds = required ? [...new Set([...draft.mission.requiredEnemyIds, id])] : draft.mission.requiredEnemyIds.filter(value => value !== id);
    });
  }

  /** Stage a same-room item move without touching the document or history.
   * Preserve spawn quaternion, objective membership and relay/door references.
   * @param {string} id @param {number[]} world */
  previewContentMove(id, world) {
    if (world.length !== 3 || !world.every(Number.isFinite)) throw new Error('Choose a finite world position [x, y, z].');
    const content = this.content(id), room = this.room(content.roomId);
    const position = /** @type {[number, number, number]} */ (toLocal(room, world).map(value => Math.round(value / GRID) * GRID));
    const document = copy(this.document);
    const item = id === '@spawn' ? document.playerSpawn : document.entities.find(item => item.id === id) ?? (document.formatVersion !== 1 ? document.devices.find(item => item.id === id) : undefined);
    if (!item) throw new Error('Select mission content.');
    item.position = position;
    const validation = validateLevelDocument(document);
    return { document, world: toWorld(room, position), error: validation.valid ? '' : validation.errors.slice(0, 3).map(issue => issue.message).join('\n') };
  }

  /** A complete drag is one validated undo command. Preview and release share
   * the same local-grid/clearance checks; rejected moves leave history intact.
   * @param {string} id @param {number[]} world */
  moveContent(id, world) {
    const preview = this.previewContentMove(id, world);
    if (preview.error) throw new Error(preview.error);
    this.change(draft => Object.assign(draft, preview.document));
  }

  /** @param {string} id */
  deleteContent(id) {
    const value = this.content(id);
    if (value.kind === 'spawn' || value.kind === 'exit') throw new Error('Move the required spawn or exit instead of deleting it.');
    this.change(draft => {
      draft.entities = draft.entities.filter(value => value.id !== id); draft.mission.requiredEnemyIds = draft.mission.requiredEnemyIds.filter(value => value !== id);
      if (draft.formatVersion !== 1) {
        // V3 allows removing the last relay/door without an invalid v2 shell.
        const modern = modernize(draft); modern.devices = modern.devices.filter(value => value.id !== id);
        modern.doors = modern.doors.filter(door => door.deviceId !== id); modern.mission.requiredDeviceIds = modern.mission.requiredDeviceIds.filter(value => value !== id);
      }
    });
  }

  /** @param {string} connectionId @param {string} deviceId
   * @param {{concealed?: boolean, sliding?: boolean}} [options] */
  setDoor(connectionId, deviceId, options = {}) {
    if (!this.document.connections.some(connection => connection.id === connectionId)) throw new Error('Select a connection.');
    this.change(draft => {
      const modern = modernize(draft), previous = modern.doors.find(door => door.connectionId === connectionId);
      modern.doors = modern.doors.filter(door => door.connectionId !== connectionId);
      if (deviceId) {
        if (deviceId !== '@shot' && !modern.devices.some(device => device.id === deviceId)) throw new Error('Select the relay that unlocks this door.');
        if (modern.doors.length >= 16) throw new Error('Door limit reached (16).');
        const concealed = options.concealed ?? previous?.concealed;
        if (deviceId === '@shot' || concealed !== undefined || options.sliding) Object.assign(modern, { formatVersion: 8 });
        modern.doors.push({ id: previous?.id ?? nextId(draft, 'door'), connectionId,
          ...(deviceId === '@shot' ? { activation: 'shot' } : { deviceId }), ...(concealed !== undefined ? { concealed } : {}) });
      }
    });
  }

  /** Create an accessible relay near spawn and its door as one undo command.
   * Existing placement/progression validation owns the candidate search.
   * @param {string} connectionId @param {{concealed?: boolean, sliding?: boolean}} [options] */
  createRelayDoor(connectionId, options = {}) {
    if (!this.document.connections.some(link => link.id === connectionId)) throw new Error('Select a real connection before adding a door.');
    let id = '';
    this.checked(candidate => {
      const spawn = candidate.document.playerSpawn;
      for (const distance of [2, 3, 4, 6]) for (const axis of [0, 1, 2]) for (const sign of [1, -1]) {
        const test = new EditorDocument(); test.document = copy(candidate.document);
        const point = [...spawn.position]; point[axis] += distance * sign;
        const relay = test.addContent(spawn.roomId, 'relay', '', point); test.setDoor(connectionId, relay, options);
        if (test.validation.valid) { id = relay; Object.assign(candidate.document, test.document); return; }
      }
      throw new Error('No clear relay position near spawn. Place a relay in an accessible room, then link it to this door.');
    });
    return id;
  }
}
