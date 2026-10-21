/** @param {import('./EditorDocument.js').default} model
 * @param {import('./ViewportMenu.js').default} menu @param {(action: () => void) => void} commit */
export default function escapeDialog(model, menu, commit) {
  const devices = model.document.formatVersion === 1 ? [] : model.document.devices;
  const escape = 'escape' in model.document.mission ? model.document.mission.escape : undefined;
  menu.form('Reactor escape countdown', 'Choose a relay activation or reactor destruction to start the escape clock. The player must clear required drones and other relays first. Link an escape door to this relay, and place the exit along a familiar return route. Pause freezes the clock; expiry ends the attempt.', [
    { id: 'trigger', label: 'Countdown objective', value: escape?.triggerDeviceId ?? '', options: [{ value: '', label: 'No escape countdown' }, ...devices.map(device => ({ value: device.id, label: `${device.kind === 'reactor' ? 'Destroy: ' : 'Activate: '}${device.label} (${device.id})` }))] },
    { id: 'seconds', label: 'Escape time (seconds)', value: String(escape?.durationSeconds ?? 60), type: 'number', min: '10', max: '600', step: '1' },
  ], values => commit(() => model.setEscape(values.trigger, Number(values.seconds))), 'Apply countdown');
}
