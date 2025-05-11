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

        // Create a silent buffer as fallback
        if (this.context) {
          try {
            // Create a 1 second empty/silent buffer
            const sampleRate = this.context.sampleRate;
            const emptyBuffer = this.context.createBuffer(
              2,
              sampleRate,
              sampleRate
            );

            // Set the sound with this empty buffer so playback won't fail
            this.sounds[id] = {
              buffer: emptyBuffer,
              playing: new Set(),
              isLoading: false,
              isSilent: true, // Flag to know this is a silent fallback
            };

            console.log(`Created silent fallback for sound: ${id}`);
          } catch (fallbackError) {
            console.error(
              `Failed to create fallback sound for ${id}:`,
              fallbackError
            );
          }
        }
      });
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
    }

    // If this is a silent fallback sound and it's an effect (not music),
    // we can lower the volume to avoid confusion
    if (this.sounds[id].isSilent && !settings.isMusic) {
      settings.volume *= 0.1; // Make fallback sounds quieter
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
