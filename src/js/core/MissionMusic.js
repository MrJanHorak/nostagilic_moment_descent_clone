/** Original, deterministic 16-bar downtempo score. Notes/tails wrap into the
 * next loop rather than cutting off at the buffer boundary. Generated once per
 * audio context and played through the existing music/pause/mute mixer.
 * @param {Pick<AudioContext, 'sampleRate' | 'createBuffer'>} context */
export default function createMissionMusic(context) {
  const beat = 60 / 96, duration = 64 * beat, rate = context.sampleRate;
  const buffer = context.createBuffer(2, Math.round(duration * rate), rate);
  const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
  let seed = 19473;
  const noise = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1; };
  /** @param {number} start @param {number} length @param {number} gain @param {number} pan @param {(time: number) => number} wave */
  const voice = (start, length, gain, pan, wave) => {
    const first = Math.round(start * rate), count = Math.floor(length * rate);
    for (let i = 0; i < count; i++) {
      const t = i / rate, envelope = Math.min(1, t / 0.012) * Math.pow(Math.max(0, 1 - t / length), 2);
      const sample = wave(t) * envelope * gain, index = (first + i) % left.length;
      left[index] += sample * Math.sqrt((1 - pan) / 2); right[index] += sample * Math.sqrt((1 + pan) / 2);
    }
  };
  /** @param {number} midi */ const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  const chords = [[50, 57, 65], [46, 53, 62], [53, 60, 69], [48, 55, 64]];
  const motif = [0, 2, 1, 2, 0, 1, 2, 1];
  for (let bar = 0; bar < 16; bar++) {
    const chord = chords[bar % 4], time = bar * 4 * beat;
    for (const [index, note] of chord.entries()) {
      const hz = frequency(note);
      voice(time, beat * 6, 0.1, (index - 1) * 0.6, t => Math.sin(Math.PI / 2 * Math.min(1, t / (beat * 0.75))) * (Math.sin(2 * Math.PI * hz * t) + 0.3 * Math.sin(2 * Math.PI * hz * 1.003 * t)));
    }
    for (let step = 0; step < 8; step++) {
      const at = time + step * beat / 2, hz = frequency(chord[0] - 12 + (step === 6 ? 7 : 0));
      voice(at, beat * 0.65, 0.22, 0, t => Math.sin(2 * Math.PI * hz * t) + 0.18 * Math.sin(4 * Math.PI * hz * t));
      if (bar % 8 >= 2) {
        voice(at + beat / 4, 0.06, step % 2 ? 0.045 : 0.025, 0.4, t => noise() * Math.exp(-t * 60));
      }
      if (bar % 8 >= 4 && step % 2 === 0) {
        const lead = frequency(chord[motif[(step + bar) % motif.length]] + 12);
        const wave = (/** @type {number} */ t) => Math.sin(2 * Math.PI * lead * t) * Math.exp(-t * 7);
        voice(at, beat * 1.5, 0.085, -0.35, wave);
        voice(at + beat * 0.75, beat * 1.5, 0.035, 0.55, wave);
      }
    }
    for (let pulse = 0; pulse < 4; pulse++) {
      voice(time + pulse * beat, 0.24, pulse % 2 ? 0.1 : 0.3, 0, t => Math.sin(2 * Math.PI * (44 * t + 5 * (1 - Math.exp(-t * 24)))) * Math.exp(-t * 16));
      if (pulse % 2 && bar % 8 >= 2) voice(time + pulse * beat, 0.14, 0.07, -0.2, t => (noise() + Math.sin(2 * Math.PI * 180 * t) * 0.3) * Math.exp(-t * 24));
    }
  }
  for (let i = 0; i < left.length; i++) { left[i] = Math.tanh(left[i] * 1.3) * 0.7; right[i] = Math.tanh(right[i] * 1.3) * 0.7; }
  return buffer;
}
