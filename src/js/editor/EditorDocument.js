import { AUTHORED_PICKUPS, FACES, GRID, LIMITS, EXPANDED_LIMITS, MATERIALS, ROOM_LABEL_LIMIT, STORY_LIMITS, SURFACE_PATTERNS, WALL_THICKNESS, openingRules } from '../core/levels/document/LevelContent.js';
import { storyOf } from './StoryContent.js';
import { describeChange } from './EditorHistory.js';
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

/** Drop linked pairs and choices that name a deleted relay, and generators in a
 * deleted room. A choice left with one relay ends; that relay becomes required.
 * @param {any} draft @param {Set<string>} devices @param {Set<string>} rooms */
function pruneRelayRules(draft, devices, rooms) {
  const mission = draft.mission;
  if (mission.linkedRelays) {
    mission.linkedRelays = mission.linkedRelays.filter(/** @param {{ids: string[]}} link */ link => !link.ids.some(id => devices.has(id)));
    if (!mission.linkedRelays.length) delete mission.linkedRelays;
  }
  if (mission.choice) {
    const left = mission.choice.deviceIds.filter(/** @param {string} id */ id => !devices.has(id));
    if (left.length >= 2) mission.choice = { deviceIds: left };
    else { delete mission.choice; for (const id of left) if (!mission.requiredDeviceIds.includes(id)) mission.requiredDeviceIds.push(id); }
  }
  if (draft.generators) {
    draft.generators = draft.generators.filter(/** @param {{roomId: string}} generator */ generator => !rooms.has(generator.roomId));
    if (!draft.generators.length) delete draft.generators;
  }
}

/** @param {LevelDocument} document @param {string} prefix */
function nextId(document, prefix) {
  const ids = new Set([document.id, ...document.rooms.map(value => value.id), ...document.connections.map(value => value.id),
    ...document.entities.map(value => value.id), ...(document.formatVersion !== 1 ? [...document.devices, ...document.doors].map(value => value.id) : []),
    ...[...(storyOf(document)?.messages ?? []), ...(storyOf(document)?.logs ?? []), ...(storyOf(document)?.survivors ?? [])].map(value => value.id)]);
  let index = 1;
  while (ids.has(`${prefix}-${index}`)) index++;
  return `${prefix}-${index}`;
}

/** @param {LevelDocument} document @param {string} roomId @param {Face} port */
function occupied(document, roomId, port) {
  return document.connections.some(connection => [connection.a, connection.b].some(endpoint => endpoint.roomId === roomId && endpoint.port === port));
}

/** Drop story entries that refer to removed rooms, relays or robots, so deleting
 * content never leaves an invalid version-13 document behind.
 * @param {LevelDocument} draft @param {{rooms?: ReadonlySet<string>, devices?: ReadonlySet<string>, enemies?: ReadonlySet<string>}} removed */
function pruneStory(draft, removed) {
  if ((draft.formatVersion !== 13 && draft.formatVersion !== 14) || !draft.story) return;
  const rooms = removed.rooms ?? new Set(), devices = removed.devices ?? new Set(), enemies = removed.enemies ?? new Set();
  const story = /** @type {{ messages: import('../levelDocument.js').StoryMessage[], logs: import('../levelDocument.js').StoryLog[], survivors: import('../levelDocument.js').StorySurvivor[] }} */ (draft.story);
  story.messages = story.messages.filter(({ trigger }) => !(trigger.on === 'enter' && rooms.has(trigger.roomId))
    && !(trigger.on === 'device' && devices.has(trigger.deviceId)) && !(trigger.on === 'defeat' && enemies.has(trigger.enemyId)));
  story.logs = story.logs.filter(log => !rooms.has(log.roomId));
  story.survivors = story.survivors.filter(survivor => !rooms.has(survivor.roomId));
}

/** @typedef {import('./DraftTypes.js').Mutable<import('../levelDocument.js').StoryDocument>} MutableStory */

/** Upgrade a draft to version 13 and give it a story block on first story edit.
 * @param {LevelDocument} draft @returns {MutableStory} */
function ensureStory(draft) {
  const modern = modernize(draft);
  Object.assign(modern, { formatVersion: Math.max(13, modern.formatVersion) });
  const upgraded = /** @type {Extract<LevelDocument, {formatVersion: 13 | 14 | 15 | 16 | 17}>} */ (modern);
  upgraded.story ??= { messages: [], logs: [], survivors: [] };
  return /** @type {MutableStory} */ (upgraded.story);
}

/** Any placed item that has a room and a local position, story collectibles included.
 * @param {LevelDocument} document @param {string} id */
function placed(document, id) {
  if (id === '@spawn') return document.playerSpawn;
  const story = /** @type {MutableStory | undefined} */ (storyOf(document));
  return document.entities.find(value => value.id === id)
    ?? (document.formatVersion !== 1 ? document.devices.find(value => value.id === id) : undefined)
    ?? (story ? [...story.logs, ...story.survivors].find(value => value.id === id) : undefined);
}

/** @param {string} value @param {string} label @param {number} limit */
function storyText(value, label, limit) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new Error(`Enter ${label}.`);
  if (text.length > limit) throw new Error(`${label[0].toUpperCase()}${label.slice(1)} is limited to ${limit} characters.`);
  return text;
}

/** @param {{speaker: string, text: string, trigger: import('../levelDocument.js').StoryTrigger}} message */
function storyMessage(message) {
  return { speaker: storyText(message.speaker, 'a speaker', STORY_LIMITS.speaker), text: storyText(message.text, 'the message text', STORY_LIMITS.message), trigger: copy(message.trigger) };
}

/** Upgrade a copy only when an edit needs v3. Old files retain their version on import.
 * @param {LevelDocument} draft @returns {Extract<LevelDocument, {formatVersion: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17}>} */
function modernize(draft) {
  if (draft.formatVersion === 1 || draft.formatVersion === 2) Object.assign(draft, {
    formatVersion: 3, devices: draft.formatVersion === 1 ? [] : draft.devices,
    doors: draft.formatVersion === 1 ? [] : draft.doors,
    mission: { ...draft.mission, type: 'relay-clear-and-exit', requiredDeviceIds: draft.formatVersion === 1 ? [] : draft.mission.requiredDeviceIds },
  });
  return /** @type {Extract<LevelDocument, {formatVersion: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17}>} */ (draft);
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
    /** Undo/redo step names, parallel to past and future. @type {string[]} */ this.pastLabels = [];
    /** @type {string[]} */ this.futureLabels = [];
    this.saved = JSON.stringify(this.document);
  }
  /** Name of the edit Undo would revert, or '' when there is none. */
  get undoLabel() { return this.past.length ? this.pastLabels.at(-1) ?? 'Edit level' : ''; }
  /** Name of the edit Redo would reapply, or '' when there is none. */
  get redoLabel() { return this.future.length ? this.futureLabels.at(-1) ?? 'Edit level' : ''; }
  get dirty() { return JSON.stringify(this.document) !== this.saved; }
  get validation() { return validateLevelDocument(this.document); }
  /** Commands own their snapshots, including temporarily invalid semantic edits.
   * @param {(draft: LevelDocument) => void} edit */
  change(edit) {
    const draft = copy(this.document);
    edit(draft);
    if (JSON.stringify(draft) === JSON.stringify(this.document)) return;
    this.pastLabels.length = this.past.length;
    this.pastLabels.push(describeChange(this.document, draft));
    this.past.push(copy(this.document));
    if (this.past.length > 100) { this.past.shift(); this.pastLabels.shift(); }
    this.document = draft; this.future = []; this.futureLabels = [];
  }
  undo() {
    const previous = this.past.pop(); if (!previous) return '';
    const label = this.pastLabels.pop() ?? 'Edit level';
    this.future.push(this.document); this.futureLabels.push(label); this.document = previous;
    return label;
  }
  redo() {
    const next = this.future.pop(); if (!next) return '';
    const label = this.futureLabels.pop() ?? 'Edit level';
    this.past.push(this.document); this.pastLabels.push(label); this.document = next;
    return label;
  }
  /** Invalid imports leave the current document, history and dirty state intact.
   * @param {string} text */
  import(text) {
    /** @type {LevelDocument} */ const candidate = JSON.parse(serializeLevelDocument(parseLevelDocument(text)));
    this.document = candidate; this.past = []; this.future = []; this.pastLabels = []; this.futureLabels = []; this.saved = JSON.stringify(candidate);
  }
  export() { return serializeLevelDocument(this.document); }
  markSaved() { this.saved = JSON.stringify(this.document); }
  /** Recovery does not turn a draft into a validated export or a saved file.
   * @param {unknown} input */
  restoreDraft(input) {
    const result = validateLevelDraft(input); if (!result.valid) throw new Error('Saved draft is malformed or unsupported. Import a JSON backup instead.');
    this.document = copy(/** @type {LevelDocument} */ (result.document)); this.past = []; this.future = []; this.pastLabels = []; this.futureLabels = []; this.saved = '';
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
  /** Run several commands as one undo step without validating the result, so
   * deleting from an already-invalid draft still works. Any thrown error aborts all.
   * @param {(candidate: EditorDocument) => void} action */
  batch(action) {
    const candidate = new EditorDocument(); candidate.document = copy(this.document);
    action(candidate);
    this.change(draft => { for (const key of Object.keys(draft)) if (!(key in candidate.document)) delete /** @type {Record<string, unknown>} */ (draft)[key]; Object.assign(draft, candidate.document); });
  }

  /** Delete several items as one undo step. @param {readonly string[]} ids */
  deleteContents(ids) {
    for (const id of ids) { const kind = this.content(id).kind; if (kind === 'spawn' || kind === 'exit') throw new Error('Move the player spawn or exit instead of deleting it. Deselect it and try again.'); }
    this.batch(candidate => { for (const id of ids) candidate.deleteContent(id); });
  }

  /** Delete several rooms and their contents as one undo step. @param {readonly string[]} ids */
  deleteRooms(ids) {
    if (ids.length >= this.document.rooms.length) throw new Error('Keep at least one room.');
    this.batch(candidate => { for (const id of ids) candidate.deleteRoom(id); });
  }

  /** Move several items by the same world offset, validated together as one step.
   * Each stays in its own room, snapped to that room's grid.
   * @param {readonly string[]} ids @param {number[]} delta */
  moveContentGroup(ids, delta) {
    if (delta.length !== 3 || !delta.every(Number.isFinite)) throw new Error('Choose a finite offset.');
    this.checked(candidate => candidate.change(draft => {
      for (const id of ids) {
        const item = placed(draft, id); if (!item) throw new Error('Select mission content.');
        const room = draft.rooms.find(room => room.id === item.roomId); if (!room) throw new Error('Select a room first.');
        const world = toWorld(room, item.position).map((value, axis) => value + delta[axis]);
        item.position = /** @type {[number, number, number]} */ (toLocal(room, world).map(value => Math.round(value / GRID) * GRID));
      }
    }));
  }

  /** Move several rooms by the same offset in one step. Connections between the
   * moved rooms stay aligned; links to other rooms may need Snap connections.
   * @param {readonly string[]} ids @param {number[]} delta */
  moveRooms(ids, delta) {
    const grid = this.document.formatVersion >= 6 ? 0.25 : GRID;
    if (delta.length !== 3 || !delta.every(value => Number.isFinite(value) && Number.isInteger(value / grid))) throw new Error(`Move by whole ${grid}-unit steps.`);
    for (const id of ids) this.room(id);
    this.change(draft => {
      for (const room of draft.rooms) if (ids.includes(room.id)) {
        room.position = /** @type {[number, number, number]} */ (room.position.map((value, axis) => value + delta[axis]));
        if (room.position.some(value => Math.abs(value) > 4096)) throw new Error('Positions must stay within ±4096.');
      }
    });
  }

  /** @param {string} roomId @param {number[]} point @param {import('./EditorPicking.js').PlacementKind} kind @param {import('../contracts.js').EnemyType} [type]
   * @param {{title?: string, text?: string, name?: string}} [story] Text for a data log or trapped miner. */
  placeAt(roomId, point, kind, type = 'scout', story = {}) {
    const exit = this.document.entities.find(entity => entity.kind === 'exit');
    const position = placementPosition(this.room(roomId), point, kind, type, exit?.kind === 'exit' ? exit.radius : 1.5);
    let id = '';
    this.checked(candidate => {
      if (kind === 'spawn' || kind === 'exit') {
        id = kind === 'spawn' ? '@spawn' : candidate.document.mission.exitId;
        const rotation = candidate.document.playerSpawn.rotation;
        const yaw = (Math.round(2 * Math.atan2(rotation[1], rotation[3]) * 180 / Math.PI / 90) * 90 + 360) % 360;
        candidate.updateContent(id, roomId, position, false, yaw);
      } else if (kind === 'log' || kind === 'survivor') id = candidate.addStoryItem(roomId, kind, position, story);
      else id = candidate.addContent(roomId, kind === 'enemy' ? 'enemy' : kind === 'reactor' ? 'reactor' : kind === 'relay' ? 'relay' : 'pickup', kind === 'enemy' ? type : kind, position);
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
        if ('escape' in modern.mission && modern.mission.escape && devices.has(modern.mission.escape.triggerDeviceId)) delete modern.mission.escape;
        pruneRelayRules(modern, devices, new Set([roomId]));
        pruneStory(draft, { rooms: new Set([roomId]), devices, enemies: removed });
      }
    });
  }
  /** Set or clear a room's display label. Labels upgrade a draft to format 14.
   * @param {string} roomId @param {string} label */
  setRoomLabel(roomId, label) {
    this.room(roomId);
    const text = label.trim();
    if (text.length > ROOM_LABEL_LIMIT) throw new Error(`Room names are limited to ${ROOM_LABEL_LIMIT} characters.`);
    this.change(draft => {
      const room = draft.rooms.find(room => room.id === roomId); if (!room) return;
      if (text) { modernize(draft); Object.assign(draft, { formatVersion: Math.max(14, draft.formatVersion) }); room.label = text; } else delete room.label;
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
   * @param {string} roomId @param {Face} face @param {Room['prefab']} prefab @param {number[]} [endOffset] @param {number[]} [point] @returns {string} */
  attachRoom(roomId, face, prefab, endOffset = [0, 8], point) {
    if (this.document.rooms.length >= EXPANDED_LIMITS.rooms) throw new Error('Room limit reached (256).');
    const source = this.room(roomId);
    if (!connectableFace(source, face)) throw new Error('Sloped side faces stay solid. Continue from a corridor end face.');
    if (!FACES.includes(face)) throw new Error('Choose a wall.');
    if (occupied(this.document, roomId, face) && !point) {
      const frame = portFrame(source, face), span = prefab === 'box-room' ? 16 : 8;
      const offsets = [0, ...Array.from({ length: 16 }, (_, i) => (i % 2 ? -1 : 1) * Math.ceil((i + 1) / 2) * span)];
      for (const u of offsets) for (const v of offsets) {
        if (Math.abs(u) + span / 2 > frame.width / 2 || Math.abs(v) + (prefab === 'box-room' ? 6 : 4) > frame.height / 2) continue;
        const world = [...frame.center]; world[frame.u] += u; world[frame.v] += v;
        try { return this.attachRoom(roomId, face, prefab, endOffset, toLocal(source, world)); } catch { /* Try the next clear rectangle without changing history. */ }
      }
      throw new Error('No clear space for another attachment on this wall. Enlarge it, or right-click a free area to place precisely.');
    }
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
    const a = this.room(aId), b = this.room(bId);
    if (occupied(this.document, aId, portA) || occupied(this.document, bId, portB) || distance(portFrame(a, portA).center, portFrame(b, portB).center) > 1e-6) return this.connectFaces(aId, portA, bId, portB);
    const connection = connectionFor(this.document, a, portA, b, portB);
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
      if (pattern === 'lava' || pattern === 'water') Object.assign(draft, { formatVersion: Math.max(9, draft.formatVersion) });
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

  /** @param {string} triggerDeviceId @param {number} [durationSeconds] */
  setEscape(triggerDeviceId, durationSeconds = 60) {
    this.checked(candidate => {
      if (!triggerDeviceId) {
        if ('escape' in candidate.document.mission) delete candidate.document.mission.escape;
        return;
      }
      if (!Number.isInteger(durationSeconds) || durationSeconds < 10 || durationSeconds > 600) throw new Error('Escape time must be a whole number from 10 to 600 seconds.');
      const draft = modernize(candidate.document);
      Object.assign(draft, { formatVersion: Math.max(10, draft.formatVersion) });
      Object.assign(draft.mission, { escape: { triggerDeviceId, durationSeconds } });
    });
  }

  /** Team and choice rules for relays. Linked pairs (format 15) count only when both
   * relays fire within the window; a choice (format 17) lets the first of its relays
   * answer and locks the rest. Choice relays stop being required; relays leaving a
   * choice become required again.
   * @param {{linked?: {ids: [string, string], windowSeconds: number}[], choice?: string[]}} rules */
  setRelayRules({ linked = [], choice = [] }) {
    this.checked(candidate => {
      if (candidate.document.formatVersion === 1) throw new Error('Add a relay first.');
      const draft = modernize(candidate.document), devices = new Set(draft.devices.map(device => device.id));
      const picked = [...new Set(choice.filter(Boolean))];
      for (const id of [...linked.flatMap(link => link.ids), ...picked]) if (id && !devices.has(id)) throw new Error(`Unknown relay: ${id}`);
      if (picked.length === 1) throw new Error('A choice needs two or three relays.');
      if (picked.length > 3) throw new Error('A choice can offer at most three relays.');
      const mission = /** @type {any} */ (draft.mission);
      const previous = new Set(mission.choice?.deviceIds ?? []);
      // Relays leaving a choice become ordinary required relays again.
      for (const id of previous) if (!picked.includes(id) && devices.has(id) && !mission.requiredDeviceIds.includes(id)) mission.requiredDeviceIds.push(id);
      mission.requiredDeviceIds = mission.requiredDeviceIds.filter(/** @param {string} id */ id => !picked.includes(id));
      const pairs = linked.filter(link => link.ids[0] || link.ids[1]).map(link => {
        if (!link.ids[0] || !link.ids[1]) throw new Error('Pick both relays of a linked pair.');
        if (!Number.isFinite(link.windowSeconds) || link.windowSeconds < 1 || link.windowSeconds > 60) throw new Error('A linked window is 1 to 60 seconds.');
        return { ids: /** @type {[string, string]} */ ([link.ids[0], link.ids[1]]), windowSeconds: link.windowSeconds };
      });
      if (pairs.length) mission.linkedRelays = pairs; else delete mission.linkedRelays;
      if (picked.length) mission.choice = { deviceIds: picked }; else delete mission.choice;
      const needed = picked.length ? 17 : pairs.length ? 15 : draft.formatVersion;
      Object.assign(draft, { formatVersion: Math.max(needed, draft.formatVersion) });
    });
  }

  /** Place a finite robot generator (format 16) at a room-local point.
   * @param {string} roomId @param {[number, number, number]} position
   * @param {{enemyType: import('../contracts.js').EnemyType, count: number, intervalSeconds: number, maxAlive?: number}} settings @returns {string} */
  placeGenerator(roomId, position, { enemyType, count, intervalSeconds, maxAlive = 2 }) {
    this.room(roomId);
    if (!['scout', 'fighter', 'bomber', 'destroyer'].includes(enemyType)) throw new Error('Generators release scouts, fighters, bombers or destroyers.');
    if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error('A generator releases 1 to 12 robots.');
    if (!Number.isFinite(intervalSeconds) || intervalSeconds < 2 || intervalSeconds > 60) throw new Error('The release interval is 2 to 60 seconds.');
    if (!Number.isInteger(maxAlive) || maxAlive < 1 || maxAlive > 4) throw new Error('At most 1 to 4 of its robots may be active at once.');
    const existing = /** @type {any[]} */ (/** @type {any} */ (this.document).generators ?? []);
    if (existing.length >= 16) throw new Error('Generator limit reached (16).');
    const taken = new Set(existing.map(generator => generator.id));
    let index = 1; while (taken.has(`generator-${index}`)) index++;
    const id = `generator-${index}`;
    this.checked(candidate => {
      if (candidate.document.formatVersion === 1) throw new Error('Generators need a relay mission. Place a relay first.');
      const draft = modernize(candidate.document);
      Object.assign(draft, { formatVersion: Math.max(16, draft.formatVersion) });
      const list = /** @type {any} */ (draft).generators ??= [];
      list.push({ id, roomId, position: [...position], enemyType, count, intervalSeconds, maxAlive });
    });
    return id;
  }

  /** @param {readonly string[]} ids */
  removeGenerators(ids) {
    const remove = new Set(ids);
    this.change(draft => {
      const list = /** @type {any} */ (draft).generators;
      if (!list) return;
      /** @type {any} */ (draft).generators = list.filter(/** @param {{id: string}} generator */ generator => !remove.has(generator.id));
      if (!/** @type {any} */ (draft).generators.length) delete /** @type {any} */ (draft).generators;
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
    if (id === '@spawn') return { ...this.document.playerSpawn, id, kind: /** @type {const} */ ('spawn') };
    const value = this.document.entities.find(value => value.id === id)
      ?? (this.document.formatVersion !== 1 ? this.document.devices.find(value => value.id === id) : undefined);
    if (value) return 'kind' in value ? value : { ...value, kind: /** @type {const} */ ('relay') };
    const story = storyOf(this.document);
    const log = story?.logs.find(log => log.id === id); if (log) return { ...log, kind: /** @type {const} */ ('log') };
    const survivor = story?.survivors.find(survivor => survivor.id === id); if (survivor) return { ...survivor, kind: /** @type {const} */ ('survivor') };
    throw new Error('Select mission content.');
  }

  /** @param {string} roomId @param {'enemy' | 'pickup' | 'relay' | 'reactor'} kind @param {string} type @param {number[]} position */
  addContent(roomId, kind, type, position) {
    this.room(roomId);
    if (position.length !== 3 || !position.every(value => Number.isFinite(value) && Math.abs(value) <= 4096)) throw new Error('Enter finite room-local coordinates.');
    if (kind === 'enemy' && !enemyTypes.some(enemy => enemy.name === type)) throw new Error('Choose a registered enemy.');
    if (kind === 'pickup' && !Object.hasOwn(AUTHORED_PICKUPS, type)) throw new Error('Choose a registered pickup.');
    if (this.document.entities.length >= LIMITS.entities) throw new Error('Entity limit reached.');
    const id = nextId(this.document, kind);
    this.change(draft => {
      const local = /** @type {[number, number, number]} */ ([...position]);
      if (kind === 'relay' || kind === 'reactor') {
        const modern = modernize(draft); if (modern.devices.length >= 16) throw new Error('Relay limit reached (16).');
        if (kind === 'reactor') Object.assign(modern, { formatVersion: Math.max(12, modern.formatVersion) });
        modern.devices.push({ id, label: kind === 'reactor' ? 'Destroy reactor' : id, roomId, position: local, ...(kind === 'reactor' ? { kind, health: 100 } : {}) }); modern.mission.requiredDeviceIds.push(id);
      } else if (kind === 'enemy') {
        draft.entities.push({ id, kind, roomId, position: local, type: /** @type {import('../contracts.js').EnemyType} */ (type) }); draft.mission.requiredEnemyIds.push(id);
      } else draft.entities.push({ id, kind, roomId, position: local, type: /** @type {import('../levelDocument.js').PickupType} */ (type) });
    });
    return id;
  }

  /** @param {string} id @param {number} health */
  setReactorIntegrity(id, health) {
    if (this.content(id).kind !== 'reactor' || !Number.isInteger(health) || health < 10 || health > 1000) throw new Error('Reactor integrity must be a whole number from 10 to 1000.');
    this.change(draft => { if (draft.formatVersion !== 1) { const device = draft.devices.find(device => device.id === id); if (device) device.health = health; } });
  }

  /** @param {string} id @param {string} roomId @param {number[]} position @param {boolean} required @param {number} [yaw] */
  updateContent(id, roomId, position, required, yaw = 0) {
    this.room(roomId); this.content(id);
    if (position.length !== 3 || !position.every(value => Number.isFinite(value) && Math.abs(value) <= 4096) || ![0, 90, 180, 270].includes(yaw)) throw new Error('Enter finite room-local coordinates and a quarter-turn spawn heading.');
    this.change(draft => {
      const value = placed(draft, id);
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
    const item = placed(document, id);
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
        if ('escape' in modern.mission && modern.mission.escape?.triggerDeviceId === id) delete modern.mission.escape;
        pruneRelayRules(modern, new Set([id]), new Set());
        pruneStory(draft, { devices: new Set([id]), enemies: new Set([id]) });
      }
      const story = /** @type {MutableStory | undefined} */ (storyOf(draft));
      if (story) { story.logs = story.logs.filter(log => log.id !== id); story.survivors = story.survivors.filter(survivor => survivor.id !== id); }
    });
  }

  /** Place a data log or trapped miner. The first story edit upgrades to format 13.
   * @param {string} roomId @param {'log' | 'survivor'} kind @param {number[]} position
   * @param {{title?: string, text?: string, name?: string}} [fields] */
  addStoryItem(roomId, kind, position, fields = {}) {
    this.room(roomId);
    if (position.length !== 3 || !position.every(value => Number.isFinite(value) && Math.abs(value) <= 4096)) throw new Error('Enter finite room-local coordinates.');
    const existing = storyOf(this.document);
    if (kind === 'log' && (existing?.logs.length ?? 0) >= STORY_LIMITS.logs) throw new Error(`Data log limit reached (${STORY_LIMITS.logs}).`);
    if (kind === 'survivor' && (existing?.survivors.length ?? 0) >= STORY_LIMITS.survivors) throw new Error(`Miner limit reached (${STORY_LIMITS.survivors}).`);
    const id = nextId(this.document, kind === 'log' ? 'log' : 'miner'), local = /** @type {[number, number, number]} */ ([...position]);
    const log = kind === 'log' ? { id, roomId, position: local, title: storyText(fields.title ?? 'Data log', 'a log title', STORY_LIMITS.title), text: storyText(fields.text ?? 'Recovered entry.', 'the log text', STORY_LIMITS.logText) } : null;
    const survivor = kind === 'survivor' ? { id, roomId, position: local, name: storyText(fields.name ?? 'Trapped miner', "the miner's name", STORY_LIMITS.name) } : null;
    this.change(draft => {
      const story = ensureStory(draft);
      if (log) story.logs.push(log);
      if (survivor) story.survivors.push(survivor);
    });
    return id;
  }

  /** Edit a placed log's title/text or a miner's name.
   * @param {string} id @param {{title?: string, text?: string, name?: string}} fields */
  updateStoryItem(id, fields) {
    const content = this.content(id);
    if (content.kind !== 'log' && content.kind !== 'survivor') throw new Error('Select a data log or trapped miner.');
    const values = content.kind === 'log'
      ? { title: storyText(fields.title ?? content.title, 'a log title', STORY_LIMITS.title), text: storyText(fields.text ?? content.text, 'the log text', STORY_LIMITS.logText) }
      : { name: storyText(fields.name ?? content.name, "the miner's name", STORY_LIMITS.name) };
    this.change(draft => {
      const story = ensureStory(draft), item = [...story.logs, ...story.survivors].find(item => item.id === id);
      if (item) Object.assign(item, values);
    });
  }

  /** Add a radio message. Its trigger must name existing content; the result is validated.
   * @param {{speaker: string, text: string, trigger: import('../levelDocument.js').StoryTrigger}} message @returns {string} */
  addStoryMessage(message) {
    if ((storyOf(this.document)?.messages.length ?? 0) >= STORY_LIMITS.messages) throw new Error(`Radio message limit reached (${STORY_LIMITS.messages}).`);
    const values = storyMessage(message), id = nextId(this.document, 'msg');
    this.checked(candidate => candidate.change(draft => { ensureStory(draft).messages.push({ id, ...values }); }));
    return id;
  }

  /** @param {string} id @param {{speaker: string, text: string, trigger: import('../levelDocument.js').StoryTrigger}} message */
  updateStoryMessage(id, message) {
    if (!storyOf(this.document)?.messages.some(message => message.id === id)) throw new Error('Select a radio message.');
    const values = storyMessage(message);
    this.checked(candidate => candidate.change(draft => { const target = ensureStory(draft).messages.find(message => message.id === id); if (target) Object.assign(target, values); }));
  }

  /** Messages with the same trigger play in list order.
   * @param {string} id @param {-1 | 1} step */
  moveStoryMessage(id, step) {
    const messages = storyOf(this.document)?.messages ?? [], index = messages.findIndex(message => message.id === id);
    if (index < 0) throw new Error('Select a radio message.');
    const target = index + step; if (target < 0 || target >= messages.length) return;
    this.change(draft => { const list = ensureStory(draft).messages; [list[index], list[target]] = [list[target], list[index]]; });
  }

  /** @param {string} id */
  deleteStoryMessage(id) {
    if (!storyOf(this.document)?.messages.some(message => message.id === id)) throw new Error('Select a radio message.');
    this.change(draft => { const story = ensureStory(draft); story.messages = story.messages.filter(message => message.id !== id); });
  }

  /** @param {string} connectionId @param {string} deviceId
   * @param {{concealed?: boolean, sliding?: boolean, forceField?: boolean}} [options] */
  setDoor(connectionId, deviceId, options = {}) {
    if (!this.document.connections.some(connection => connection.id === connectionId)) throw new Error('Select a connection.');
    this.change(draft => {
      const modern = modernize(draft), previous = modern.doors.find(door => door.connectionId === connectionId);
      modern.doors = modern.doors.filter(door => door.connectionId !== connectionId);
      if (deviceId) {
        if (deviceId !== '@shot' && !modern.devices.some(device => device.id === deviceId)) throw new Error('Select the relay that unlocks this door.');
        if (modern.doors.length >= 16) throw new Error('Door limit reached (16).');
        const forceField = options.forceField ?? previous?.kind === 'force-field';
        if (forceField && (deviceId === '@shot' || options.concealed === true)) throw new Error('Force fields require a relay and cannot be concealed.');
        const concealed = forceField ? false : options.concealed ?? previous?.concealed;
        if (forceField) Object.assign(modern, { formatVersion: Math.max(11, modern.formatVersion) });
        if (deviceId === '@shot' || concealed !== undefined || options.sliding) Object.assign(modern, { formatVersion: Math.max(8, modern.formatVersion) });
        modern.doors.push({ id: previous?.id ?? nextId(draft, 'door'), connectionId,
          ...(deviceId === '@shot' ? { activation: 'shot' } : { deviceId }), ...(forceField ? { kind: 'force-field' } : {}), ...(concealed !== undefined ? { concealed } : {}) });
      }
    });
  }

  /** Create an accessible relay near spawn and its door as one undo command.
   * Existing placement/progression validation owns the candidate search.
   * @param {string} connectionId @param {{concealed?: boolean, sliding?: boolean, forceField?: boolean}} [options] */
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
