import connectionDialog from './ConnectionDialog.js';
import doorDialog from './DoorDialog.js';
import openResizeDialog from './ResizeDialog.js';
import EditorDocument from './EditorDocument.js';
import { faceLabel, placementPosition } from './EditorPicking.js';
import { FACES, MATERIALS, SURFACE_PATTERNS, openingRules } from '../core/levels/document/LevelContent.js';
import { connectableFace, portFrame, openingFrame, toWorld } from '../core/levels/document/RoomMath.js';
import { enemyTypes } from '../entities/EnemyTypes.js';

/** @param {import('./EditorPicking.js').ViewportTarget} target
 * @param {{model: EditorDocument, viewport: import('./EditorViewport.js').default, menu: import('./ViewportMenu.js').default,
 * commit: (action: () => void) => void, select: (target: import('./EditorPicking.js').ViewportTarget) => void, inspect: () => void, moveSelected: () => void}} context */
export default function openContextActions(target, { model, viewport, menu, commit, select, inspect, moveSelected }) {
  const room = model.room(target.roomId), face = target.face;
  const worldPoint = toWorld(room, /** @type {[number, number, number]} */ (target.localPoint));
  const links = face ? model.document.connections.filter(link => [link.a, link.b].some(end => end.roomId === room.id && end.port === face)) : [];
  const score = (/** @type {import('../levelDocument.js').ConnectionDocument} */ link) => { const endpoint = link.a.roomId === room.id ? link.a : link.b, frame = openingFrame(room, endpoint); return Math.hypot(worldPoint[frame.u] - frame.center[frame.u], worldPoint[frame.v] - frame.center[frame.v]); };
  const connection = links.find(link => link.id === target.connectionId) ?? links.sort((a, b) => score(a) - score(b))[0];
  const used = new Set(model.document.connections.flatMap(connection => [connection.a, connection.b].filter(end => end.roomId === room.id).map(end => end.port)));
  const duplicateFace = face && connectableFace(room, face) && !used.has(face) ? face : FACES.find(face => connectableFace(room, face) && !used.has(face));
  const canAttach = face ? connectableFace(room, face) : false;
  const sideReason = 'Sloped side faces stay solid. Continue from a corridor end face.';
  const protectedRoom = model.document.rooms.length === 1 || model.document.playerSpawn.roomId === room.id || model.document.entities.some(entity => entity.kind === 'exit' && entity.roomId === room.id);
  /** @param {import('./EditorPicking.js').PlacementKind} kind @param {import('../contracts.js').EnemyType} [type] */
  const preview = (kind, type = 'scout') => {
    try {
      const exit = model.document.entities.find(entity => entity.kind === 'exit');
      const position = placementPosition(room, target.localPoint, kind, type, exit?.kind === 'exit' ? exit.radius : 1.5);
      const candidate = new EditorDocument(); candidate.document = structuredClone(model.document);
      try { candidate.placeAt(room.id, target.localPoint, kind, type); viewport.showPlacement(room.id, position); menu.error(''); }
      catch (error) { viewport.showPlacement(room.id, position, false); menu.error(error); }
    } catch (error) { viewport.showPlacement(room.id, null); menu.error(error); }
  };
  /** @param {import('./EditorPicking.js').PlacementKind} kind @param {import('../contracts.js').EnemyType} [type] */
  const place = (kind, type = 'scout') => commit(() => {
    const id = model.placeAt(room.id, target.localPoint, kind, type);
    select({ ...target, face: undefined, contentId: id });
  });
  const appearance = () => {
    if (!face) return;
    const frame = portFrame(room, face), preset = MATERIALS[room.materialPreset], style = room.surfaces?.[face];
    const color = style?.color ?? (frame.axis === 1 ? frame.direction < 0 ? preset.floor : preset.ceiling : preset.wall);
    menu.form('Wall appearance', `${room.id} · ${faceLabel(room, face)}`, [
      { id: 'color', label: 'Wall color', type: 'color', value: `#${color.toString(16).padStart(6, '0')}` },
      { id: 'pattern', label: 'Wall pattern', value: style?.pattern ?? 'plain', options: SURFACE_PATTERNS.map(pattern => ({ value: pattern, label: pattern })) },
    ], values => commit(() => model.setSurface(room.id, face, Number.parseInt(values.color.slice(1), 16), /** @type {import('../levelDocument.js').SurfacePattern} */ (values.pattern))));
  };
  const opening = () => {
    if (!connection) return;
    const devices = model.document.formatVersion === 1 ? [] : model.document.devices;
    const door = model.document.formatVersion === 1 ? undefined : model.document.doors.find(door => door.connectionId === connection.id);
    menu.form('Opening and door', `${connection.a.roomId} ↔ ${connection.b.roomId}. Offsets use the first room's face center.`, [
      { id: 'width', label: 'Passage width', type: 'number', value: String(connection.openingSize[0]), min: '2', max: String(openingRules(model.document.formatVersion).maxSize), step: String(openingRules(model.document.formatVersion).grid) },
      { id: 'height', label: 'Passage height/depth', type: 'number', value: String(connection.openingSize[1]), min: '2', max: model.document.formatVersion >= 6 ? '254' : '62', step: '0.5' },
      { id: 'u', label: 'Across wall (U)', type: 'number', value: String(connection.a.offset?.[0] ?? 0), step: String(openingRules(model.document.formatVersion).grid) },
      { id: 'v', label: 'Height/depth (V)', type: 'number', value: String(connection.a.offset?.[1] ?? 0), step: String(openingRules(model.document.formatVersion).grid) },
      { id: 'relay', label: 'Door control', value: door?.activation === 'shot' ? '@shot' : door?.deviceId ?? '', options: [{ value: '', label: 'Always open (no door)' }, { value: '@shot', label: 'Shoot door to open' }, ...devices.map(device => ({ value: device.id, label: device.label }))] },
    ], values => commit(() => model.checked(candidate => {
      candidate.updateOpening(connection.id, Number(values.width), Number(values.height), [Number(values.u), Number(values.v)]);
      candidate.setDoor(connection.id, values.relay);
    })));
  };
  const moveOpening = () => {
    if (!connection) return;
    commit(() => {
      const source = portFrame(model.room(connection.a.roomId), connection.a.port), world = toWorld(room, /** @type {[number, number, number]} */ (target.localPoint));
      const ranges = model.openingBounds(connection.id, ...connection.openingSize);
      const offset = [source.u, source.v].map((axis, index) => Math.max(ranges[index].min, Math.min(ranges[index].max, Math.round((world[axis] - source.center[axis]) / openingRules(model.document.formatVersion).grid) * openingRules(model.document.formatVersion).grid)));
      model.checked(candidate => candidate.updateOpening(connection.id, ...connection.openingSize, offset));
    });
  };
  /** @type {import('./ViewportMenu.js').MenuAction[]} */ const actions = [];
  if (target.contentId) {
    const content = model.content(target.contentId), protectedContent = content.kind === 'spawn' || content.kind === 'exit';
    actions.push({ label: 'Move selected item', action: moveSelected }, { label: 'Edit selected item', action: inspect }, { label: 'Delete selected item', disabled: protectedContent,
      reason: protectedContent ? 'Move the unique spawn or exit instead of deleting it.' : undefined,
      action: () => commit(() => model.checked(candidate => candidate.deleteContent(content.id))) });
  }
  if (face) actions.push(
    { label: 'Wall color and pattern…', action: appearance },
    ...(canAttach ? [{ label: 'Connect to existing room…', action: () => connectionDialog(room.id, face, model, menu, commit, worldPoint) }] : []),
    ...(connection ? [{ label: 'Add or edit door…', action: () => doorDialog(connection.id, model, menu, commit) }, { label: 'Use full shared opening', action: () => commit(() => model.fitOpening(connection.id)) }] : []),
    { label: 'Opening and door…', action: opening, disabled: !connection, reason: !connection ? canAttach ? 'Attach a neighbor here, or use Connections to join existing touching rooms.' : sideReason : undefined },
    ...(connection ? [{ label: 'Move opening to this point', action: moveOpening }] : []),
    ...(canAttach ? [
      { label: 'Attach room at this point', action: () => commit(() => { const id = model.attachAt(room.id, face, target.localPoint, 'box-room'); select({ ...target, roomId: id, face: undefined, contentId: undefined }); }) },
      { label: portFrame(room, face).axis === 1 ? 'Attach vertical shaft at this point' : 'Attach corridor at this point', action: () => commit(() => { const id = model.attachAt(room.id, face, target.localPoint, 'straight-corridor'); select({ ...target, roomId: id, face: undefined, contentId: undefined }); }) },
      { label: 'Attach ramp or diagonal corridor…', action: () => menu.form('Ramp or diagonal corridor', '16 units long. Move the far end right/up in the new corridor’s local frame; negative rise slopes down. Only end faces connect.', [
        { id: 'side', label: 'Sideways offset', type: 'number', value: '0', min: '-16', max: '16', step: '1' },
        { id: 'rise', label: 'Rise / fall', type: 'number', value: '8', min: '-16', max: '16', step: '1' },
      ], values => commit(() => { const id = model.attachAt(room.id, face, target.localPoint, 'offset-corridor', [Number(values.side), Number(values.rise)]); select({ ...target, roomId: id, face: undefined, contentId: undefined }); }), 'Attach corridor') },
    ] : []),
  );
  actions.push(
    { label: 'Place enemy…', preview: () => preview('enemy'), action: () => menu.form('Place enemy', `${room.id} · white/red marker shows the planned position`, [
      { id: 'type', label: 'Enemy type', value: 'scout', options: enemyTypes.map(enemy => ({ value: enemy.name, label: enemy.name })) },
    ], values => place('enemy', /** @type {import('../contracts.js').EnemyType} */ (values.type)), 'Place enemy', values => preview('enemy', /** @type {import('../contracts.js').EnemyType} */ (values.type))) },
    { label: 'Place health here', preview: () => preview('health'), action: () => place('health') },
    { label: 'Place ammo here', preview: () => preview('pulseAmmo'), action: () => place('pulseAmmo') },
    { label: 'Place reactor here', action: () => place('reactor'), preview: () => preview('reactor') },
    { label: 'Place relay here', preview: () => preview('relay'), action: () => place('relay') },
    { label: 'Move player spawn here', preview: () => preview('spawn'), action: () => place('spawn') },
    { label: 'Move exit here', preview: () => preview('exit'), action: () => place('exit') },
    { label: target.contentId ? 'Focus selected item' : 'Focus this room', action: () => viewport.frame(true) },
    { label: 'Resize room…', action: () => openResizeDialog(room.id, model, viewport, menu, commit) },
    { label: 'Snap connections', disabled: !used.size, reason: !used.size ? 'This room has no existing connection to realign.' : undefined, action: () => commit(() => model.snapConnections(room.id)) },
    { label: 'Duplicate room', disabled: !duplicateFace, reason: !duplicateFace ? 'No unused face is available for an adjacent duplicate.' : undefined,
      action: () => commit(() => { if (duplicateFace) { const id = model.duplicateRoom(room.id, duplicateFace); select({ ...target, roomId: id, face: undefined, contentId: undefined }); } }) },
    { label: 'Delete room and contents', disabled: protectedRoom, reason: protectedRoom ? 'Keep one room, and move its spawn/exit elsewhere before deletion.' : undefined,
      action: () => commit(() => model.deleteRoom(room.id)) },
  );
  menu.open(target.clientX, target.clientY, `${room.id}${face ? ` · ${faceLabel(room, face)}` : target.contentId ? ' · item' : ' · room'}`,
    'Right-click places just inside the selected surface, snapped to the grid. Esc closes this menu. Right-drag still pans.', actions);
  viewport.controls.enabled = false;
}
