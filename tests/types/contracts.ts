// Compile-only consumer checks. Each expect-error must fail if a contract widens.
import { Box3, Vector3 } from 'three';
import GameSession from '../../src/js/core/GameSession.js';
import SimulationStepper from '../../src/js/core/SimulationStepper.js';
import UserSettings from '../../src/js/core/UserSettings.js';
import MissionObjective from '../../src/js/core/MissionObjective.js';
import SettingsDialog from '../../src/js/ui/SettingsDialog.js';
import { traceShot } from '../../src/js/utils/combatTrace.js';
import { moveSphere } from '../../src/js/utils/sphereMovement.js';
import type { MissionDefinition } from '../../src/js/contracts.js';

const session = new GameSession();
session.transition('loading');
session.schedule(100, () => {});
// @ts-expect-error Unknown session phases are invalid.
session.transition('flying');
// @ts-expect-error Delays must be numbers.
session.schedule('100', () => {});
// @ts-expect-error Callbacks must be functions.
session.schedule(100, 5);
new SimulationStepper().advance(1 / 60, step => step > 0);
// @ts-expect-error Simulation delta is numeric.
new SimulationStepper().advance('0.1', () => {});
// @ts-expect-error Simulation callbacks return boolean or void.
new SimulationStepper().advance(0.1, () => 'stop');

const settings = new UserSettings(() => undefined);
settings.update({ mouseSensitivity: 'bad' }); // Untrusted input is deliberately validated at runtime.
// @ts-expect-error Settings snapshots are immutable.
settings.values.invertY = true;
// @ts-expect-error Audio preferences are immutable too.
settings.values.musicVolume = 0.5;
new UserSettings(() => undefined, values => { const volume: number = values.effectsVolume; void volume; });
// @ts-expect-error Preference callbacks receive the validated snapshot.
new UserSettings(() => undefined, (values: string) => { void values; });
// @ts-expect-error Storage providers must provide both getItem and setItem.
new UserSettings(() => ({ getItem: () => null }));
new SettingsDialog(settings).close(false);
// @ts-expect-error A settings dialog requires a settings controller.
new SettingsDialog({ values: { mouseSensitivity: 1, invertY: false } });

const definition: MissionDefinition = {
  type: 'clear-and-exit', requiredEnemyIds: ['fighter'],
  exit: { position: [0, 0, -24], radius: 1.5 },
};
const mission = new MissionObjective(definition);
mission.recordDefeat('fighter', 'shot');
mission.tryComplete(new Vector3());
// @ts-expect-error Cleanup must not be counted as a combat defeat.
mission.recordDefeat('fighter', 'cleanup');
// @ts-expect-error Exit positions are three-dimensional.
const invalidExit: MissionDefinition['exit'] = { position: [0, 0], radius: 1.5 };
// @ts-expect-error Authored definitions must remain immutable.
definition.requiredEnemyIds.push('extra');
void invalidExit;

const target = { isActive: true, collider: new Box3(), health: 10 };
const shot = traceShot(new Vector3(), new Vector3(), {
  colliders: [new Box3(), { id: 'wall', box: new Box3() }], targets: [target],
});
if (shot?.kind === 'enemy') {
  const health: number = shot.target.health; // Enemy identity/type survives the trace.
  void health;
} else if (shot?.kind === 'player') {
  const radius: number = shot.target.radius;
  void radius;
  // @ts-expect-error A player hit must not expose the enemy target shape.
  shot.target.collider;
}
// @ts-expect-error Enemy colliders must be boxes.
traceShot(new Vector3(), new Vector3(), { targets: [{ isActive: true, collider: new Vector3() }] });
moveSphere(new Vector3(), new Vector3(), 1 / 60, [new Box3(), { box: new Box3() }]);
// @ts-expect-error Movement accepts world vectors, not arrays.
moveSphere([0, 0, 0], new Vector3(), 1 / 60, []);
// @ts-expect-error Collider wrappers must contain a box.
moveSphere(new Vector3(), new Vector3(), 1 / 60, [{ id: 'missing-box' }]);
