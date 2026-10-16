import test from 'node:test';
import assert from 'node:assert/strict';
import Spaceship from '../src/js/entities/Spaceship.js';
import SimulationStepper from '../src/js/core/SimulationStepper.js';
import { FlightController } from './helpers/browser-flight.mjs';
import disposeObject from '../src/js/utils/disposeObject.js';

// Real movement and bounded simulation, including slow renders and delayed
// observations. Short wall-clock key pulses can disappear in these conditions.
for (const fps of [4, 10, 30, 60]) for (const lag of [0, 2]) {
  test(`browser keyboard steering converges at ${fps} FPS with ${lag} frames of observation lag`, () => {
    const ship = new Spaceship(), stepper = new SimulationStepper();
    ship.group.position.set(0, 0, 4); let timeMs = 0;
    try {
      for (const target of [0, -16, 0, 16]) {
        const samples = [], controller = new FlightController(target); let settled = false;
        for (let frame = 0; frame < fps * 90; frame++) {
          const position = ship.group.position.z, velocity = ship.velocity.z;
          if (Math.abs(target - position) < 0.3 && Math.abs(velocity) < 0.15) { settled = true; break; }
          samples.push([position, velocity, timeMs]);
          const observation = samples[Math.max(0, samples.length - 1 - lag)];
          const command = controller.update(...observation);
          stepper.advance(1 / fps, delta => {
            ship.update(delta, { forward: command < 0, backward: command > 0 });
            timeMs += delta * 1000;
            ship.group.position.addScaledVector(ship.velocity, delta);
          });
        }
        assert.ok(settled, `did not reach ${target}: ${ship.group.position.z}, v=${ship.velocity.z}`);
        // Coasting after key release must still leave room to pass a 6-unit port.
        for (let frame = 0; frame < fps * 5; frame++) stepper.advance(1 / fps, delta => {
          ship.update(delta); ship.group.position.addScaledVector(ship.velocity, delta); timeMs += delta * 1000;
        });
        assert.ok(Math.abs(target - ship.group.position.z) < 0.4);
      }
    } finally { disposeObject(ship.group); }
  });
}
