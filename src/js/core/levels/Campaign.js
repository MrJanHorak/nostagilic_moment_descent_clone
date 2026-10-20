import signal from './documents/signal-breach.v7.json' with { type: 'json' };
import vector from './documents/vector-foundry.v7.json' with { type: 'json' };
import reactor from './documents/nightfall-reactor.v7.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

export const campaignDocuments = Object.freeze([signal, vector, reactor]);
const briefings = [
  'Restore the uplink in the amber hall. A fighter covers the direct tunnel: retreat behind the arrival doorway, or use Space to climb the blue ceiling hatch and approach from above. The green loop holds repairs and a scout. Kills are optional.',
  'Power the lift, climb the foundry shaft, and unlock extraction. Use Space/Shift to follow the rising ramp and ceiling hatch.',
  'Clear the two guards, bypass coolant and shut down the reactor. The lower loop returns to the lift; extraction is above.',
];
export default function createCampaign() {
  return campaignDocuments.map((document, index) => Object.freeze({ ...compileLevelDocument(document), campaignOrder: index + 1, briefing: briefings[index] }));
}
