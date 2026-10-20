/** @param {string} id @param {import('./EditorDocument.js').default} model
 * @param {import('./ViewportMenu.js').default} menu @param {(action: () => void) => void} commit */
export default function doorDialog(id, model, menu, commit) {
  const connection = model.document.connections.find(link => link.id === id); if (!connection) throw new Error('Select a real connection first.');
  const devices = model.document.formatVersion === 1 ? [] : model.document.devices, door = model.document.formatVersion === 1 ? null : model.document.doors.find(door => door.connectionId === id);
  menu.form('Door controls', `${connection.a.roomId} ↔ ${connection.b.roomId}. Panels slide open and stay open. Choose a player-shot door or an R-activated relay. Concealed panels match the adjacent walls, with a narrow seam to discover.`, [
    { id: 'relay', label: 'Door control', value: door?.activation === 'shot' ? '@shot' : door?.deviceId ?? '@new', options: [
      { value: '@new', label: 'Create relay near player spawn' }, { value: '@shot', label: 'Shoot door to open' }, ...devices.map(device => ({ value: device.id, label: device.label })), { value: '', label: 'Always open / remove door' },
    ] },
    { id: 'finish', label: 'Door appearance', value: door?.concealed ? 'hidden' : 'visible', options: [{ value: 'visible', label: 'Marked door' }, { value: 'hidden', label: 'Concealed wall panel' }] },
  ], values => commit(() => {
    const options = { sliding: true, concealed: values.finish === 'hidden' };
    if (values.relay === '@new') model.createRelayDoor(id, options); else model.checked(candidate => candidate.setDoor(id, values.relay, options));
  }), 'Apply door');
}
