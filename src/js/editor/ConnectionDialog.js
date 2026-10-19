import { faceLabel } from './EditorPicking.js';

/** @param {string} roomId @param {import('../levelDocument.js').Face} face
 * @param {import('./EditorDocument.js').default} model @param {import('./ViewportMenu.js').default} menu
 * @param {(action: () => void) => void} commit @param {number[]} [point] */
export default function connectionDialog(roomId, face, model, menu, commit, point) {
  const targets = model.connectionTargets(roomId, face);
  const existing = (/** @type {typeof targets[number]} */ target) => model.document.connections.some(link => [link.a, link.b].some(end => end.roomId === roomId && end.port === face) && [link.a, link.b].some(end => end.roomId === target.roomId && end.port === target.face));
  targets.sort((a, b) => Number(existing(a)) - Number(existing(b)) || Math.abs(a.gap) - Math.abs(b.gap));
  if (!targets.length) throw new Error('No opposing wall shares enough area here. Move a room sideways into alignment, or choose another face.');
  const source = model.room(roomId), first = targets[0];
  const anchored = source.prefab !== 'box-room' && face.endsWith('Z') && model.document.connections.some(link => [link.a, link.b].some(end => end.roomId === roomId && end.port === (face === 'negativeZ' ? 'positiveZ' : 'negativeZ')));
  menu.form('Connect existing rooms', `${roomId} · ${faceLabel(source, face)}. Close a loop with touching faces, fit a corridor end, or snap a separate branch. Shared wall areas become real passages.`, [
    { id: 'target', label: 'Target wall', value: '0', options: targets.map((target, index) => ({ value: String(index), label: `${target.roomId} · ${faceLabel(model.room(target.roomId), target.face)} · ${Math.abs(target.gap) < 1e-6 ? 'touching' : `gap ${target.gap}`}` })) },
    { id: 'mode', label: 'Alignment', value: Math.abs(first.gap) < 1e-6 ? 'touch' : anchored ? 'fit' : 'snap', options: [
      { value: 'touch', label: 'Keep positions / close loop' }, { value: 'fit', label: 'Fit corridor end to target' }, { value: 'snap', label: 'Snap separate branch to target' },
    ] },
    { id: 'opening', label: 'Opening style', value: 'doorway', options: [{ value: 'doorway', label: 'Doorway at this point' }, { value: 'full', label: 'Full shared opening' }] },
  ], values => { const target = targets[Number(values.target)]; if (!target) throw new Error('Choose a target wall.'); commit(() => model.connectFaces(roomId, face, target.roomId, target.face, { mode: /** @type {'touch' | 'snap' | 'fit'} */ (values.mode), full: values.opening === 'full', point })); }, 'Connect rooms');
}
