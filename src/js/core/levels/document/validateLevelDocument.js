import { enemyTypes } from '../../../entities/EnemyTypes.js';
import { AUTHORED_PICKUPS, FACES, GRID, LIMITS, documentLimits, openingRules, MATERIALS, SURFACE_PATTERNS } from './LevelContent.js';
import validateSemantics from './validateSemantics.js';

class Reader {
  constructor() {
    /** @type {import('../../../levelDocument.js').ValidationIssue[]} */
    this.errors = [];
  }
  /** @param {string} path @param {string} code @param {string} message */
  issue(path, code, message) { if (this.errors.length < LIMITS.errors) this.errors.push({ path, code, message }); }
  /** @param {unknown} value @param {string} path @param {readonly string[]} keys
   * @returns {Record<string, unknown> | null} */
  object(value, path, keys) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      this.issue(path, 'object', 'Expected an object'); return null;
    }
    const record = /** @type {Record<string, unknown>} */ (value);
    for (const key of Object.keys(record)) if (!keys.includes(key)) this.issue(`${path}.${key}`, 'field', 'Unknown field');
    return record;
  }
  /** @param {unknown} value @param {string} path @param {number} max @param {boolean} [id] */
  text(value, path, max, id = false) {
    if (typeof value !== 'string' || value.length < 1 || value.length > max || value.trim() !== value ||
      (id && !/^[a-zA-Z][a-zA-Z0-9:_-]*$/.test(value))) {
      this.issue(path, id ? 'id' : 'text', id ? 'Expected a 1–64 character ID using letters, digits, colon, underscore or hyphen' : `Expected 1–${max} trimmed characters`);
      return null;
    }
    return value;
  }
  /** @template {string | number} T @param {unknown} value @param {readonly T[]} choices @param {string} path
   * @returns {T | null} */
  choice(value, choices, path) {
    const result = choices.find(choice => choice === value);
    if (result === undefined) { this.issue(path, 'choice', `Expected one of: ${choices.join(', ')}`); return null; }
    return result;
  }
  /** @param {unknown} value @param {string} path @param {number} min @param {number} max @param {boolean} [integer] */
  number(value, path, min, max, integer = false) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      this.issue(path, 'number', `Expected ${integer ? 'an integer' : 'a finite number'} from ${min} to ${max}`); return null;
    }
    return value;
  }
  /** @param {unknown} value @param {string} path @param {number} max @returns {readonly unknown[] | null} */
  array(value, path, max) {
    if (!Array.isArray(value) || value.length > max) { this.issue(path, 'array', `Expected an array of at most ${max} entries`); return null; }
    return value;
  }
  /** @param {unknown} value @param {string} path @param {boolean | number} [snapped]
   * @returns {import('../../../levelDocument.js').Vec3 | null} */
  vector(value, path, snapped = false) {
    if (!Array.isArray(value) || value.length !== 3) { this.issue(path, 'vector', 'Expected [x, y, z]'); return null; }
    const x = this.number(value[0], `${path}[0]`, -4096, 4096), y = this.number(value[1], `${path}[1]`, -4096, 4096), z = this.number(value[2], `${path}[2]`, -4096, 4096);
    if (x === null || y === null || z === null) return null;
    if (snapped && [x, y, z].some(number => !Number.isInteger(number / (typeof snapped === 'number' ? snapped : GRID)))) { this.issue(path, 'grid', `Expected multiples of ${typeof snapped === 'number' ? snapped : GRID} world units`); return null; }
    return [x, y, z];
  }
  /** @param {unknown} value @param {string} path @returns {import('../../../levelDocument.js').Rotation | null} */
  rotation(value, path) {
    if (!Array.isArray(value) || value.length !== 4) { this.issue(path, 'rotation', 'Expected quaternion [x, y, z, w]'); return null; }
    const components = value.map((component, index) => this.number(component, `${path}[${index}]`, -1, 1));
    if (components.some(component => component === null)) return null;
    const [x, y, z, w] = components;
    if (x === null || y === null || z === null || w === null) return null;
    if (Math.abs(x * x + y * y + z * z + w * w - 1) > 1e-6) { this.issue(path, 'rotation', 'Quaternion must have unit length'); return null; }
    return [x, y, z, w];
  }
}

// Inspect descriptors before reading values. The public object API accepts JSON
// data trees, not Three.js instances, accessors, cycles or executable values.
/** @param {unknown} input @param {Reader} reader */
function inspectJSON(input, reader) {
  let nodes = 0;
  /** @type {Set<object>} */ const ancestors = new Set();
  /** @param {unknown} value @param {string} path @param {number} depth */
  function walk(value, path, depth) {
    if (++nodes > 50000 || depth > 16) { reader.issue(path, 'limit', 'JSON tree exceeds node/depth limits'); return; }
    if (value === null || typeof value === 'boolean' || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))) return;
    if (typeof value !== 'object') { reader.issue(path, 'json', 'Expected finite JSON data'); return; }
    if (ancestors.has(value)) { reader.issue(path, 'json', 'JSON data cannot contain cycles'); return; }
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (prototype !== (array ? Array.prototype : Object.prototype) && !(prototype === null && !array)) {
      reader.issue(path, 'json', 'Expected plain JSON objects/arrays'); return;
    }
    ancestors.add(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (array && Object.keys(descriptors).length !== value.length + 1) reader.issue(path, 'json', 'Sparse or extended arrays are not JSON data');
    for (const key of Reflect.ownKeys(descriptors)) {
      if (reader.errors.length >= LIMITS.errors || nodes > 50000) break;
      if (typeof key !== 'string') { reader.issue(path, 'json', 'Symbol keys are not JSON data'); continue; }
      if (array && key === 'length') continue;
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || descriptor.get || descriptor.set || (array && !/^(0|[1-9][0-9]*)$/.test(key))) {
        reader.issue(`${path}.${key}`, 'json', 'Expected enumerable data properties'); continue;
      }
      walk(descriptor.value, `${path}.${key}`, depth + 1);
    }
    ancestors.delete(value);
  }
  try { walk(input, '$', 0); }
  catch { reader.issue('$', 'json', 'Input could not be read as JSON data'); }
}

/** @param {unknown} value @param {string} path @param {Reader} reader @param {boolean} modern @param {boolean} oriented @param {boolean} shaped @param {boolean} expanded @param {number} version
 * @returns {import('../../../levelDocument.js').RoomDocument | null} */
function readRoom(value, path, reader, modern, oriented, shaped, expanded, version) {
  const object = reader.object(value, path, ['id', 'prefab', 'position', 'size', 'yaw', 'materialPreset', ...(modern ? ['surfaces'] : []), ...(oriented ? ['pitch', 'roll'] : []), ...(shaped ? ['endOffset'] : [])]);
  if (!object) return null;
  const id = reader.text(object.id, `${path}.id`, 64, true);
  const prefab = reader.choice(object.prefab, shaped ? /** @type {const} */ (['box-room', 'straight-corridor', 'offset-corridor']) : /** @type {const} */ (['box-room', 'straight-corridor']), `${path}.prefab`);
  const position = reader.vector(object.position, `${path}.position`, expanded ? 0.25 : GRID), size = reader.vector(object.size, `${path}.size`, true);
  const yaw = reader.choice(object.yaw, /** @type {const} */ ([0, 90, 180, 270]), `${path}.yaw`);
  const pitch = oriented && 'pitch' in object ? reader.choice(object.pitch, /** @type {const} */ ([0, 90, 180, 270]), `${path}.pitch`) : undefined;
  const roll = oriented && 'roll' in object ? reader.choice(object.roll, /** @type {const} */ ([0, 90, 180, 270]), `${path}.roll`) : undefined;
  const materialPreset = reader.choice(object.materialPreset, /** @type {const} */ (['industrial-blue', 'industrial-red', 'industrial-green']), `${path}.materialPreset`);
  if (!id || !prefab || !position || !size || yaw === null || !materialPreset) return null;
  const maxSize = expanded ? 256 : 64;
  if (size.some(dimension => dimension < 4 || dimension > maxSize)) reader.issue(`${path}.size`, 'size', `Room dimensions must be between 4 and ${maxSize}`);
  if (!expanded && prefab !== 'box-room' && (size[0] > 8 || size[1] > 8 || size[2] < Math.max(size[0], size[1]))) {
    reader.issue(`${path}.size`, 'size', 'Straight corridors have width/height at most 8 and length at least their width/height');
  }
  /** @type {[number, number] | undefined} */ let endOffset;
  if (shaped && prefab === 'offset-corridor') {
    const pair = reader.array(object.endOffset, `${path}.endOffset`, 2);
    if (!pair || pair.length !== 2) reader.issue(`${path}.endOffset`, 'shape', 'Expected [sideways, rise] for the local -Z end');
    else {
      const x = reader.number(pair[0], `${path}.endOffset[0]`, expanded ? -256 : -32, expanded ? 256 : 32, true), y = reader.number(pair[1], `${path}.endOffset[1]`, expanded ? -256 : -32, expanded ? 256 : 32, true);
      if (x !== null && y !== null) {
        endOffset = [x, y];
        if (Math.hypot(x, y) > size[2]) reader.issue(`${path}.endOffset`, 'shape', 'Combined end offset cannot exceed corridor length (maximum 45 degree slope)');
      }
    }
  } else if ('endOffset' in object) reader.issue(`${path}.endOffset`, 'field', 'End offsets require a version-5 offset-corridor');
  // This also ensures the runtime registry and structural enum stay aligned.
  if (!Object.hasOwn(MATERIALS, materialPreset)) reader.issue(`${path}.materialPreset`, 'content', 'Unknown material');
  /** @type {Partial<Record<import('../../../levelDocument.js').Face, import('../../../levelDocument.js').SurfaceStyle>>} */ const surfaces = {};
  if (modern && 'surfaces' in object) {
    const styles = reader.object(object.surfaces, `${path}.surfaces`, FACES);
    if (styles) for (const face of FACES) if (face in styles) {
      const style = reader.object(styles[face], `${path}.surfaces.${face}`, ['color', 'pattern']);
      const color = reader.number(style?.color, `${path}.surfaces.${face}.color`, 0, 0xffffff, true);
      const pattern = reader.choice(style?.pattern, SURFACE_PATTERNS, `${path}.surfaces.${face}.pattern`);
      if ((pattern === 'lava' || pattern === 'water') && version < 9) reader.issue(`${path}.surfaces.${face}.pattern`, 'version', 'Lava and water surfaces require formatVersion 9');
      if (color !== null && pattern) surfaces[face] = { color, pattern };
    }
  }
  return { id, prefab, position, size, yaw, materialPreset, ...(pitch !== undefined && pitch !== null ? { pitch } : {}), ...(roll !== undefined && roll !== null ? { roll } : {}), ...(endOffset ? { endOffset } : {}), ...(Object.keys(surfaces).length ? { surfaces } : {}) };
}

/** @param {unknown} value @param {string} path @param {Reader} reader @param {boolean} modern @param {boolean} expanded @param {number} version
 * @returns {import('../../../levelDocument.js').PortReference | null} */
function readPort(value, path, reader, modern, expanded, version) {
  const object = reader.object(value, path, ['roomId', 'port', ...(modern ? ['offset'] : [])]); if (!object) return null;
  const roomId = reader.text(object.roomId, `${path}.roomId`, 64, true), port = reader.choice(object.port, FACES, `${path}.port`);
  /** @type {[number, number] | undefined} */ let offset;
  if (modern && 'offset' in object) {
    const values = reader.array(object.offset, `${path}.offset`, 2);
    if (!values || values.length !== 2) reader.issue(`${path}.offset`, 'offset', 'Expected [horizontal, vertical/depth] offset');
    else {
      const u = reader.number(values[0], `${path}.offset[0]`, expanded ? -128 : -32, expanded ? 128 : 32), v = reader.number(values[1], `${path}.offset[1]`, expanded ? -128 : -32, expanded ? 128 : 32);
      if (u !== null && v !== null) {
        if (![u, v].every(number => Number.isInteger(number / openingRules(version).grid))) reader.issue(`${path}.offset`, 'grid', `Opening offsets must use the ${openingRules(version).grid} grid`);
        offset = [u, v];
      }
    }
  }
  return roomId && port ? { roomId, port, ...(offset ? { offset } : {}) } : null;
}

/** @param {unknown} value @param {string} path @param {Reader} reader @param {boolean} modern @param {boolean} expanded @param {number} version
 * @returns {import('../../../levelDocument.js').ConnectionDocument | null} */
function readConnection(value, path, reader, modern, expanded, version) {
  const object = reader.object(value, path, ['id', 'a', 'b', 'openingSize']); if (!object) return null;
  const id = reader.text(object.id, `${path}.id`, 64, true), a = readPort(object.a, `${path}.a`, reader, modern, expanded, version), b = readPort(object.b, `${path}.b`, reader, modern, expanded, version);
  const opening = reader.array(object.openingSize, `${path}.openingSize`, 2);
  if (!opening || opening.length !== 2) { reader.issue(`${path}.openingSize`, 'opening', 'Expected [width, height/depth]'); return null; }
  const width = reader.number(opening[0], `${path}.openingSize[0]`, 2, openingRules(version).maxSize), height = reader.number(opening[1], `${path}.openingSize[1]`, 2, openingRules(version).maxSize);
  if (!id || !a || !b || width === null || height === null) return null;
  if (![width, height].every(number => Number.isInteger(number / openingRules(version).grid))) reader.issue(`${path}.openingSize`, 'grid', `Openings must use the ${openingRules(version).grid} grid`);
  return { id, a, b, openingSize: [width, height] };
}

/** @param {unknown} value @param {string} path @param {Reader} reader
 * @returns {import('../../../levelDocument.js').EntityDocument | null} */
function readEntity(value, path, reader) {
  const object = reader.object(value, path, ['id', 'roomId', 'position', 'kind', 'type', 'radius']); if (!object) return null;
  const id = reader.text(object.id, `${path}.id`, 64, true), roomId = reader.text(object.roomId, `${path}.roomId`, 64, true);
  const position = reader.vector(object.position, `${path}.position`);
  const kind = reader.choice(object.kind, /** @type {const} */ (['enemy', 'pickup', 'exit']), `${path}.kind`);
  if (!id || !roomId || !position || !kind) return null;
  if (kind === 'exit') {
    if ('type' in object) reader.issue(`${path}.type`, 'field', 'Exit entities use radius, not a content type');
    const radius = reader.number(object.radius, `${path}.radius`, 0.75, 4);
    return radius === null ? null : { id, roomId, position, kind, radius };
  }
  if ('radius' in object) reader.issue(`${path}.radius`, 'field', 'Radius is only authored for exits');
  if (kind === 'enemy') {
    const type = reader.choice(object.type, enemyTypes.map(enemy => enemy.name), `${path}.type`);
    return type ? { id, roomId, position, kind, type } : null;
  }
  const type = reader.choice(object.type, /** @type {const} */ (['health', 'pulseAmmo']), `${path}.type`);
  if (type && !Object.hasOwn(AUTHORED_PICKUPS, type)) reader.issue(`${path}.type`, 'content', 'Unknown pickup');
  return type ? { id, roomId, position, kind, type } : null;
}

/** @param {unknown} value @param {string} path @param {Reader} reader @param {number} version
 * @returns {import('../../../levelDocument.js').DeviceDocument | null} */
function readDevice(value, path, reader, version) {
  const object = reader.object(value, path, ['id', 'label', 'roomId', 'position', ...(version >= 12 ? ['kind', 'health'] : [])]); if (!object) return null;
  const id = reader.text(object.id, `${path}.id`, 64, true), label = reader.text(object.label, `${path}.label`, 40);
  const roomId = reader.text(object.roomId, `${path}.roomId`, 64, true), position = reader.vector(object.position, `${path}.position`);
  const kind = 'kind' in object ? reader.choice(object.kind, /** @type {const} */ (['reactor']), `${path}.kind`) : undefined;
  const health = kind === 'reactor' ? reader.number(object.health, `${path}.health`, 10, 1000, true) : undefined;
  if ('health' in object && !kind) reader.issue(`${path}.health`, 'reactor', 'Integrity requires a reactor');
  return id && label && roomId && position ? { id, label, roomId, position, ...(kind && health !== null ? { kind, health } : {}) } : null;
}

/** @param {unknown} value @param {string} path @param {Reader} reader @param {number} version
 * @returns {import('../../../levelDocument.js').DoorDocument | null} */
function readDoor(value, path, reader, version) {
  const object = reader.object(value, path, ['id', 'connectionId', 'deviceId', ...(version >= 8 ? ['activation', 'concealed'] : []), ...(version >= 11 ? ['kind'] : [])]); if (!object) return null;
  const id = reader.text(object.id, `${path}.id`, 64, true), connectionId = reader.text(object.connectionId, `${path}.connectionId`, 64, true);
  const activation = 'activation' in object ? reader.choice(object.activation, /** @type {const} */ (['shot']), `${path}.activation`) : undefined;
  const deviceId = activation === 'shot' ? undefined : reader.text(object.deviceId, `${path}.deviceId`, 64, true);
  if (activation === 'shot' && 'deviceId' in object) reader.issue(`${path}.deviceId`, 'door-control', 'Shot doors have no relay link');
  if ('concealed' in object && typeof object.concealed !== 'boolean') reader.issue(`${path}.concealed`, 'boolean', 'Expected a boolean');
  const kind = 'kind' in object ? reader.choice(object.kind, /** @type {const} */ (['force-field']), `${path}.kind`) : undefined;
  if (kind && (activation === 'shot' || object.concealed === true)) reader.issue(path, 'field-control', 'Force fields require a relay and cannot be concealed');
  return id && connectionId && (deviceId || activation === 'shot') ? { id, connectionId, ...(deviceId ? { deviceId } : {}), ...(activation ? { activation } : {}), ...(kind ? { kind } : {}), ...(typeof object.concealed === 'boolean' ? { concealed: object.concealed } : {}) } : null;
}

/** @template T @param {T} value @returns {T} */
function freezeTree(value) {
  if (value !== null && typeof value === 'object') { for (const child of Object.values(value)) freezeTree(child); Object.freeze(value); }
  return value;
}

/** Validate unknown data without allocating Three.js scene resources. Returns an
 * owned, deeply frozen JSON snapshot on success; never edits the caller's data.
 * @param {unknown} input @returns {import('../../../levelDocument.js').ValidationResult} */
export function validateLevelDocument(input) { return readLevelDocument(input, true); }

/** Editor recovery accepts structurally safe, bounded JSON drafts, including
 * temporarily misaligned/overlapping layouts. Runtime compilation and file
 * import ALWAYS use validateLevelDocument and its full semantic checks.
 * @param {unknown} input @returns {import('../../../levelDocument.js').ValidationResult} */
export function validateLevelDraft(input) { return readLevelDocument(input, false); }

/** @param {unknown} input @param {boolean} semantics
 * @returns {import('../../../levelDocument.js').ValidationResult} */
function readLevelDocument(input, semantics) {
  const reader = new Reader(); inspectJSON(input, reader);
  if (reader.errors.length) return { valid: false, errors: reader.errors };
  const root = reader.object(input, '$', ['formatVersion', 'id', 'name', 'rooms', 'connections', 'playerSpawn', 'entities', 'mission', 'combat', 'devices', 'doors']);
  if (!root) return { valid: false, errors: reader.errors };
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(/** @type {number} */ (root.formatVersion))) reader.issue('$.formatVersion', 'version', 'Only level formatVersion 1–12 is supported');
  const version = Number(root.formatVersion), expanded = version >= 6, limits = documentLimits(expanded ? 6 : 1);
  const shaped = root.formatVersion === 5 || expanded, oriented = root.formatVersion === 4 || shaped, modern = root.formatVersion === 3 || oriented, relay = root.formatVersion === 2 || modern;
  if (!relay) for (const key of ['devices', 'doors']) if (key in root) reader.issue(`$.${key}`, 'field', 'Devices and doors require formatVersion 2');
  const id = reader.text(root.id, '$.id', 64, true), name = reader.text(root.name, '$.name', 80);
  const rooms = (reader.array(root.rooms, '$.rooms', limits.rooms) ?? []).map((value, i) => readRoom(value, `$.rooms[${i}]`, reader, modern, oriented, shaped, expanded, version)).filter(value => value !== null);
  const connections = (reader.array(root.connections, '$.connections', limits.connections) ?? []).map((value, i) => readConnection(value, `$.connections[${i}]`, reader, modern, expanded, version)).filter(value => value !== null);
  const entities = (reader.array(root.entities, '$.entities', LIMITS.entities) ?? []).map((value, i) => readEntity(value, `$.entities[${i}]`, reader)).filter(value => value !== null);
  const devices = relay ? (reader.array(root.devices, '$.devices', 16) ?? []).map((value, i) => readDevice(value, `$.devices[${i}]`, reader, version)).filter(value => value !== null) : [];
  const doors = relay ? (reader.array(root.doors, '$.doors', 16) ?? []).map((value, i) => readDoor(value, `$.doors[${i}]`, reader, version)).filter(value => value !== null) : [];
  if (root.formatVersion === 2 && (!devices.length || !doors.length)) reader.issue('$', 'relay', 'Version 2 requires at least one device and door');
  if (!rooms.length) reader.issue('$.rooms', 'rooms', 'At least one room is required');
  const spawn = reader.object(root.playerSpawn, '$.playerSpawn', ['roomId', 'position', 'rotation']);
  const roomId = reader.text(spawn?.roomId, '$.playerSpawn.roomId', 64, true), position = reader.vector(spawn?.position, '$.playerSpawn.position'), rotation = reader.rotation(spawn?.rotation, '$.playerSpawn.rotation');
  const mission = reader.object(root.mission, '$.mission', relay ? ['type', 'requiredEnemyIds', 'requiredDeviceIds', 'exitId', ...(version >= 10 ? ['escape'] : [])] : ['type', 'requiredEnemyIds', 'exitId']);
  const missionType = reader.choice(mission?.type, relay ? /** @type {const} */ (['relay-clear-and-exit']) : /** @type {const} */ (['clear-and-exit']), '$.mission.type');
  const exitId = reader.text(mission?.exitId, '$.mission.exitId', 64, true);
  const requiredEnemyIds = (reader.array(mission?.requiredEnemyIds, '$.mission.requiredEnemyIds', LIMITS.entities) ?? []).map((value, i) => reader.text(value, `$.mission.requiredEnemyIds[${i}]`, 64, true)).filter(value => value !== null);
  const requiredDeviceIds = relay ? (reader.array(mission?.requiredDeviceIds, '$.mission.requiredDeviceIds', 16) ?? []).map((value, i) => reader.text(value, `$.mission.requiredDeviceIds[${i}]`, 64, true)).filter(value => value !== null) : [];
  /** @type {import('../../../contracts.js').EscapeDefinition | undefined} */ let escape;
  if (version >= 10 && mission && 'escape' in mission) {
    const settings = reader.object(mission.escape, '$.mission.escape', ['triggerDeviceId', 'durationSeconds']);
    const triggerDeviceId = reader.text(settings?.triggerDeviceId, '$.mission.escape.triggerDeviceId', 64, true);
    const durationSeconds = reader.number(settings?.durationSeconds, '$.mission.escape.durationSeconds', 10, 600, true);
    if (triggerDeviceId && durationSeconds !== null) escape = { triggerDeviceId, durationSeconds };
  }
  const combat = reader.object(root.combat, '$.combat', ['pulseDamage', 'initialPulseAmmo', 'maxPulseAmmo']);
  const pulseDamage = reader.number(combat?.pulseDamage, '$.combat.pulseDamage', 1, 100);
  const initialPulseAmmo = reader.number(combat?.initialPulseAmmo, '$.combat.initialPulseAmmo', 0, 2000, true), maxPulseAmmo = reader.number(combat?.maxPulseAmmo, '$.combat.maxPulseAmmo', 1, 2000, true);
  if (initialPulseAmmo !== null && maxPulseAmmo !== null && initialPulseAmmo > maxPulseAmmo) reader.issue('$.combat.initialPulseAmmo', 'ammo', 'Initial ammo exceeds capacity');
  if (!id || !name || !roomId || !position || !rotation || !missionType || !exitId || pulseDamage === null || initialPulseAmmo === null || maxPulseAmmo === null || reader.errors.length) return { valid: false, errors: reader.errors };
  const base = { id, name, rooms, connections, playerSpawn: { roomId, position, rotation }, entities, combat: { pulseDamage, initialPulseAmmo, maxPulseAmmo } };
  /** @type {import('../../../levelDocument.js').LevelDocument} */
  const document = relay
    ? { ...base, formatVersion: version === 12 ? 12 : version === 11 ? 11 : version === 10 ? 10 : version === 9 ? 9 : version === 8 ? 8 : version === 7 ? 7 : expanded ? 6 : shaped ? 5 : oriented ? 4 : modern ? 3 : 2, devices, doors, mission: { type: 'relay-clear-and-exit', requiredEnemyIds, requiredDeviceIds, exitId, ...(escape ? { escape } : {}) } }
    : { ...base, formatVersion: 1, mission: { type: 'clear-and-exit', requiredEnemyIds, exitId } };
  if (semantics) validateSemantics(document, (path, code, message) => reader.issue(path, code, message));
  return reader.errors.length ? { valid: false, errors: reader.errors } : { valid: true, document: freezeTree(document) };
}

export class LevelDocumentError extends Error {
  /** @param {readonly import('../../../levelDocument.js').ValidationIssue[]} errors */
  constructor(errors) {
    super(errors.slice(0, 4).map(error => `${error.path}: ${error.message}`).join('\n'));
    this.name = 'LevelDocumentError'; this.errors = errors;
  }
}

/** @param {string} text @returns {import('../../../levelDocument.js').LevelDocument} */
export function parseLevelDocument(text) {
  if (typeof text !== 'string' || text.length > LIMITS.text) throw new LevelDocumentError([{ path: '$', code: 'limit', message: `Expected JSON text of at most ${LIMITS.text} UTF-16 code units` }]);
  /** @type {unknown} */ let input;
  try { input = JSON.parse(text); }
  catch { throw new LevelDocumentError([{ path: '$', code: 'json', message: 'Invalid JSON text' }]); }
  const result = validateLevelDocument(input); if (!result.valid) throw new LevelDocumentError(result.errors);
  return result.document;
}

/** @param {unknown} input */
export function serializeLevelDocument(input) {
  const result = validateLevelDocument(input); if (!result.valid) throw new LevelDocumentError(result.errors);
  return JSON.stringify(result.document, null, 2) + '\n';
}
