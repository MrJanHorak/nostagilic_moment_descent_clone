import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommsSound, createLogSound } from '../src/js/core/CommsSound.js';
import UIManager from '../src/js/ui/UIManager.js';
import UserSettings, { DEFAULT_SETTINGS } from '../src/js/core/UserSettings.js';

function context() {
  return { sampleRate: 8000, createBuffer(_channels, length, sampleRate) {
    const data = new Float32Array(length); return { length, sampleRate, getChannelData: () => data };
  } };
}

test('comms and data-log cues are short, bounded, deterministic and start and end quietly', () => {
  for (const make of [createCommsSound, createLogSound]) {
    const a = make(context()), b = make(context()), data = a.getChannelData(0);
    assert.ok(a.length / a.sampleRate <= 0.5);
    assert.ok(data.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 1));
    assert.ok(Math.max(...data.map(Math.abs)) > 0.05, 'audible');
    assert.ok(Math.abs(data.at(-1)) < 0.01, 'no click at the end');
    assert.deepEqual([...data], [...b.getChannelData(0)]);
  }
});

test('a radio message or log plays its cue and signals the cockpit lamp; a rescue plays the pickup cue only', () => {
  const ui = Object.create(UIManager.prototype), played = [], signals = [], pushed = [];
  Object.assign(ui, {
    audioManager: { initialized: true, playSound: id => played.push(id) },
    comms: { push: (label, text, tone) => pushed.push([label, tone]) },
    game: { session: { timeMs: 4200 }, cockpit: { signalComms: time => signals.push(time) } },
    showMessage() {},
  });
  ui.showStoryEvent({ kind: 'message', id: 'm', speaker: 'Vey', text: 'Hello' });
  ui.showStoryEvent({ kind: 'log', id: 'l', title: 'Shift log', text: '...', found: 1, total: 2 });
  ui.showStoryEvent({ kind: 'survivor', id: 's', name: 'Dara', aboard: 1, total: 2 });
  assert.deepEqual(played, ['commsIn', 'logFound', 'powerup']);
  assert.deepEqual(signals, [4200, 4200]);
  assert.deepEqual(pushed, [['VEY', undefined], ['LOG · SHIFT LOG', 'log']]);
  ui.audioManager = { initialized: false, playSound: () => assert.fail('no audio before initialization') };
  ui.showStoryEvent({ kind: 'message', id: 'm2', speaker: 'Vey', text: 'Again' });
});

test('new profiles start in the cockpit view; existing saves keep their own view', () => {
  assert.equal(DEFAULT_SETTINGS.cameraView, 'cockpit');
  assert.equal(new UserSettings(() => ({ getItem: () => null, setItem() {} })).values.cameraView, 'cockpit');
  const saved = cameraView => new UserSettings(() => ({ getItem: () => JSON.stringify({ version: 1, cameraView }), setItem() {} })).values.cameraView;
  assert.equal(saved('external'), 'external');
  assert.equal(saved(undefined), 'hud', 'a save from before the camera option keeps the HUD view');
});
