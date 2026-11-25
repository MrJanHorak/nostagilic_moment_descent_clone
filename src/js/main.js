import * as THREE from 'three';
import AudioManager from './core/AudioManager.js';
import GameState from './core/GameState.js';
import InputManager from './core/InputManager.js';
import LevelManager from './core/LevelManager.js';
import Spaceship from './entities/Spaceship.js';
import { prepareLevelDocument } from './core/levels/document/compileLevelDocument.js';
import disposeObject from './utils/disposeObject.js';
import ProjectileManager from './entities/ProjectileManager.js';
import EnemyManager from './entities/EnemyManager.js';
import PowerUpManager from './entities/PowerUpManager.js';
import UIManager from './ui/UIManager.js';
import SimulationStepper from './core/SimulationStepper.js';
import RuntimeDiagnostics from './utils/RuntimeDiagnostics.js';
import MissionObjective from './core/MissionObjective.js';
import RelayController from './core/RelayController.js';
import UserSettings from './core/UserSettings.js';
import CampaignProgress from './core/CampaignProgress.js';
import ControlBindings from './core/ControlBindings.js';
import StoryController from './core/StoryController.js';
import { describeMissionStatus } from './core/MissionStatus.js';
import AnarchyMatch from './core/AnarchyMatch.js';
import CoopMatch, { PER_PILOT_PICKUPS, enemyToughness } from './core/CoopMatch.js';
import { QUICK_CHAT, SignalLimiter, aimPoint, cleanSignal } from './core/TeamSignals.js';
import TeamMarkers from './ui/TeamMarkers.js';
import OnlineMatch, { describeNetError } from './net/OnlineMatch.js';
import createOnlineLobby from './ui/OnlineLobby.js';
import { getDifficulty, scaleAmmo } from './core/Difficulty.js';
import ShipView from './core/ShipView.js';
import ExplorationMap from './core/ExplorationMap.js';
import CockpitView from './ui/CockpitView.js';
import { createCaveParticles, updateCaveParticles } from './utils/effectsUtils.js';
import { checkPlayerObstacleCollision } from './utils/collisionUtils.js';
import { moveSphere } from './utils/sphereMovement.js';

export default class Game {
  constructor() {
    this.clock = new THREE.Clock();
    this.stepper = new SimulationStepper();
    this.scene = new THREE.Scene();
    this.audioManager = new AudioManager();
    this.gameState = new GameState();
    this.settings = new UserSettings(undefined, values => {
      this.audioManager.applyPreferences(values);
      this.shipView?.apply(values);
      this.uiManager?.updateShipView?.();
    });
    this.campaignProgress = new CampaignProgress();
    this.controls = new ControlBindings();
    this.session = this.gameState.session;
    this.activeAnimations = [];
    this.mission = null;
    this.anarchy = null;
    /** Co-op rules (shared lives, relay respawns, team extraction) when a mission is flown as a team. @type {CoopMatch | null} */
    this.coop = null;
    /** Whether the next start (and restarts) is co-op. */
    this.coopMode = false;
    /** Pings and wrecks drawn in the world. */
    this.teamMarkers = new TeamMarkers(this.scene);
    /** Quick-chat strip open (number keys send a phrase instead of switching weapons). */
    this.quickChatOpen = false;
    this.signalLimiter = new SignalLimiter();
    /** A game server's simulation: the host's own ship never flies, fights or scores. */
    this.dedicated = false;
    /** Online Anarchy: the connection to the game server, while in a room. @type {OnlineMatch | null} */
    this.online = null;
    /** @type {StoryController | null} */
    this.story = null;
    /** @type {import('./core/StoryController.js').StorySummary | null} */
    this.lastStorySummary = null;
    this.failureReason = null;
    this.exploration = null;
    this.currentLevelIndex = 0;
    this.importedLevelIndex = null;
    /** The user campaign mission being played, if any. @type {{key: string, missionId: string} | null} */
    this.userCampaign = null;
    this.isEndlessMode = true;
    this.powerupSpawnInterval = 15000;
    this.diagnostics = new RuntimeDiagnostics(!!import.meta.env?.DEV &&
      new URLSearchParams(globalThis.window?.location?.search).has('smoke'));
  }

  async init() {
    try {
      this.initScene();
      this.initCamera();
      this.initRenderer();
      this.uiManager = new UIManager(this.gameState, this.audioManager);
      this.uiManager.game = this;
      this.levelManager = new LevelManager(this.scene, this.spaceship.group);
      this.currentLevelIndex = this.levelManager.levels.findIndex(level => level.campaignOrder === 1);
      this.isEndlessMode = false;
      this.projectileManager = new ProjectileManager(this.scene, this.spaceship.group, this.audioManager, this.session);
      this.projectileManager.setCanvas(this.canvas);
      this.inputManager = new InputManager(this.camera, this.projectileManager, this.gameState, this.uiManager, this.settings, this.controls).init(this.canvas);
      this.inputManager.game = this;
      this.powerUpManager = new PowerUpManager(this.scene, this.spaceship.group, this.gameState, this.audioManager, this.uiManager, this.levelManager);
      this.enemyManager = new EnemyManager(this.scene, this.spaceship.group, this.gameState, this.audioManager, this.levelManager);
      this.enemyManager.powerUpManager = this.powerUpManager;
      this.gameState.setReferences(this.camera, this.audioManager, this.uiManager, this.activeAnimations, this);
      this.initLighting();
      this.caveParticles = createCaveParticles(this.scene);
      await this.levelManager.initMaterials();
      this.levelManager.loadLevel(0); // Static flight arena preview; no live session yet.
      if (!this.uiManager.createStartScreen()) throw new Error('Unable to create the start screen');
      this.animate();
    } catch (error) {
      this.diagnostics.reportError(error, 'Initialization');
      throw error;
    }
  }

  initScene() {
    this.scene.fog = new THREE.FogExp2(0x000511, 0.03);
    this.scene.background = new THREE.Color(0x000511);
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 5;
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.spaceship = new Spaceship();
    this.spaceship.attachCamera(this.camera);
    this.shipView = new ShipView(this.spaceship, this.camera);
    this.cockpit = new CockpitView();
    this.shipView.apply(this.settings.values);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.info.autoReset = false; // One frame may render world and cabin.
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.canvas = this.renderer.domElement;
    document.body.appendChild(this.canvas);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initLighting() {
    this.scene.add(new THREE.AmbientLight(0x333333, 0.3));
    const directional = new THREE.DirectionalLight(0xcccccc, 0.5);
    directional.position.set(5, 10, 7.5);
    this.scene.add(directional);
  }

  initializeAudio() {
    if (!this.audioManager.init()) return;
    for (const [id, frequency, duration] of [
      ['empty', 80, 0.05], ['weaponSwitch', 1000, 0.15], ['hit', 500, 0.1], ['bump', 150, 0.15],
    ]) {
      if (this.audioManager.sounds[id]?.buffer) continue;
      this.audioManager.createSound(id, (ctx) => {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          const t = i / ctx.sampleRate;
          data[i] = Math.sin(2 * Math.PI * frequency * t) * (1 - t / duration) * 0.2;
        }
        return buffer;
      });
    }
    this.audioManager.context.resume().catch((error) => console.warn('Audio could not resume.', error));
    this.audioManager.playSound('backgroundMusic', { isMusic: true, loop: true, volume: 0.4 });
    this.audioManager.playSound('engine', { loop: true, volume: 0.2 });
  }

  releasePointerLock() {
    if (this.inputManager) this.inputManager.wasPointerLocked = false;
    if (globalThis.document?.pointerLockElement) {
      try { document.exitPointerLock(); } catch { /* Already released by browser. */ }
    }
  }

  endSession() {
    this.diagnostics.invalidateCapture?.('Session ended during capture');
    this.stepper.reset();
    this.session.end(); // Invalidate callbacks before touching entities or UI.
    this.mission = null;
    this.anarchy = null;
    this.coop = null;
    this.teamMarkers?.clear();
    this.closeQuickChat?.();
    this.story?.dispose();
    this.story = null;
    this.exploration = null;
    this.inputManager?.clearKeys();
    this.releasePointerLock();
    this.audioManager.stopAllSounds();
    this.audioManager.setPaused(false);
    this.activeAnimations.length = 0;
    this.enemyManager?.resetLevel();
    this.projectileManager?.clear();
    this.powerUpManager?.clear();
    this.levelManager?.clearLevel();
    this.uiManager?.resetSessionUI();
  }

  /** @param {{endless?: boolean, levelIndex?: number, preparedWorld?: unknown, seed?: number, coop?: boolean}} [options]
   * `seed` repeats a session exactly (replays, shared matches). `coop` flies a mission as a team (kept for restarts). */
  startSession({ endless = this.isEndlessMode, levelIndex = this.currentLevelIndex, preparedWorld = null, seed = undefined, coop = this.coopMode } = {}) {
    if (!endless && (!Number.isInteger(levelIndex) || !this.levelManager?.levels[levelIndex])) {
      throw new RangeError(`Unknown mission index: ${levelIndex}`);
    }
    this.endSession();
    this.isEndlessMode = endless;
    this.currentLevelIndex = levelIndex;
    this.coopMode = coop;
    this.session.begin(seed);
    try {
      this.gameState.resetForSession();
      this.gameState.difficulty = getDifficulty(this.settings.values.difficulty);
      this.failureReason = null;
      this.spaceship.reset();
      this.gameState.localPilot.ship = this.spaceship;
      this.lastMovement = null;
      this.camera.position.set(0, 0, 0);
      this.camera.quaternion.identity();
      this.gameState.playerVelocity = this.spaceship.velocity;
      this.caveParticles?.position.set(0, 0, 0);
      this.lastPowerupSpawnTime = 0;
      this.lastParticleUpdate = 0;
      this.levelManager.isEndless = endless;
      if (endless) {
        this.levelManager.currentLevel = null;
        this.levelManager.initEndlessLevel();
      } else this.levelManager.loadLevel(levelIndex, preparedWorld);
      const level = this.levelManager.currentLevel;
      const transientLights = endless || level.kind !== 'arena';
      if (this.enemyManager.effectsManager) this.enemyManager.effectsManager.dynamicLights = transientLights;
      // Anarchy: no mission or story, neutral difficulty, and a match that scores frags.
      this.anarchy = !endless && level.mode === 'anarchy' ? new AnarchyMatch(level.anarchySpawns) : null;
      if (this.anarchy) this.gameState.difficulty = getDifficulty('pilot');
      this.powerUpManager.respawnMs = this.anarchy ? this.anarchy.rules.pickupRespawnMs : null;
      // Online, the server decides pickups, damage, frags and respawns; this game predicts flight only.
      this.powerUpManager.remoteTaken = this.online ? new Set() : null;
      // Online co-op: robots are posed from the server and their shots are only pictures.
      this.enemyManager.remote = !!this.online && !this.anarchy;
      this.enemyManager.projectileManager.harmless = !!this.online;
      this.mission = !endless && level.mission && !this.anarchy ? new MissionObjective(level.mission) : null;
      if (this.anarchy) this.story = null;
      if (!endless && (level.devices?.length || level.doors?.length)) this.levelManager.interaction = new RelayController(
        level, this.levelManager.levelSegments[0], this.levelManager.solidColliders, this.session);
      if (!endless && Number.isFinite(level.combat?.initialPulseAmmo)) {
        const ammo = scaleAmmo(level.combat.initialPulseAmmo, level.combat.maxPulseAmmo, this.gameState.difficulty);
        this.gameState.weaponInventory.pulse.ammo = ammo.initial;
        this.gameState.pulseAmmoCapacity = ammo.capacity;
      }
      this.lastStorySummary = null;
      this.story = !endless && level.story && level.sourceDocument
        ? new StoryController(level.story, level.sourceDocument, this.scene, event => this.uiManager.showStoryEvent?.(event)) : null;
      this.enemyManager.onEnemyDefeated = (id, cause) => {
        if (this.session.phase === 'playing') this.story?.enemyDefeated(id);
        if (this.session.phase === 'playing') this.mission?.recordDefeat(id, cause);
      };
      this.projectileManager.setCombatWorld?.({
        transientLights,
        getColliders: () => this.levelManager.solidColliders,
        getTargets: () => this.enemyManager.enemies,
        getRules: () => this.isEndlessMode ? null : this.levelManager.currentLevel?.combat,
        onTargetHit: (enemy, projectile, position) => this.online ? this.enemyManager.effectsManager?.createHitEffect?.(position.clone())
          : this.enemyManager.hitEnemy(enemy, projectile, position),
        ...(this.anarchy && !this.online ? {
          getPilotTargets: ownerId => this.projectileManager.pilotBodies(this.spaceship.group, this.gameState).filter(body => !ownerId || body.pilot?.id !== ownerId),
          onPilotHit: (pilot, power, attackerId, position) => {
            this.gameState.takeDamage(power, pilot, attackerId);
            this.enemyManager.effectsManager?.createExplosion?.(position, 0xff5533, true, 1);
          },
        } : {}),
        onExplosion: (position, radius) => this.enemyManager.effectsManager.createExplosion(position, 0xff8833, true, radius),
        onWallHit: (collider, projectile, position) => {
          const reactor = this.levelManager.interaction?.hitReactor(collider, level.combat?.pulseDamage ?? projectile.power, id => this.mission?.canActivateDevice(id) ?? true);
          if (reactor) {
            if (reactor.blocked) this.uiManager.showMessage('REACTOR SHIELDED · Clear required drones and other controls first', 1800, '#ffce77');
            else if (reactor.destroyed) {
              this.completeDeviceObjective(reactor);
              this.enemyManager.effectsManager?.createExplosion?.(position, 0xff8833, true, 3);
            } else this.uiManager.showMessage('REACTOR INTEGRITY · ' + reactor.health, 900, '#ff9944');
            return;
          }
          const door = this.levelManager.interaction?.hitDoor(collider);
          if (door) this.uiManager.showMessage(door.concealed ? 'Hidden passage opening' : 'Door opening', 1800, '#ffce77');
        },
      });
      if (this.levelManager.currentLevel?.kind === 'arena' && !endless) {
        this.spaceship.group.position.fromArray(this.levelManager.currentLevel.spawn);
        if (this.levelManager.currentLevel.spawnRotation) this.spaceship.group.quaternion.fromArray(this.levelManager.currentLevel.spawnRotation);
      }
      for (const pilot of this.gameState.pilots) this.placeAtSpawn(pilot);
      if (this.dedicated) this.gameState.localPilot.alive = false;
      // Co-op: a team mission. Everyone respawns at the spawn until the team activates a relay.
      this.coop = coop && !endless && this.mission ? new CoopMatch(this.spaceship.group.position) : null;
      if (this.coop) for (const pilot of this.team()) this.coop.join(pilot.id);
      this.enemyManager.toughness = this.coop ? enemyToughness(this.team().length) : 1;
      // Co-op: everyone gets their own share of ammunition pickups.
      this.powerUpManager.perPilot = this.coop ? PER_PILOT_PICKUPS : null;
      if (this.anarchy) for (const pilot of this.gameState.pilots) {
        if (pilot.local && this.dedicated) continue;
        this.armPilot(pilot); this.anarchy.standing(pilot.id);
      }
      this.exploration = !endless && level.sourceDocument ? new ExplorationMap(level.sourceDocument) : null;
      this.exploration?.update(this.spaceship.group.position);
      if (this.cockpit) this.cockpit.lastUpdate = -Infinity;
      if (this.caveParticles) this.caveParticles.visible = this.levelManager.currentLevel?.kind !== 'arena';
      this.enemyManager.setLevelSegments(this.levelManager.getLevelSegments());
      try { this.initializeAudio(); } catch (error) {
        this.audioManager.stopAllSounds();
        console.warn('Audio setup failed; continuing without sound.', error);
      }
      this.session.transition('playing');
      this.clock.getDelta(); // Discard time spent in menus/loading.
      this.uiManager.hideStartScreen();
      this.uiManager.hideLevelSelect();
      this.uiManager.updateWeaponUI();
      this.uiManager.updateHUD();
      this.uiManager.updateEnemyCount(0, endless ? 0 : this.levelManager.currentLevel.enemySpawns.length);
      if (!endless && this.levelManager.currentLevel?.kind === 'arena') this.uiManager.showArenaGuide?.();
      if (!endless && level.doors?.some(door => door.activation === 'shot' && !door.concealed)) {
        this.uiManager.showMessage('Shoot striped doors to open · R activates cyan relays', 3500, '#ffce77');
      }
      this.story?.start();
      this.inputManager.requestPointerLock();
      return true;
    } catch (error) {
      this.endSession();
      this.session.begin();
      this.session.transition('error');
      this.diagnostics.reportError(error, 'Starting session');
      this.uiManager?.showSessionError(error);
      console.error('Unable to start session:', error);
      return false;
    }
  }

  startGame() { this.userCampaign = null; return this.startSession({ coop: false }); }
  // The editor/file UI can call this after reading JSON. Invalid data or staging
  // failures leave the active session intact. Reuse one imported catalog slot.
  // `campaign` marks a user campaign mission; replays keep it, other entries clear it.
  startLevelDocument(input, campaign = null) {
    const prepared = prepareLevelDocument(input);
    this.userCampaign = campaign;
    try {
      this.importedLevelIndex ??= this.levelManager.levels.length;
      this.levelManager.levels[this.importedLevelIndex] = prepared.level;
      return this.startSession({ endless: false, levelIndex: this.importedLevelIndex, preparedWorld: prepared.world });
    } finally {
      if (!prepared.world.claimed) disposeObject(prepared.world.group);
    }
  }
  selectLevel(index) { this.userCampaign = null; return this.startSession({ endless: false, levelIndex: index, coop: false }); }
  selectEndlessMode() { this.userCampaign = null; return this.startSession({ endless: true, coop: false }); }
  restartLevel() { return this.startSession(); }
  restartGame() { return this.startSession(); }

  pauseGame() {
    if (this.session.phase !== 'playing') return false;
    this.diagnostics.invalidateCapture?.('Paused during capture');
    this.stepper.reset();
    this.session.transition('paused');
    this.closeQuickChat();
    this.online?.holdStill();
    this.inputManager.clearKeys();
    this.audioManager.setPaused(true);
    this.releasePointerLock();
    this.uiManager.showPauseMenu();
    return true;
  }

  resumeGame() {
    if (this.session.phase !== 'paused') return false;
    this.session.transition('playing');
    this.inputManager.clearKeys();
    this.clock.getDelta();
    this.audioManager.setPaused(false);
    this.uiManager.hidePauseMenu();
    this.inputManager.requestPointerLock();
    return true;
  }

  togglePause() { return this.session.phase === 'paused' ? this.resumeGame() : this.pauseGame(); }

  /** Read-only status of the current attempt for the pause menu and HUD. */
  missionStatus() {
    const level = this.levelManager?.currentLevel;
    if (!level || this.isEndlessMode) return null;
    const kills = Object.values(this.gameState.enemyKills).reduce((sum, count) => sum + count, 0);
    return describeMissionStatus({ level, mission: this.mission, story: this.story?.summary() ?? null,
      timeMs: this.session.timeMs, difficulty: this.gameState.difficulty.label, kills });
  }

  /** Pause and open the comms log; from the pause menu it simply expands the log. */
  openMissionLog() {
    if (this.session.phase === 'playing') {
      if (!this.pauseGame()) return false;
    } else if (this.session.phase !== 'paused') return false;
    this.uiManager.showPauseMenu({ openComms: true });
    return true;
  }

  die(reason = 'combat') {
    if (this.session.phase !== 'playing') return false;
    this.failureReason = reason;
    if (reason === 'reactor') this.gameState.playerHealth = 0;
    this.session.transition('dead');
    this.session.tasks.clear();
    this.inputManager.clearKeys();
    this.releasePointerLock();
    this.audioManager.stopAllSounds();
    this.audioManager.playSound('gameOver', { volume: 0.6 });
    this.uiManager.updateHUD();
    this.uiManager.showGameOver();
    return true;
  }

  completeSession() {
    if (this.session.phase !== 'playing' || this.isEndlessMode) return false;
    if (this.mission && !this.mission.completed) return false;
    this.session.transition('completed');
    this.session.tasks.clear();
    this.gameState.score += 1000;
    // Survivors count only on extraction; recovered logs add a small bonus.
    this.lastStorySummary = this.story?.summary() ?? null;
    if (this.lastStorySummary) this.gameState.score += this.lastStorySummary.rescued * 250 + this.lastStorySummary.logsFound * 100;
    const progress = this.recordCampaignProgress();
    const campaignProgress = this.recordUserCampaignProgress();
    this.inputManager.clearKeys();
    this.releasePointerLock();
    this.audioManager.stopAllSounds();
    this.audioManager.playSound('powerup', { volume: 0.7 });
    this.uiManager.updateHUD();
    this.uiManager.showCompletion(this.userCampaign ? this.nextUserCampaignIndex() !== null : this.nextMissionIndex() !== -1, progress, campaignProgress);
    return true;
  }

  /** Show a user campaign mission's briefing; launching starts it from My Levels.
   * @param {string} key @param {number} index */
  playUserCampaign(key, index) {
    const { levels, campaigns } = this.uiManager.userLibraries();
    levels.sync(); campaigns.sync();
    const campaign = campaigns.get(key), mission = campaign?.missions[index], entry = mission ? levels.get(mission.levelKey) : null;
    if (!campaign || !mission || !entry) { this.uiManager.showMessage?.('That campaign mission is no longer available.', 2500, '#ffce77'); return false; }
    this.uiManager.hideLevelSelect();
    this.uiManager.showCampaignBriefing({ campaignName: campaign.name, index, total: campaign.missions.length, levelName: entry.document.name, briefing: mission.briefing },
      () => this.startLevelDocument(entry.document, { key, missionId: mission.id }), () => this.showUserLevels());
    return true;
  }

  /** Index of the mission after the current one in its campaign's present order. */
  nextUserCampaignIndex() {
    if (!this.userCampaign) return null;
    const campaign = this.uiManager.userLibraries().campaigns.get(this.userCampaign.key);
    const index = campaign?.missions.findIndex(mission => mission.id === this.userCampaign?.missionId) ?? -1;
    return campaign && index >= 0 && index + 1 < campaign.missions.length ? index + 1 : null;
  }

  recordUserCampaignProgress() {
    if (!this.userCampaign) return null;
    const { campaigns } = this.uiManager.userLibraries();
    try {
      const result = campaigns.recordCompletion(this.userCampaign.key, this.userCampaign.missionId);
      return { ...result, name: campaigns.get(this.userCampaign.key)?.name ?? 'Campaign' };
    } catch (error) {
      console.warn('Campaign progress was not recorded.', error);
      return null;
    }
  }

  /** Built-in campaign missions, in order. Imported/playtest documents are excluded even
   * when they reuse a campaign document's id. */
  campaignMissions() {
    return (this.levelManager?.levels ?? []).filter((level, index) => level.campaignOrder && index !== this.importedLevelIndex)
      .map(level => ({ id: level.id, name: level.name, campaignOrder: level.campaignOrder }))
      .sort((a, b) => a.campaignOrder - b.campaignOrder);
  }

  recordCampaignProgress() {
    const level = this.levelManager?.levels[this.currentLevelIndex];
    if (!level?.campaignOrder || !level.id || this.currentLevelIndex === this.importedLevelIndex) return null;
    const result = this.campaignProgress.recordCompletion({ id: level.id, campaignOrder: level.campaignOrder },
      { score: this.gameState.score, timeMs: this.session.timeMs, difficulty: this.gameState.difficulty.id,
        rescued: this.lastStorySummary?.rescued ?? 0, logIds: this.lastStorySummary?.logIds ?? [] });
    if (!result) return null;
    const campaign = this.campaignMissions();
    return { ...result, timeMs: this.session.timeMs, difficulty: this.gameState.difficulty, saved: this.campaignProgress.saveStatus === 'saved',
      completed: this.campaignProgress.completedCount(campaign), total: campaign.length };
  }

  /** Main-menu campaign entry: resume at the first uncompleted mission, or replay from the start. */
  continueCampaign() {
    const campaign = this.campaignMissions();
    const target = this.campaignProgress.nextMission(campaign) ?? campaign[0];
    const index = target ? this.levelManager.levels.findIndex((level, i) => level.id === target.id && level.campaignOrder && i !== this.importedLevelIndex) : -1;
    this.userCampaign = null;
    return this.startSession({ endless: false, levelIndex: Math.max(0, index), coop: false });
  }

  resetCampaignProgress() {
    this.campaignProgress.reset();
    return this.campaignProgress.saveStatus;
  }

  nextMission() {
    if (this.session.phase !== 'completed') return false;
    if (this.userCampaign) {
      const index = this.nextUserCampaignIndex();
      return index !== null && this.playUserCampaign(this.userCampaign.key, index);
    }
    const next = this.nextMissionIndex();
    if (next === -1) return false;
    return this.startSession({ endless: false, levelIndex: next });
  }

  nextMissionIndex() {
    if (this.currentLevelIndex === this.importedLevelIndex) return -1;
    const level = this.levelManager.levels[this.currentLevelIndex];
    if (level?.campaignOrder) return this.levelManager.levels.findIndex(candidate => candidate.campaignOrder === level.campaignOrder + 1);
    const next = this.currentLevelIndex + 1;
    // Practice missions chain to the next practice mission, never into an Anarchy arena.
    return next < this.levelManager.levels.length && next !== this.importedLevelIndex && this.levelManager.levels[next]?.mode !== 'anarchy' ? next : -1;
  }

  showUserLevels() {
    this.leaveOnline();
    this.endSession();
    this.uiManager.hideStartScreen();
    this.uiManager.createUserLevels(this);
  }

  showLevelSelection() {
    this.leaveOnline();
    this.endSession();
    this.uiManager.hideStartScreen();
    this.uiManager.createLevelSelect(this);
  }

  /** The online lobby: pick a server, then create or join a room. */
  showOnlineLobby() {
    this.leaveOnline();
    this.endSession();
    this.uiManager.hideStartScreen();
    return createOnlineLobby(this, { onBack: () => this.showMainMenu() });
  }

  showMainMenu() {
    this.leaveOnline();
    this.endSession();
    this.uiManager.createStartScreen();
  }

  interact() {
    // Online, the relay key goes to the server with the next input.
    if (this.online) { if (this.session.phase !== 'playing') return false; this.online.queueInteract(); return true; }
    return this.interactAt(this.spaceship.group.position, true);
  }

  /** A remote pilot presses the relay key (co-op). @param {string} id */
  pilotInteract(id) {
    const pilot = this.gameState.pilot(id);
    if (!pilot || pilot.local || !pilot.alive || !pilot.position) return false;
    return this.interactAt(pilot.position, false);
  }

  /** @param {THREE.Vector3} position @param {boolean} local whether this screen's pilot pressed it (for the interlock message) */
  interactAt(position, local) {
    if (this.session.phase !== 'playing') return false;
    const nearby = this.levelManager.interaction?.nearest(position);
    if (nearby && this.mission && !this.mission.canActivateDevice(nearby.id)) {
      if (local) this.uiManager.showMessage('REACTOR INTERLOCK · Clear required drones and activate the other relays first', 2500, '#ffce77');
      return false;
    }
    const device = this.levelManager.interaction?.tryActivate(position);
    if (!device) return false;
    this.completeDeviceObjective(device);
    return true;
  }

  completeDeviceObjective(device) {
    this.mission?.recordDeviceActivation(device.id, this.session.timeMs);
    // Co-op: the team now respawns at this relay.
    const placed = this.levelManager.interaction?.devices?.find(/** @param {any} candidate */ candidate => candidate.id === device.id);
    if (this.coop && placed?.position && placed.kind !== 'reactor') this.coop.setCheckpoint(placed.position, device.label);
    this.story?.deviceActivated(device.id);
    this.exploration?.completedDevices.add(device.id);
    const escape = this.mission?.definition.escape;
    this.uiManager.showMessage(device.id === escape?.triggerDeviceId
      ? `REACTOR CRITICAL · ${escape.durationSeconds}s TO ESCAPE · Follow the map to extraction`
      : `${device.label} activated · linked doors unlocked`, 2500, device.id === escape?.triggerDeviceId ? '#ff9944' : '#45ff96');
    this.uiManager.updateMissionUI?.();
    return true;
  }

  toggleShipOption(option) {
    const values = this.settings.values;
    const views = ['hud', 'external', 'cockpit'];
    this.settings.update({ [option]: option === 'cameraView' ? views[(views.indexOf(values.cameraView) + 1) % views.length] : !values[option] });
    const current = this.settings.values;
    this.uiManager?.showMessage(option === 'cameraView' ? `${{ hud: 'HUD / first-person', external: 'External', cockpit: 'Cockpit' }[current.cameraView]} view` : option === 'headlights' ? `Headlights ${current.headlights ? 'on' : 'off'}` : `HUD ${current.showHUD ? 'on' : 'off'} · H to toggle`, 1800, '#9ce5ed');
  }

  toggleMap() { this.uiManager.navigationDisplay.toggle(); }

  updateMission() {
    if (!this.mission || this.session.phase !== 'playing') return;
    // Online, the server decides success and failure; this screen only shows the exit.
    if (this.online) { this.levelManager.updateExitMarker(this.mission.ready); return; }
    if (this.mission.failed || this.mission.updateEscape(this.session.timeMs)) { this.die('reactor'); return; }
    this.levelManager.updateExitMarker(this.mission.ready);
    if (this.coop) { this.updateTeamExtraction(); return; }
    if (this.mission.tryComplete(this.spaceship.group.position, this.spaceship.radius, this.session.timeMs)) this.completeSession();
  }

  /** Co-op extraction: every living pilot must reach the exit. */
  updateTeamExtraction() {
    const mission = this.mission, coop = this.coop;
    if (!mission || !coop || !mission.ready) return;
    const team = this.team(), atExit = /** @param {any} pilot */ pilot => !!pilot.position && mission.canExit(pilot.position, pilot.radius);
    if (coop.everyoneOut(team, atExit)) {
      const first = team.find(pilot => pilot.alive);
      if (first && mission.tryComplete(first.position, first.radius, this.session.timeMs)) this.completeSession();
      return;
    }
    const waiting = team.filter(pilot => pilot.alive && atExit(pilot)).length;
    if (waiting && this.session.timeMs - (this.lastExtractionNotice ?? -Infinity) > 2500) {
      this.lastExtractionNotice = this.session.timeMs;
      const living = team.filter(pilot => pilot.alive).length;
      this.uiManager?.showMessage?.(`EXTRACTION · ${waiting}/${living} pilots at the exit · Waiting for the team`, 2000, '#45ff96');
    }
  }

  updateSimulation(delta) {
    if (this.session.phase !== 'playing') return;
    const generation = this.session.id;
    this.session.advance(delta);
    if (this.session.id !== generation || this.session.phase !== 'playing') return;
    if (!this.online && (this.mission?.failed || this.mission?.updateEscape(this.session.timeMs))) { this.die('reactor'); return; }
    this.levelManager.interaction?.update(delta);
    for (let i = this.activeAnimations.length - 1; i >= 0; i--) {
      if (this.activeAnimations[i](delta)) this.activeAnimations.splice(i, 1);
    }
    const grounded = (this.anarchy || this.coop) && !this.gameState.localPilot.alive;
    /** @type {import('./contracts.js').FlightInput | null | undefined} */ let input = null;
    if (grounded) this.spaceship.velocity.set(0, 0, 0);
    else input = this.inputManager.updateMovement(delta);
    if (grounded) { /* Down in Anarchy: wait for the respawn. */ } else if (!this.isEndlessMode && this.levelManager.currentLevel?.kind === 'arena') {
      this.lastMovement = moveSphere(this.spaceship.group.position, this.spaceship.velocity,
        delta, this.levelManager.solidColliders, this.spaceship.radius);
    } else {
      const intended = this.spaceship.velocity.clone().multiplyScalar(delta);
      const collision = checkPlayerObstacleCollision(this.spaceship.group, this.levelManager.obstacles,
        intended, this.levelManager.tunnelWidth, this.levelManager.tunnelHeight);
      if (collision) this.spaceship.velocity.set(0, 0, 0);
      else this.spaceship.group.position.add(intended);
    }
    // Online: send this step's input; other ships are posed from snapshots each frame.
    if (this.online) this.online.step(input ?? null, delta);
    else this.moveRemotePilots(delta);
    this.levelManager.updateLevel();
    const environment = this.levelManager.environment?.update(this.session, this.spaceship.group.position, this.spaceship.radius);
    if (environment?.entered) this.uiManager.showMessage(environment.entered === 'lava'
      ? 'LAVA CONTACT · Move clear of the surface' : 'WATER / COOLANT · Surface contact', 1800, environment.entered === 'lava' ? '#ff9944' : '#70dce8');
    if (environment?.damage && !this.online) this.gameState.takeDamage(environment.damage);
    // Every other pilot touches lava and water too (each with their own damage cadence).
    if (this.levelManager.environment && !this.online) for (const pilot of this.gameState.pilots) {
      if (pilot.local || !pilot.alive || !pilot.position) continue;
      const contact = this.levelManager.environment.update(this.session, pilot.position, pilot.radius, pilot.id);
      if (contact.damage) this.gameState.takeDamage(contact.damage, pilot);
    }
    if (this.session.id !== generation || this.session.phase !== 'playing') return;
    this.exploration?.update(this.spaceship.group.position);
    this.story?.update(this.spaceship.group.position, this.session.timeMs, this.wingmatePositions());
    this.enemyManager.setLevelSegments(this.levelManager.getLevelSegments());
    this.enemyManager.updateEnemies(delta);
    if (this.session.phase !== 'playing') return;
    this.projectileManager.updateProjectiles(delta);
    if (this.session.phase !== 'playing') return;
    this.powerUpManager.update(delta);
    if (!this.online) this.updateAnarchy();
    if (this.session.phase !== 'playing') return;
    this.updateCoop(delta);
    if (this.session.phase !== 'playing') return;
    this.updateMission();
    if (this.session.phase !== 'playing') return;
    if (this.caveParticles && this.session.timeMs - this.lastParticleUpdate >= 50) {
      updateCaveParticles(this.caveParticles, (this.session.timeMs - this.lastParticleUpdate) / 1000);
      this.lastParticleUpdate = this.session.timeMs;
    }
    if (this.isEndlessMode && this.session.timeMs - this.lastPowerupSpawnTime >= this.powerupSpawnInterval) {
      this.powerUpManager.spawnRandomPowerup();
      this.lastPowerupSpawnTime = this.session.timeMs;
    }
    this.uiManager.updateHUD();
    this.diagnostics.recordUpdate();
  }

  /** Anarchy takes over when a pilot goes down: the pilot is out until the respawn,
   * the kill is scored, and the session goes on. Returns false outside Anarchy.
   * @param {import('./core/Pilot.js').default} pilot @param {string | null} attackerId */
  pilotDown(pilot, attackerId) {
    if (this.coop && this.session.phase === 'playing') return this.coopPilotDown(pilot);
    if (!this.anarchy || this.session.phase !== 'playing') return false;
    pilot.alive = false;
    this.anarchy.recordDeath(pilot.id, attackerId, this.session.timeMs);
    const position = pilot.local ? this.spaceship.group.position : pilot.ship?.group.position;
    if (position) this.enemyManager.effectsManager?.createExplosion?.(position.clone(), 0xffaa33, true, 3);
    if (pilot.ship && !pilot.local) pilot.ship.group.visible = false;
    const local = this.gameState.localPilot;
    if (pilot.local) this.uiManager?.showMessage(attackerId && attackerId !== pilot.id ? `DESTROYED BY ${attackerId.toUpperCase()} · Respawning in 3s` : 'SHIP LOST · −1 frag · Respawning in 3s', 2800, '#ff7755');
    else if (attackerId === local.id) this.uiManager?.showMessage(`FRAG · ${pilot.id.toUpperCase()} destroyed · ${this.anarchy.standing(local.id).frags} frags`, 1800, '#45ff96');
    return true;
  }

  /** The pilots flying this mission (a game server's own ship is not one of them). */
  team() { return this.gameState.pilots.filter(pilot => !(pilot.local && this.dedicated)); }

  /** Where the other living pilots are (story pickups count for the team). */
  wingmatePositions() {
    const positions = [];
    for (const pilot of this.gameState.pilots) if (!pilot.local && pilot.alive && pilot.position) positions.push(pilot.position);
    return positions;
  }

  /** Co-op: a pilot is down. With a life in the team pool they come back at the last
   * relay; when nobody is flying and nobody is due back, the mission is lost.
   * @param {import('./core/Pilot.js').default} pilot */
  coopPilotDown(pilot) {
    const coop = /** @type {CoopMatch} */ (this.coop);
    pilot.alive = false;
    const ship = pilot.local ? this.spaceship : pilot.ship;
    if (ship) this.enemyManager.effectsManager?.createExplosion?.(ship.group.position.clone(), 0xffaa33, true, 3);
    if (ship && !pilot.local) ship.group.visible = false;
    if (pilot.local) this.spaceship.velocity.set(0, 0, 0);
    const queued = coop.recordDown(pilot.id, this.session.timeMs, ship?.group.position);
    const seconds = Math.round(coop.rules.respawnMs / 1000);
    if (pilot.local) this.uiManager?.showMessage(queued ? `SHIP LOST · Respawning at ${coop.checkpointLabel ?? 'the drop point'} in ${seconds}s · ${coop.lives} team lives left` : 'SHIP LOST · No team lives left · A wingmate can revive you at your wreck', 3000, '#ff7755');
    else this.uiManager?.showMessage(queued ? `${pilot.id.toUpperCase()} DOWN · back in ${seconds}s · ${coop.lives} team lives left` : `${pilot.id.toUpperCase()} DOWN · no team lives left`, 2200, '#ffaa66');
    if (coop.checkWipe(this.team())) this.die('combat');
    return true;
  }

  /** Co-op each step: robot toughness for the team size, revives, respawns, and the wipe check.
   * @param {number} [delta] seconds */
  updateCoop(delta = 1 / 60) {
    const coop = this.coop;
    if (!coop || this.online || this.session.phase !== 'playing') return;
    const team = this.team();
    this.enemyManager.toughness = enemyToughness(team.length);
    for (const revive of coop.updateRevives(team, delta * 1000)) {
      const pilot = this.gameState.pilot(revive.id);
      if (pilot) this.reviveTeamPilot(pilot, revive.position, revive.by);
    }
    for (const id of coop.dueRespawns(this.session.timeMs)) {
      const pilot = this.gameState.pilot(id);
      if (pilot) this.respawnTeamPilot(pilot);
    }
    if (coop.checkWipe(team)) this.die('combat');
  }

  /** A teammate stayed by the wreck: back in where they fell, with half shields and
   * the weapons they had. @param {import('./core/Pilot.js').default} pilot
   * @param {THREE.Vector3} position @param {string} by */
  reviveTeamPilot(pilot, position, by) {
    const coop = this.coop;
    if (!coop) return;
    pilot.alive = true; pilot.health = Math.min(pilot.maxHealth, coop.rules.reviveHealth); pilot.input = {};
    const ship = pilot.local ? this.spaceship : pilot.ship;
    if (ship) { ship.velocity.set(0, 0, 0); ship.group.visible = true; ship.group.position.copy(position); }
    if (pilot.local) { this.gameState.playerVelocity = this.spaceship.velocity; this.uiManager?.updateHUD(); this.uiManager?.showMessage(`REVIVED by ${by.toUpperCase()} · Half shields`, 2000, '#45ff96'); }
    else this.uiManager?.showMessage(by === this.gameState.localPilot.id ? `You revived ${pilot.id.toUpperCase()}` : `${pilot.id.toUpperCase()} revived`, 1800, '#45ff96', 70);
  }

  /** Quick-chat: open or close the phrase strip. */
  toggleQuickChat() {
    if (this.quickChatOpen) { this.closeQuickChat(); return false; }
    if (this.session.phase !== 'playing') return false;
    this.quickChatOpen = true;
    this.uiManager?.showQuickChat?.(QUICK_CHAT);
    return true;
  }

  closeQuickChat() {
    if (!this.quickChatOpen) return;
    this.quickChatOpen = false;
    this.uiManager?.hideQuickChat?.();
  }

  /** Send phrase `index` from the open strip. @param {number} index */
  sendQuickChat(index) {
    this.closeQuickChat();
    return this.sendSignal({ kind: 'quick', phrase: index });
  }

  /** Ping the point the ship is aiming at. */
  markTarget() {
    if (this.session.phase !== 'playing' || !this.gameState.localPilot.alive) return false;
    return this.sendSignal({ kind: 'mark', p: aimPoint(this.spaceship.group.position, this.spaceship.group.quaternion, this.levelManager?.solidColliders ?? []) });
  }

  /** Online the server relays the signal to the room (and back here); offline it shows at once.
   * @param {any} raw */
  sendSignal(raw) {
    const signal = cleanSignal(raw);
    if (!signal) return false;
    if (this.online) return this.online.sendSignal(signal);
    if (!this.signalLimiter.allow(this.gameState.localPilot.id, this.session.timeMs)) return false;
    this.showSignal(this.gameState.localPilot.id, signal);
    return true;
  }

  /** Show a teammate's (or our own) signal: a line in their colour, and a marker for pings.
   * @param {string} from @param {import('./core/TeamSignals.js').TeamSignal} signal */
  showSignal(from, signal) {
    const name = this.online?.nameOf(from) ?? (from === this.gameState.localPilot.id ? 'You' : from.toUpperCase());
    const colour = this.online?.colours.get(from) ?? (from === this.gameState.localPilot.id ? 0x45ff96 : 0xffce77);
    const css = `#${colour.toString(16).padStart(6, '0')}`;
    if (signal.kind === 'quick') this.uiManager?.showMessage(`${name}: ${QUICK_CHAT[signal.phrase]}`, 2600, css, -60);
    else {
      this.teamMarkers.mark(from, signal.p, colour, this.wallClock());
      this.uiManager?.showMessage(`${name} marked a spot`, 1600, css, -60);
    }
    this.audioManager?.playSound?.('weaponSwitch', { volume: 0.25 });
  }

  /** Real time for presentation (markers keep fading while paused). */
  wallClock() { return globalThis.performance?.now?.() ?? Date.now(); }

  /** Each frame: animate pings and show wrecks (from the server when online). */
  updateTeamMarkers() {
    const wrecks = this.online ? (this.online.coopState?.wrecks ?? [])
      : this.coop ? [...this.coop.wrecks].map(([id, wreck]) => ({ id, p: wreck.position.toArray(), progress: wreck.progressMs / this.coop.rules.reviveMs })) : [];
    this.teamMarkers.syncWrecks(wrecks, id => this.online?.colours.get(id) ?? 0xffaa66);
    this.teamMarkers.update(this.wallClock());
  }

  /** Back in at the team's checkpoint with full shields and the mission's starting ammunition.
   * @param {import('./core/Pilot.js').default} pilot */
  respawnTeamPilot(pilot) {
    const coop = this.coop;
    if (!coop) return;
    pilot.respawn(this.session);
    const combat = this.levelManager.currentLevel?.combat;
    if (Number.isFinite(combat?.initialPulseAmmo)) {
      const ammo = scaleAmmo(combat.initialPulseAmmo, combat.maxPulseAmmo, this.gameState.difficulty);
      pilot.weaponInventory.pulse.ammo = ammo.initial; pilot.pulseAmmoCapacity = ammo.capacity;
    }
    const ship = pilot.local ? this.spaceship : pilot.ship;
    if (!ship) return;
    ship.reset(); ship.group.visible = true;
    ship.group.position.copy(coop.checkpoint);
    if (pilot.local) { this.gameState.playerVelocity = ship.velocity; this.uiManager?.updateWeaponUI(); this.uiManager?.updateHUD(); this.uiManager?.showMessage('BACK IN THE FIGHT', 1500, '#45ff96'); }
  }

  /** Respawns, the time limit and the end of an Anarchy match. */
  updateAnarchy() {
    const match = this.anarchy;
    if (!match || this.session.phase !== 'playing') return;
    for (const id of match.dueRespawns(this.session.timeMs)) {
      const pilot = this.gameState.pilot(id);
      if (pilot) this.respawnPilot(pilot);
    }
    match.checkTime(this.session.timeMs);
    if (match.over) this.endAnarchy();
  }

  /** Back in at the spawn farthest from the live pilots.
   * @param {import('./core/Pilot.js').default} pilot */
  respawnPilot(pilot) {
    if (!this.anarchy) return;
    const occupied = this.gameState.pilots.filter(other => other !== pilot && other.alive).map(other => other.position).filter(position => position !== null);
    const point = this.anarchy.safestSpawn(occupied);
    pilot.respawn(this.session);
    this.armPilot(pilot);
    const ship = pilot.local ? this.spaceship : pilot.ship;
    if (!ship) return;
    ship.reset(); ship.group.visible = true;
    ship.group.position.copy(point);
    if (pilot.local) { this.gameState.playerVelocity = ship.velocity; this.uiManager?.updateWeaponUI(); this.uiManager?.updateHUD(); }
  }

  /** Anarchy loadout: the arena's starting pulse ammunition, the same for everyone.
   * @param {import('./core/Pilot.js').default} pilot */
  armPilot(pilot) {
    const combat = this.levelManager.currentLevel?.combat;
    if (!Number.isFinite(combat?.initialPulseAmmo)) return;
    pilot.weaponInventory.pulse.ammo = combat.initialPulseAmmo;
    pilot.pulseAmmoCapacity = combat.maxPulseAmmo ?? combat.initialPulseAmmo;
  }

  endAnarchy() {
    const match = this.anarchy;
    if (!match || this.session.phase !== 'playing') return false;
    this.session.transition('completed');
    this.session.tasks.clear();
    this.inputManager.clearKeys();
    this.releasePointerLock();
    this.audioManager.stopAllSounds();
    this.audioManager.playSound('powerup', { volume: 0.7 });
    this.uiManager.showAnarchyResult?.(match.standings(), match.winnerId, this.gameState.localPilot.id);
    return true;
  }

  /** Join (or create, with no room code) an online Anarchy room on a game server.
   * Resolves once the match is running here; rejects with a readable message.
   * @param {{url: string, name?: string, room?: string | null, mode?: 'anarchy' | 'coop', map?: string | null}} options */
  async joinOnline(options) {
    this.leaveOnline();
    const match = new OnlineMatch(this, options);
    try { await match.connect(); return match; } catch (error) {
      if (this.online === match) this.leaveOnline(); else match.close();
      throw error;
    }
  }

  /** Leave the online room and drop the other players' ships. */
  leaveOnline() {
    const match = this.online;
    if (!match) return false;
    this.online = null;
    match.close();
    this.endSession();
    for (const pilot of [...this.gameState.pilots]) if (!pilot.local) this.removePilot(pilot.id);
    this.gameState.localPilot.id = 'local';
    return true;
  }

  /** @param {OnlineMatch} match */
  onlineConnectionLost(match) {
    if (this.online !== match) return;
    this.leaveOnline();
    this.uiManager?.showResult?.('CONNECTION LOST', describeNetError('connection-lost'), [['MAIN MENU', () => this.showMainMenu()]]);
  }

  /** Add another pilot with their own ship (a remote player, or a second ship in
   * a headless test). They start at the mission spawn and are flown by setPilotInput.
   * @param {string} id @returns {import('./core/Pilot.js').default} */
  addPilot(id) {
    const ship = new Spaceship();
    const pilot = this.gameState.addPilot({ id, ship });
    this.scene.add(ship.group);
    this.placeAtSpawn(pilot);
    if (this.anarchy) { this.armPilot(pilot); this.anarchy.standing(pilot.id); }
    if (this.coop) {
      this.coop.join(pilot.id);
      const combat = this.levelManager.currentLevel?.combat;
      if (Number.isFinite(combat?.initialPulseAmmo)) {
        const ammo = scaleAmmo(combat.initialPulseAmmo, combat.maxPulseAmmo, this.gameState.difficulty);
        pilot.weaponInventory.pulse.ammo = ammo.initial; pilot.pulseAmmoCapacity = ammo.capacity;
      }
      // A late joiner arrives at the team's checkpoint.
      pilot.ship?.group.position.copy(this.coop.checkpoint);
    }
    return pilot;
  }

  /** @param {string} id */
  removePilot(id) {
    const pilot = this.gameState.pilot(id);
    if (!pilot || !this.gameState.removePilot(id)) return false;
    if (pilot.ship) this.scene.remove(pilot.ship.group);
    this.coop?.leave(id);
    this.levelManager?.environment?.forget?.(id);
    return true;
  }

  /** Give a pilot a new flight command; it holds until the next one.
   * @param {string} id @param {import('./contracts.js').FlightInput} input */
  setPilotInput(id, input) {
    const pilot = this.gameState.pilot(id);
    if (!pilot || pilot.local) throw new Error(`No remote pilot ${id}`);
    pilot.input = { ...input };
  }

  /** Fire a remote pilot's selected weapon from their ship. @param {string} id */
  pilotFire(id) {
    const pilot = this.gameState.pilot(id);
    if (!pilot || pilot.local) throw new Error(`No remote pilot ${id}`);
    return this.projectileManager.fireProjectile(this.gameState, { pilot });
  }

  /** Reset a remote pilot's ship and put it at the mission spawn.
   * @param {import('./core/Pilot.js').default} pilot */
  placeAtSpawn(pilot) {
    if (!pilot.ship || pilot.local) return;
    pilot.ship.reset();
    if (this.anarchy) {
      const occupied = this.gameState.pilots.filter(other => other !== pilot && other.alive).map(other => other.position).filter(position => position !== null);
      pilot.ship.group.position.copy(this.anarchy.safestSpawn(occupied));
      return;
    }
    const level = this.levelManager?.currentLevel;
    if (level?.kind === 'arena' && !this.isEndlessMode) {
      pilot.ship.group.position.fromArray(level.spawn);
      if (level.spawnRotation) pilot.ship.group.quaternion.fromArray(level.spawnRotation);
    }
  }

  /** Each remote pilot flies with their held command, colliding with walls like the
   * local ship. Pilots who are down stay where they are. @param {number} delta */
  moveRemotePilots(delta) {
    const arena = !this.isEndlessMode && this.levelManager.currentLevel?.kind === 'arena';
    for (const pilot of this.gameState.pilots) {
      if (pilot.local || !pilot.alive || !pilot.ship) continue;
      pilot.ship.update(delta, pilot.input, pilot.speedMultiplier);
      if (arena) moveSphere(pilot.ship.group.position, pilot.ship.velocity, delta, this.levelManager.solidColliders, pilot.ship.radius);
      else pilot.ship.group.position.addScaledVector(pilot.ship.velocity, delta);
    }
  }

  advanceFrame(delta) {
    if (this.session.phase !== 'playing') { this.stepper.reset(); return; }
    const generation = this.session.id;
    this.stepper.advance(delta, (step) => {
      this.updateSimulation(step);
      return this.session.phase === 'playing' && this.session.id === generation;
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    try {
      const frameStart = this.diagnostics.enabled ? performance.now() : 0;
      this.inputManager?.pollGamepad?.();
      this.advanceFrame(this.clock.getDelta());
      this.online?.frame();
      this.updateTeamMarkers();
      if (this.shipView && this.levelManager) {
        const aim = this.shipView.update(this.levelManager.solidColliders);
        this.uiManager?.updateShipView?.(aim);
      }
      this.levelManager.visibility?.update(this.camera);
      this.renderer?.info?.reset();
      if (this.session.phase !== 'error') this.renderer?.render(this.scene, this.camera);
      if (this.cockpit && this.settings.values.cameraView === 'cockpit' && ['playing', 'paused'].includes(this.session.phase)) {
        this.cockpit.update(this.gameState, this.spaceship, this.exploration, this.enemyManager.enemies,
          this.levelManager.interaction?.closedConnections ?? new Set(), this.session.timeMs, this.settings.values.headlights);
        this.cockpit.render(this.renderer, this.camera.aspect, this.settings.values.showHUD);
      }
      this.diagnostics.recordFrame(this.gameState, this.diagnostics.enabled ? performance.now() - frameStart : 0);
    } catch (error) {
      this.diagnostics.reportError(error, 'Simulation/render');
      console.error('Game update failed:', error);
      this.endSession();
      this.session.begin();
      this.session.transition('error');
      this.uiManager?.showSessionError(error);
    }
  }
}
