/** Two short rising chirps, with smooth ends and a silent gap. The ordinary
 * effects mixer owns mute/pause/volume and source cleanup.
 * @param {Pick<AudioContext, 'sampleRate' | 'createBuffer'>} context */
export default function createAttackWarningSound(context) {
  const duration = 0.24, buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / context.sampleRate, second = t >= 0.14, local = second ? t - 0.14 : t;
    if (local >= 0.1) continue;
    const envelope = Math.sin(Math.PI * local / 0.1) ** 2;
    const phase = 2 * Math.PI * ((second ? 650 : 400) * local + 1100 * local * local);
    data[i] = 0.3 * envelope * (Math.sin(phase) + 0.2 * Math.sin(phase * 2));
  }
  return buffer;
}
