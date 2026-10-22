// Development-only status for the repeatable ?smoke=1 browser check.
// Metrics are read-only; labeled controls exercise game paths without exposing a global game object.
import { FrameMetrics, ProfileCapture, collectResources } from './runtimeMetrics.js';

export default class RuntimeDiagnostics {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.frames = 0;
    this.updates = 0;
    this.errors = 0;
    this.lastRefresh = -Infinity;
    this.panel = null;
    this.lastError = '';
    this.metrics = new FrameMetrics();
    this.capture = new ProfileCapture();
  }

  recordFrame(gameState, workMs = 0) {
    if (!this.enabled) return;
    this.frames++;
    if (this.renderedSession !== gameState.session.id) {
      this.renderedSession = gameState.session.id;
      this.sessionFrames = 0;
    }
    this.sessionFrames++;
    const now = performance.now();
    this.metrics.record(now, workMs);
    this.capture.record(gameState, now, workMs, () => collectResources(gameState.game));
    if (now - this.lastRefresh >= 250) {
      this.lastRefresh = now;
      this.refresh(gameState);
    }
    // Small, read-only per-render feedback. Wall-clock key pulses can be missed
    // entirely between frames on a slow software renderer.
    const ship = gameState.game?.spaceship;
    this.panel?.setAttribute('data-flight', JSON.stringify({
      phase: gameState.session.phase, session: gameState.session.id,
      timeMs: gameState.session.timeMs, steps: gameState.session.steps,
      frames: this.frames, sessionFrames: this.sessionFrames,
      position: ship?.group.position.toArray(), velocity: ship?.velocity.toArray(),
      quaternion: ship?.group.quaternion.toArray(),
      escapeRemainingMs: gameState.game?.mission?.remainingEscapeMs(gameState.session.timeMs) ?? null,
      surfaceContact: gameState.game?.levelManager?.environment?.contact ?? null,
      salvage: gameState.game?.powerUpManager?.powerups.filter(item => item.type.name.endsWith('Salvage')).slice(0, 64)
        .map(item => ({ type: item.type.name, position: item.mesh.position.toArray() })),
      scouts: gameState.game?.enemyManager?.enemies.filter(enemy => enemy.type.name === 'scout' && enemy.isActive).slice(0, 16)
        .map(enemy => ({ id: enemy.mesh.userData.spawnPointId ?? enemy.mesh.uuid, phase: enemy.scoutAttack?.phase ?? 'approach', since: enemy.scoutAttack?.since ?? 0, position: enemy.mesh.position.toArray() })),
      fighters: gameState.game?.enemyManager?.enemies.filter(enemy => enemy.type.name === 'fighter' && enemy.isActive).slice(0, 16)
        .map(enemy => ({ id: enemy.mesh.userData.spawnPointId ?? enemy.mesh.uuid, phase: enemy.fighterAttack?.phase ?? 'idle',
          since: enemy.fighterAttack?.since ?? 0, firedAt: Number.isFinite(enemy.fighterAttack?.firedAt) ? enemy.fighterAttack.firedAt : null,
          position: enemy.mesh.position.toArray(), motion: enemy.fighterMovement?.mode ?? 'route', decisions: enemy.fighterMovement?.decisions ?? 0 })),
      speed: ship?.velocity.length() ?? 0,
    }));
  }

  recordUpdate() {
    if (this.enabled) this.updates++;
  }

  invalidateCapture(reason) {
    if (this.enabled) this.capture.cancel(reason);
  }

  reportError(error, stage) {
    if (!this.enabled) return;
    this.errors++;
    this.lastError = `${stage}: ${error.message || error}`;
    this.refresh();
  }

  refresh(gameState) {
    if (!this.enabled || !globalThis.document?.body) return;
    if (!this.panel) {
      this.panel = document.createElement('pre');
      this.panel.id = 'runtime-diagnostics';
      this.panel.setAttribute('role', 'status');
      Object.assign(this.panel.style, {
        position: 'fixed', bottom: '8px', left: '8px', margin: '0',
        padding: '8px', zIndex: '2000', background: '#00131ee8',
        color: '#b9efff', font: '12px monospace', pointerEvents: 'none',
        maxWidth: 'calc(100vw - 32px)', whiteSpace: 'pre-wrap',
      });
      document.body.appendChild(this.panel);
    }
    if (gameState) {
      this.phase = gameState.session.phase.toUpperCase();
      const game = gameState.game;
      const ship = game?.spaceship;
      const snapshot = {
        phase: gameState.session.phase, session: gameState.session.id, timeMs: gameState.session.timeMs,
        frames: this.frames, steps: gameState.session.steps, tasks: gameState.session.tasks.size, errors: this.errors,
        sessionFrames: this.sessionFrames,
        enemies: game?.enemyManager?.enemies.length ?? 0,
        shots: (game?.projectileManager?.projectiles.length ?? 0) + (game?.enemyManager?.projectileManager.enemyProjectiles.length ?? 0),
        pickups: game?.powerUpManager?.powerups.length ?? 0,
        visibility: game?.levelManager?.visibility ? { visibleRooms: game.levelManager.visibility.visibleRooms.size, totalRooms: game.levelManager.visibility.navigation.rooms.size, culledMeshes: game.levelManager.visibility.culledMeshes } : null,
        position: ship?.group.position.toArray(), speed: ship?.velocity.length() ?? 0,
        resources: collectResources(game), timing: this.metrics.snapshot(),
        profile: this.capture.result,
      };
      this.panel.setAttribute('data-snapshot', JSON.stringify(snapshot));
      const r = snapshot.resources, t = snapshot.timing;
      this.resourceStatus = `GPU objects: ${r.geometries} geometries / ${r.textures} textures / ${r.programs} programs | Draws: ${r.calls}\nScene: ${r.objects} objects / ${r.materials} materials / ${r.lights} lights | Effect lights: ${r.effectLights} / Pooled: ${r.pooledEffects}\nLast ${t.samples} frames: p50 ${t.p50FrameMs ?? '-'}ms / p95 ${t.p95FrameMs ?? '-'}ms | Work p95: ${t.p95WorkMs ?? '-'}ms`;
      this.flightStatus = ship ? `Position: ${ship.group.position.toArray().map(n => n.toFixed(2)).join(', ')} | Speed: ${ship.velocity.length().toFixed(2)}\nQuaternion: ${ship.group.quaternion.toArray().map(n => n.toFixed(3)).join(', ')}` : '';
      this.sessionStatus = `Session: ${gameState.session.id} | Time: ${(gameState.session.timeMs / 1000).toFixed(2)}s | Steps: ${gameState.session.steps} | Tasks: ${gameState.session.tasks.size}`;
      this.entityStatus = `Enemies: ${game?.enemyManager?.enemies.length ?? 0} | Shots: ${(game?.projectileManager?.projectiles.length ?? 0) + (game?.enemyManager?.projectileManager.enemyProjectiles.length ?? 0)} | Pickups: ${game?.powerUpManager?.powerups.length ?? 0}`;
      this.arenaStatus = game?.levelManager?.currentLevel?.kind === 'arena' && !game.isEndlessMode
        ? `Arena solids: ${game.levelManager.solidColliders.length} | Contact: ${!!game.lastMovement?.collided} | Limited: ${!!game.lastMovement?.limited}` : '';
      if (game && !this.controls) {
        this.controls = document.createElement('aside');
        this.controls.setAttribute('aria-label', 'Session smoke controls');
        Object.assign(this.controls.style, { position: 'fixed', bottom: '8px', right: '8px',
          zIndex: '2000', display: 'flex', gap: '8px', padding: '8px', background: '#00131ee8' });
        this.deathButton = document.createElement('button');
        this.deathButton.textContent = 'Simulate death (test)';
        this.deathButton.addEventListener('click', () => game.gameState.takeDamage(game.gameState.maxPlayerHealth));
        this.completionButton = document.createElement('button');
        this.completionButton.textContent = 'Complete mission (test)';
        this.completionButton.addEventListener('click', () => {
          if (!game.mission) game.completeSession();
          else for (const enemy of [...game.enemyManager.enemies]) {
            game.enemyManager.hitEnemy(enemy, { power: 10000 }, enemy.mesh.position.clone());
          }
        });
        this.controls.append(this.deathButton, this.completionButton);
        this.profileButton = document.createElement('button');
        this.profileButton.textContent = 'Profile 10 seconds (test)';
        this.profileButton.addEventListener('click', () => this.capture.start(gameState, performance.now(), collectResources(game)));
        this.controls.append(this.profileButton);
        document.body.appendChild(this.controls);
      }
      if (this.controls) {
        this.deathButton.disabled = gameState.session.phase !== 'playing';
        this.completionButton.disabled = gameState.session.phase !== 'playing' || game.isEndlessMode;
        this.completionButton.textContent = game.mission ? 'Neutralize drones (test)' : 'Complete mission (test)';
        this.profileButton.disabled = gameState.session.phase !== 'playing' || this.capture.result.status === 'running';
      }
    }
    this.panel.textContent = [
      `SMOKE CHECK | ${this.phase || 'INITIALIZING'}`,
      `Frames: ${this.frames} | Updates: ${this.updates} | Errors: ${this.errors}`,
      this.sessionStatus,
      this.entityStatus,
      this.flightStatus,
      this.arenaStatus,
      this.resourceStatus,
      `Profile: ${this.capture.result.status}${this.capture.result.elapsedMs ? ` (${(this.capture.result.elapsedMs / 1000).toFixed(1)}s)` : ''}`,
      this.lastError,
    ].filter(Boolean).join('\n');
  }
}
