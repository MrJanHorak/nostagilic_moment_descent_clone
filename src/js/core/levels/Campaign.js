import signal from './documents/signal-breach.v8.json' with { type: 'json' };
import vector from './documents/vector-foundry.v7.json' with { type: 'json' };
import reactor from './documents/nightfall-reactor.v7.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

export const campaignDocuments = Object.freeze([signal, vector, reactor]);
const briefings = [
  'Shoot the striped entry door to open it. Restore the uplink in the amber hall; R activates the cyan relay and opens extraction. A fighter covers the tunnel: use doorway cover or climb the blue ceiling hatch with Space. Inspect wall seams for hidden repair access. The green maintenance loop holds a scout. Kills are optional.',
  'Power the lift, climb the foundry shaft, and unlock extraction. Use Space/Shift to follow the rising ramp and ceiling hatch.',
  'Clear the two guards, bypass coolant and shut down the reactor. The lower loop returns to the lift; extraction is above.',
];
export default function createCampaign() {
  return campaignDocuments.map((document, index) => Object.freeze({ ...compileLevelDocument(document), campaignOrder: index + 1, briefing: briefings[index] }));
}
