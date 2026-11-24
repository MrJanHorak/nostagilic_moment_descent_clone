/** Incoming radio: a short static click, then two bright tones ("ba-dip"). Original,
 * deterministic and bounded; the effects mixer owns volume, mute and pause.
 * @param {Pick<AudioContext, 'sampleRate' | 'createBuffer'>} context */
export function createCommsSound(context) {
  const duration = 0.32, buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 12345;
  const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
  for (let i = 0; i < data.length; i++) {
    const t = i / context.sampleRate;
    let sample = 0;
    if (t < 0.03) sample += 0.18 * noise() * (1 - t / 0.03);
    for (const [start, frequency] of [[0.05, 880], [0.16, 1320]]) {
      const local = t - start;
      if (local >= 0 && local < 0.11) sample += 0.22 * Math.sin(Math.PI * local / 0.11) ** 2 * Math.sin(2 * Math.PI * frequency * local);
    }
    data[i] = Math.max(-1, Math.min(1, sample));
  }
  return buffer;
}

/** Data log recovered: a soft rising three-note chime.
 * @param {Pick<AudioContext, 'sampleRate' | 'createBuffer'>} context */
export function createLogSound(context) {
  const duration = 0.5, buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / context.sampleRate;
    let sample = 0;
    for (const [start, frequency] of [[0, 660], [0.12, 880], [0.24, 1175]]) {
      const local = t - start;
      if (local >= 0 && local < 0.26) sample += 0.16 * Math.exp(-local * 9) * Math.sin(Math.PI * Math.min(1, local / 0.01) / 2) * Math.sin(2 * Math.PI * frequency * local);
    }
    // Fade the last 60 ms so the final note never ends with a click.
    const fade = Math.min(1, (duration - t) / 0.06);
    data[i] = Math.max(-1, Math.min(1, sample * fade));
  }
  return buffer;
}
