// Audio management system for the game
class AudioManager {
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

    // Create separate gain nodes for effects and music
    this.effectsGain = this.context.createGain();
    this.effectsGain.gain.value = this.effectsVolume;
    this.effectsGain.connect(this.masterGain);

    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = this.musicVolume;
    this.musicGain.connect(this.masterGain);

    this.initialized = true;

    console.log('Audio system initialized');
  }

  async loadSound(key, url) {
    if (!this.initialized) this.init();

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

      this.sounds[key] = audioBuffer;
      console.log(`Sound loaded: ${key}`);
    } catch (error) {
      console.error(`Error loading sound ${key}: ${error.message}`);
    }
  }

  playSound(key, options = {}) {
    if (!this.initialized || this.isMuted || !this.sounds[key]) return null;

    try {
      // Create source
      const source = this.context.createBufferSource();
      source.buffer = this.sounds[key];

      // Create gain for this specific sound
      const gainNode = this.context.createGain();
      gainNode.gain.value = options.volume !== undefined ? options.volume : 1;

      // Connect source to gain, then to either music or effects gain
      source.connect(gainNode);
      gainNode.connect(options.isMusic ? this.musicGain : this.effectsGain);

      // Configure looping
      if (options.loop) {
        source.loop = true;
      }

      // Start playback with optional delay
      const startTime = options.delay
        ? this.context.currentTime + options.delay
        : this.context.currentTime;
      source.start(startTime);

      // Keep track of music for special handling
      if (options.isMusic) {
        if (this.music) {
          this.music.stop();
        }
        this.music = source;
      }

      // Add stop method for convenience
      const originalStop = source.stop.bind(source);
      source.stop = (when = 0) => {
        try {
          originalStop(when);
        } catch (e) {
          // Handle already stopped source
        }
      };

      // For fade-out capability
      source.fadeOut = (duration = 1) => {
        const now = this.context.currentTime;
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(0, now + duration);

        // Auto-stop after fade
        setTimeout(() => source.stop(), duration * 1000);
      };

      return source;
    } catch (error) {
      console.error(`Error playing sound ${key}: ${error.message}`);
      return null;
    }
  }

  stopAllSounds() {
    if (this.music) {
      this.music.stop();
      this.music = null;
    }
  }

  setMasterVolume(value) {
    if (!this.initialized) return;
    this.masterGain.gain.value = value;
  }

  setEffectsVolume(value) {
    if (!this.initialized) return;
    this.effectsVolume = value;
    this.effectsGain.gain.value = value;
  }

  setMusicVolume(value) {
    if (!this.initialized) return;
    this.musicVolume = value;
    this.musicGain.gain.value = value;
  }

  mute() {
    if (!this.initialized) return;
    this.isMuted = true;
    this.masterGain.gain.value = 0;
  }

  unmute() {
    if (!this.initialized) return;
    this.isMuted = false;
    this.masterGain.gain.value = 1;
  }
}

export const audioManager = new AudioManager();
