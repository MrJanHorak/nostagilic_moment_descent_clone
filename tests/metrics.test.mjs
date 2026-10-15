import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FrameMetrics, collectResources } from '../src/js/utils/runtimeMetrics.js';
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
    points: 0, objects: 4, lights: 1, materials: 1, effectLights: 0, pooledEffects: 0 });
  assert.equal(scene.children.length, 3);
  geometry.dispose(); material.dispose();
});

test('disabled diagnostics collect no frames, timings or resources', () => {
  const diagnostics = new RuntimeDiagnostics(false);
  diagnostics.recordFrame({ get game() { throw new Error('must not inspect production game'); } }, 10);
  assert.equal(diagnostics.frames, 0);
  assert.equal(diagnostics.metrics.snapshot().samples, 0);
});
