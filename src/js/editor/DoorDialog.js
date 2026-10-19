/** @param {string} id @param {import('./EditorDocument.js').default} model
 * @param {import('./ViewportMenu.js').default} menu @param {(action: () => void) => void} commit */
export default function doorDialog(id, model, menu, commit) {
  const connection = model.document.connections.find(link => link.id === id); if (!connection) throw new Error('Select a real connection first.');
  const devices = model.document.formatVersion === 1 ? [] : model.document.devices, door = model.document.formatVersion === 1 ? null : model.document.doors.find(door => door.connectionId === id);
  menu.form('Relay-controlled door', `${connection.a.roomId} ↔ ${connection.b.roomId}. A closed door fills this passage; R activates a visible relay within 2.5 units. Create a relay near spawn, or link one you placed with right-click → Place relay here.`, [
    { id: 'relay', label: 'Door control', value: door?.deviceId ?? '@new', options: [
      { value: '@new', label: 'Create relay near player spawn' }, ...devices.map(device => ({ value: device.id, label: device.label })), { value: '', label: 'Always open / remove door' },
    ] },
  ], values => commit(() => { if (values.relay === '@new') model.createRelayDoor(id); else model.checked(candidate => candidate.setDoor(id, values.relay)); }), 'Apply door');
}
