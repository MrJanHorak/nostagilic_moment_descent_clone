// Audio management system for the game
export default class AudioManager {
  constructor() {
    this.sounds = {};
    this.music = null;
    this.isMuted = false;

    // Set default volumes
    this.musicVolume = 0.4;
    this.effectsVolume = 0.6;

    // Create audio context when first interaction happens
    this.context = null;
    this.masterGain = null;
    this.effectsGain = null;
    this.musicGain = null;

    // Initialize on demand to comply with browser autoplay policies
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    // Create audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.context = new AudioContext();

    // Create master gain
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);

    // Create separate gain nodes for music and effects
    this.effectsGain = this.context.createGain();
    this.effectsGain.connect(this.masterGain);
    this.effectsGain.gain.value = this.effectsVolume;

    this.musicGain = this.context.createGain();
    this.musicGain.connect(this.masterGain);
    this.musicGain.gain.value = this.musicVolume;

    this.initialized = true;
    console.log('Audio system initialized');

    // Pre-load common sound effects with correct paths to placeholder sounds
    this.loadSound('shoot', '/sounds/placeholders/laser.mp3');
    this.loadSound('explosion', '/sounds/placeholders/explosion.mp3');
    this.loadSound('powerup', '/sounds/placeholders/powerup.mp3');
    this.loadSound('playerDamage', '/sounds/placeholders/player_damage.mp3');
    this.loadSound('gameOver', '/sounds/placeholders/game_over.mp3');
    this.loadSound('engine', '/sounds/placeholders/engine_hum.mp3');
    this.loadSound(
      'backgroundMusic',
      '/sounds/placeholders/background_music.mp3'
    );
    this.loadSound('menuSelect', '/sounds/placeholders/menu_select.mp3');
    this.loadSound('healSound', '/sounds/placeholders/heal.mp3');
  }
  // Load a sound file
  loadSound(id, url) {
    if (!this.initialized) {
      console.warn(
        'AudioManager not initialized when attempting to load sound'
      );
      return null;
    }

    // Create an entry for this sound even before loading
    // so we don't get "Sound not loaded" errors
    if (!this.sounds[id]) {
      this.sounds[id] = {
        buffer: null,
        playing: new Set(),
        isLoading: true,
      };
    }

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => this.context.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        this.sounds[id] = {
          buffer: audioBuffer,
          playing: new Set(),
          isLoading: false,
        };
        console.log(`Sound loaded: ${id}`);
      })
      .catch((e) => {
        console.warn(`Error loading sound ${id}: ${e.message}`);

        // Create a synthesized sound as fallback instead of silent buffer
        this.createSynthesizedSound(id);
      });
  }

  // Create synthesized sounds based on sound type
  createSynthesizedSound(id) {
    if (!this.context) {
      console.warn(
        'Cannot create synthesized sound: audio context not initialized'
      );
      return;
    }

    console.log(`Creating synthesized fallback sound for: ${id}`);
    const ctx = this.context;
    const duration = 1; // Default duration
    const sampleRate = ctx.sampleRate;
    let buffer;

    switch (id) {
      case 'shoot':
        buffer = this.createSynthesizedShootSound();
        break;
      case 'explosion':
        buffer = this.createSynthesizedExplosionSound();
        break;
      case 'powerup':
        buffer = this.createSynthesizedPowerupSound();
        break;
      case 'engine':
        buffer = this.createSynthesizedEngineSound();
        break;
      case 'backgroundMusic':
        buffer = this.createSynthesizedBackgroundMusic();
        break;
      case 'playerDamage':
        buffer = this.createSynthesizedDamageSound();
        break;
      case 'menuSelect':
        buffer = this.createSynthesizedMenuSound();
        break;
      case 'healSound':
        buffer = this.createSynthesizedHealSound();
        break;
      case 'gameOver':
        buffer = this.createSynthesizedGameOverSound();
        break;
      default:
        // Create a generic beep sound for any unhandled sound types
        buffer = this.createGenericBeepSound();
        break;
    }

    this.sounds[id] = {
      buffer: buffer,
      playing: new Set(),
      isLoading: false,
      isSynthesized: true, // Flag that this is a synthesized fallback
    };
  }

  // Create generic beep sound
  createGenericBeepSound() {
    const duration = 0.3;
    const ctx = this.context;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      data[i] =
        0.5 * Math.sin(2 * Math.PI * 440 * t) * Math.max(0, 1 - t / duration);
    }

    return buffer;
  }

  // Create synthesized laser shoot sound
  createSynthesizedShootSound() {
    const duration = 0.3;
    const ctx = this.context;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 1000 - 800 * t; // Descending pitch
      data[i] =
        0.5 * Math.sin(2 * Math.PI * frequency * t) * (1 - t / duration);
    }

    return buffer;
  }

  // Create synthesized explosion sound
  createSynthesizedExplosionSound() {
    const duration = 0.8;
    const ctx = this.context;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const envelope =
        t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.1) / (duration - 0.1));
      data[i] =
        envelope * (0.5 * Math.random() + 0.5 * Math.sin(2 * Math.PI * 60 * t));
    }

    return buffer;
  }

  // Create synthesized powerup sound
  createSynthesizedPowerupSound() {
    const duration = 0.5;
    const ctx = this.context;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 440 + 660 * t; // Ascending pitch
      data[i] = 0.3 * Math.sin(2 * Math.PI * frequency * t);
    }

    return buffer;
  }

  // Create synthesized engine sound
  createSynthesizedEngineSound() {
    const duration = 2.0;
    const ctx = this.context;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      data[i] =
        0.2 * Math.sin(2 * Math.PI * 120 * t) +
        0.1 * Math.sin(2 * Math.PI * 240 * t) +
        0.05 * Math.sin(2 * Math.PI * 480 * t) +
        0.02 * Math.random(); // Add a bit of noise
    }

    return buffer;
  }

  // Create synthesized background music
  createSynthesizedBackgroundMusic() {
    const duration = 30; // 30 seconds of music that can loop
    const ctx = this.context;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // Use pentatonic scale for sci-fi feel
    const notes = [220, 261.63, 329.63, 392, 440];
    const baseFreq = notes[0];

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noteIndex = Math.floor(t * 0.25) % 16;
      const octave = Math.floor(noteIndex / 5);
      const note = notes[noteIndex % 5];
      const freq = note * (1 + octave * 0.5);

      // Create a drone bass
      const bass = 0.15 * Math.sin(2 * Math.PI * baseFreq * 0.5 * t);

      // Create a melody
      const melody =
        noteIndex % 8 < 7 ? 0.1 * Math.sin(2 * Math.PI * freq * t) : 0;

      // Add some atmosphere
      const atmosphere =
        0.05 * Math.sin(2 * Math.PI * baseFreq * 2 * t) * Math.sin(0.5 * t);

      data[i] = bass + melody + atmosphere;
    }

    return buffer;
  }

  // Create synthesized player damage sound
  createSynthesizedDamageSound() {
    const duration = 0.4;
    const ctx = this.context;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const noise = Math.random() * 0.4;
      const tone = 0.3 * Math.sin(2 * Math.PI * 120 * t);
      data[i] = (noise + tone) * Math.max(0, 1 - t / duration);
    }

    return buffer;
  }

  // Create synthesized menu select sound
  createSynthesizedMenuSound() {
    const duration = 0.2;
    const ctx = this.context;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 440 + t * 440;
      data[i] =
        0.3 * Math.sin(2 * Math.PI * frequency * t) * (1 - t / duration);
    }

    return buffer;
  }

  // Create synthesized heal sound
  createSynthesizedHealSound() {
    const duration = 0.6;
    const ctx = this.context;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency1 = 440 + t * 440;
      const frequency2 = 660 + t * 440;
      data[i] =
        (0.2 * Math.sin(2 * Math.PI * frequency1 * t) +
          0.2 * Math.sin(2 * Math.PI * frequency2 * t)) *
        Math.pow(1 - t / duration, 0.5);
    }

    return buffer;
  }

  // Create synthesized game over sound
  createSynthesizedGameOverSound() {
    const duration = 2.0;
    const ctx = this.context;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate;
      const frequency = 440 - t * 200;
      const slowPulse = Math.sin(2 * Math.PI * 2 * t);
      data[i] =
        0.4 *
        slowPulse *
        Math.sin(2 * Math.PI * frequency * t) *
        Math.pow(1 - t / duration, 0.5);
    }

    return buffer;
  }
  // Play a sound with various options
  playSound(id, options = {}) {
    if (!this.initialized || this.isMuted) {
      return null;
    }

    // Default options
    const defaults = {
      volume: 1.0,
      loop: false,
      pitch: 1.0,
      isMusic: false,
    };

    const settings = { ...defaults, ...options };

    // If sound doesn't exist at all, create a placeholder entry
    if (!this.sounds[id]) {
      this.sounds[id] = {
        buffer: null,
        playing: new Set(),
        isLoading: false,
      };
      console.warn(`Sound not loaded: ${id}, created placeholder`);
      return null;
    }

    // Sound exists but is still loading or has no buffer
    if (!this.sounds[id].buffer) {
      if (this.sounds[id].isLoading) {
        console.warn(`Sound ${id} is still loading, playback queued`);
      } else {
        console.warn(`Sound ${id} failed to load, can't play`);
      }
      return null;
    } // If this is a synthesized fallback sound and it's an effect (not music),
    // we can adjust the volume
    if (this.sounds[id].isSynthesized && !settings.isMusic) {
      settings.volume *= 0.7; // Adjust synthesized sounds volume
    }

    // Create source
    const source = this.context.createBufferSource();
    source.buffer = this.sounds[id].buffer;
    source.loop = settings.loop;
    source.playbackRate.value = settings.pitch;

    // Create gain node for individual volume control
    const gainNode = this.context.createGain();
    gainNode.gain.value = settings.volume;

    // Connect to appropriate output
    const output = settings.isMusic ? this.musicGain : this.effectsGain;
    source.connect(gainNode);
    gainNode.connect(output);

    // Keep track of playing instances
    if (!this.sounds[id].playing) {
      this.sounds[id].playing = new Set();
    }

    // Store source info
    const sourceInfo = {
      source,
      gainNode,
      startTime: this.context.currentTime,
      options: settings,
      fadeOut: (duration) => {
        const now = this.context.currentTime;
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);
        setTimeout(() => {
          try {
            source.stop();
          } catch (e) {
            // Already stopped
          }
          this.sounds[id].playing.delete(sourceInfo);
        }, duration * 1000);
      },
      stop: () => {
        try {
          source.stop();
        } catch (e) {
          // Already stopped
        }
        this.sounds[id].playing.delete(sourceInfo);
      },
    };

    // Track this source
    this.sounds[id].playing.add(sourceInfo);

    // Start playback
    source.start();

    // If this is music, store reference
    if (settings.isMusic) {
      this.music = sourceInfo;
    }

    // Cleanup when finished
    source.onended = () => {
      this.sounds[id].playing.delete(sourceInfo);
      if (settings.isMusic) {
        this.music = null;
      }
    };

    return sourceInfo;
  }

  // Stop all instances of a sound
  stopSound(id) {
    if (!this.initialized || !this.sounds[id] || !this.sounds[id].playing) {
      return;
    }

    this.sounds[id].playing.forEach((sourceInfo) => {
      try {
        sourceInfo.source.stop();
      } catch (e) {
        // Already stopped
      }
    });

    this.sounds[id].playing.clear();
  }

  // Stop all sounds
  stopAllSounds() {
    Object.keys(this.sounds).forEach((id) => {
      this.stopSound(id);
    });
  }

  // Mute all audio
  mute() {
    if (!this.initialized) return;
    this.masterGain.gain.value = 0;
    this.isMuted = true;
  }

  // Unmute audio
  unmute() {
    if (!this.initialized) return;
    this.masterGain.gain.value = 1;
    this.isMuted = false;
  }

  // Set music volume
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.initialized) {
      this.musicGain.gain.value = this.musicVolume;
    }
  }

  // Set effects volume
  setEffectsVolume(volume) {
    this.effectsVolume = Math.max(0, Math.min(1, volume));
    if (this.initialized) {
      this.effectsGain.gain.value = this.effectsVolume;
    }
  }
}
