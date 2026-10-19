/** Shared precise resize entry point for the inspector and viewport menu.
 * @param {string} roomId @param {import('./EditorDocument.js').default} model
 * @param {import('./EditorViewport.js').default} viewport @param {import('./ViewportMenu.js').default} menu
 * @param {(action: () => void) => void} commit */
export default function openResizeDialog(roomId, model, viewport, menu, commit) {
  const room = model.room(roomId), links = model.document.connections.filter(link => link.a.roomId === roomId || link.b.roomId === roomId);
  const options = [...links.map(link => ({ value: link.id, label: `Opening to ${link.a.roomId === roomId ? link.b.roomId : link.a.roomId} (${link.id})` })), { value: 'center', label: 'Room center' }];
  menu.form('Resize room', `${roomId} · Attached branches move to keep passages aligned. Content in this room stays in place. Closed loops or a shrink that no longer fits are rejected.`, [
    ...['Width (local X)', 'Height (local Y)', 'Length (local Z)'].map((label, axis) => ({ id: `size${axis}`, label, value: String(room.size[axis]), type: /** @type {const} */ ('number'), min: '4', max: '256', step: '0.5' })),
    { id: 'anchor', label: 'Keep fixed', value: options[0].value, options },
  ], values => commit(() => model.resizeRoom(roomId, [0, 1, 2].map(axis => Number(values[`size${axis}`])), values.anchor)), 'Resize and keep connections');
  viewport.controls.enabled = false;
}
