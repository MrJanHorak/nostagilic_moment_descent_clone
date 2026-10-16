import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FrameMetrics, ProfileCapture, collectResources } from '../src/js/utils/runtimeMetrics.js';
import RuntimeDiagnostics from '../src/js/utils/RuntimeDiagnostics.js';

test('frame metrics keep a bounded recent window and compute percentiles without changing it', () => {
  const metrics = new FrameMetrics(4);
  metrics.record(0, 500);
  for (const now of [10, 30, 60, 100, 150]) metrics.record(now, now / 10);
  assert.deepEqual(metrics.intervals, [20, 30, 40, 50]);
  assert.deepEqual(metrics.snapshot(), { samples: 4, p50FrameMs: 30, p95FrameMs: 50, p95WorkMs: 15 });
  metrics.record(NaN, 20);
  assert.deepEqual(metrics.snapshot(), { samples: 4, p50FrameMs: 30, p95FrameMs: 50, p95WorkMs: 15 });
  assert.deepEqual(new FrameMetrics().snapshot(), { samples: 0, p50FrameMs: null, p95FrameMs: null, p95WorkMs: null });
});

test('resource snapshot counts shared materials once and does not retain or mutate scene objects', () => {
  const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
  scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, [material, material]), new THREE.PointLight());
  const game = { scene, renderer: { info: { memory: { geometries: 1, textures: 2 }, programs: [{}],
    render: { calls: 3, triangles: 24, points: 0 } } } };
  assert.deepEqual(collectResources(game), { geometries: 1, textures: 2, programs: 1, calls: 3, triangles: 24,
    points: 0, objects: 4, lights: 1, materials: 1, sceneGeometries: 1, geometryBudget: 1, effectLights: 0, pooledEffects: 0 });
  assert.equal(scene.children.length, 3);
  geometry.dispose(); material.dispose();
});

test('geometry allocation budget counts actual scene and shot cache identities once', () => {
  const scene = new THREE.Scene(), live = new THREE.BoxGeometry(), cached = new THREE.SphereGeometry();
  const material = new THREE.MeshBasicMaterial(); scene.add(new THREE.Mesh(live, material));
  const resources = collectResources({ scene, projectileManager: { projectileGeometries: { live, cached } },
    enemyManager: { projectileManager: { projectileGeometries: { cached } } } });
  assert.equal(resources.sceneGeometries, 1); assert.equal(resources.geometryBudget, 2);
  live.dispose(); cached.dispose(); material.dispose();
});

test('flight diagnostics publish each rendered observation while full metrics stay throttled', t => {
  const diagnostics = new RuntimeDiagnostics(true), attributes = new Map();
  diagnostics.panel = { setAttribute: (key, value) => attributes.set(key, value) };
  let refreshes = 0, now = 0;
  t.mock.method(diagnostics, 'refresh', () => refreshes++);
  t.mock.method(performance, 'now', () => now);
  const ship = { group: new THREE.Group(), velocity: new THREE.Vector3(0, 0, -1) };
  const state = { session: { id: 1, phase: 'playing', timeMs: 0, steps: 0 }, game: { spaceship: ship } };
  diagnostics.recordFrame(state);
  now = 50; state.session.timeMs = 50; state.session.steps = 3; ship.group.position.z = -0.05;
  diagnostics.recordFrame(state);
  const flight = JSON.parse(attributes.get('data-flight'));
  assert.equal(refreshes, 1); assert.equal(flight.sessionFrames, 2); assert.equal(flight.steps, 3);
  assert.deepEqual(flight.velocity, [0, 0, -1]); assert.deepEqual(flight.position, [0, 0, -0.05]);
  state.session.id = 2; diagnostics.recordFrame(state);
  assert.equal(JSON.parse(attributes.get('data-flight')).sessionFrames, 1);
});

test('disabled diagnostics collect no frames, timings or resources', () => {
  const diagnostics = new RuntimeDiagnostics(false);
  diagnostics.recordFrame({ get game() { throw new Error('must not inspect production game'); } }, 10);
  assert.equal(diagnostics.frames, 0);
  assert.equal(diagnostics.metrics.snapshot().samples, 0);
});

test('finite capture measures only its own active window and latches a completed result', () => {
  const capture = new ProfileCapture(100);
  const state = { session: { id: 1, phase: 'playing', timeMs: 5000 } };
  let reads = 0;
  const resources = () => { reads++; return { lights: 14 }; };
  assert.equal(capture.start(state, 2000, { lights: 14 }), true);
  assert.equal(capture.start(state, 2010, {}), false);
  for (const [now, work] of [[2000, 2], [2050, 3], [2100, 4]]) {
    state.session.timeMs = now + 3000;
    capture.record(state, now, work, resources);
  }
  assert.equal(capture.result.status, 'complete');
  assert.equal(capture.result.elapsedMs, 100);
  assert.equal(capture.result.simulationDeltaMs, 100);
  assert.equal(capture.result.frames, 3);
  assert.deepEqual(capture.result.timing, { samples: 2, p50FrameMs: 50, p95FrameMs: 50, p95WorkMs: 4 });
  capture.record(state, 9000, 500, resources);
  assert.equal(reads, 1);
  assert.equal(capture.result.frames, 3);
});

test('pause, death and session replacement abort capture instead of mixing lifecycle stalls', () => {
  for (const change of [{ phase: 'paused' }, { phase: 'dead' }, { id: 2 }]) {
    const capture = new ProfileCapture(100);
    const state = { session: { id: 1, phase: 'playing', timeMs: 0 } };
    capture.start(state, 0, {});
    Object.assign(state.session, change);
    capture.record(state, 100, 2, () => { throw new Error('must not collect final resources'); });
    assert.equal(capture.result.status, 'aborted');
  }
  const capture = new ProfileCapture();
  assert.equal(capture.start({ session: { phase: 'paused' } }, 0, {}), false);
  assert.equal(capture.result.status, 'idle');
});

test('capture flags truncated histories and a new run discards old timings', () => {
  const capture = new ProfileCapture(100, 2);
  const state = { session: { id: 1, phase: 'playing', timeMs: 0 } };
  capture.start(state, 0, {});
  for (const now of [0, 50, 100]) capture.record(state, now, 1, () => ({}));
  assert.equal(capture.result.truncated, true);
  capture.start(state, 1000, {});
  capture.record(state, 1100, 2, () => ({}));
  assert.equal(capture.result.truncated, false);
  assert.equal(capture.result.timing.samples, 0, 'no interval carried in from an old run');
});

test('pause cancellation cannot be hidden by resuming before the next rendered frame', () => {
  const diagnostics = new RuntimeDiagnostics(true);
  const state = { session: { id: 1, phase: 'playing', timeMs: 0 } };
  diagnostics.capture.start(state, 0, {});
  diagnostics.invalidateCapture('Paused during capture');
  diagnostics.capture.record(state, 10000, 2, () => ({}));
  assert.equal(diagnostics.capture.result.status, 'aborted');
  assert.equal(diagnostics.capture.result.frames, 0);
});
