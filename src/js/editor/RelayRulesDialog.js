/** Mission dialogs for team and choice relays (formats 15 and 17) and robot generators (format 16). */

/** @param {import('./EditorDocument.js').default} model
 * @param {import('./ViewportMenu.js').default} menu @param {(action: () => void) => void} commit */
export function relayRulesDialog(model, menu, commit) {
  const devices = model.document.formatVersion === 1 ? [] : model.document.devices.filter(device => device.kind !== 'reactor');
  const mission = /** @type {any} */ (model.document.mission);
  const linked = mission.linkedRelays ?? [], choice = mission.choice?.deviceIds ?? [];
  const options = [{ value: '', label: '(none)' }, ...devices.map(device => ({ value: device.id, label: `${device.label} (${device.id})` }))];
  /** @type {any[]} */ const fields = [];
  for (const slot of [0, 1]) {
    fields.push(
      { id: `pair${slot}a`, label: `Linked pair ${slot + 1}: first relay`, value: linked[slot]?.ids[0] ?? '', options },
      { id: `pair${slot}b`, label: `Linked pair ${slot + 1}: second relay`, value: linked[slot]?.ids[1] ?? '', options },
      { id: `pair${slot}w`, label: `Linked pair ${slot + 1}: window (seconds)`, type: 'number', value: String(linked[slot]?.windowSeconds ?? 12), min: '1', max: '60', step: '1' });
  }
  for (const slot of [0, 1, 2]) fields.push({ id: `choice${slot}`, label: `Choice option ${slot + 1}`, value: choice[slot] ?? '', options });
  menu.form('Team and choice relays',
    'Linked pair: both relays must be activated within the window, so a team splits up (solo pilots get four times as long). Choice: the first option activated answers and the others lock for good. Choice relays are optional; give each its own door so every route still reaches the exit.',
    fields, values => commit(() => model.setRelayRules({
      linked: [0, 1].map(slot => ({ ids: /** @type {[string, string]} */ ([values[`pair${slot}a`], values[`pair${slot}b`]]), windowSeconds: Number(values[`pair${slot}w`]) })),
      choice: [0, 1, 2].map(slot => values[`choice${slot}`]).filter(Boolean),
    })), 'Apply relay rules');
}

/** List the level's robot generators and remove any of them. Place new ones by
 * right-clicking inside a room.
 * @param {import('./EditorDocument.js').default} model
 * @param {import('./ViewportMenu.js').default} menu @param {(action: () => void) => void} commit */
export function generatorsDialog(model, menu, commit) {
  const generators = /** @type {any[]} */ (/** @type {any} */ (model.document).generators ?? []);
  const room = /** @param {string} id */ id => { const value = model.document.rooms.find(candidate => candidate.id === id); return value?.label ?? id; };
  menu.form('Robot generators',
    generators.length ? 'A generator wakes when a pilot first enters its room and releases its robots one at a time. Generated robots never count toward objectives. To add one, right-click inside a room and choose "Place robot generator here".'
      : 'No generators yet. Right-click inside a room and choose "Place robot generator here".',
    generators.map(generator => ({ id: generator.id, label: `${generator.id} · ${room(generator.roomId)} · ${generator.count} ${generator.enemyType}s every ${generator.intervalSeconds}s, ${generator.maxAlive ?? 2} at once`,
      value: 'keep', options: [{ value: 'keep', label: 'Keep' }, { value: 'remove', label: 'Remove' }] })),
    values => commit(() => model.removeGenerators(generators.filter(generator => values[generator.id] === 'remove').map(generator => generator.id))), 'Apply');
}

/** The fields for placing a generator. */
export const GENERATOR_FIELDS = Object.freeze([
  { id: 'enemyType', label: 'Robot type', value: 'scout', options: ['scout', 'fighter', 'bomber', 'destroyer'].map(value => ({ value, label: value })) },
  { id: 'count', label: 'Robots in total (1–12)', type: 'number', value: '4', min: '1', max: '12', step: '1' },
  { id: 'intervalSeconds', label: 'Seconds between releases (2–60)', type: 'number', value: '8', min: '2', max: '60', step: '1' },
  { id: 'maxAlive', label: 'Most active at once (1–4)', type: 'number', value: '2', min: '1', max: '4', step: '1' },
]);
