import signal from './documents/signal-breach.v8.json' with { type: 'json' };
import vector from './documents/vector-foundry.v11.json' with { type: 'json' };
import reactor from './documents/nightfall-reactor.v10.json' with { type: 'json' };
import deepworks from './documents/asterion-deepworks.v12.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

export const campaignDocuments = Object.freeze([signal, vector, reactor, deepworks]);
const briefings = [

  'Shoot the striped entry door to open it. Restore the uplink in the amber hall; R activates the cyan relay and opens extraction. A fighter covers the tunnel: use doorway cover or climb the blue ceiling hatch with Space. Inspect wall seams for hidden repair access. The green maintenance loop holds a scout. Kills are optional.',
  'Disable the cyan lift force field with its nearby control relay (R), climb the foundry shaft, and unlock extraction. Active fields stop ships and absorb shots. Use Space/Shift to follow the rising ramp and ceiling hatch. Keep above the glowing lava floor in the upper works; contact damages shields.',
  'Clear both guards and activate the coolant bypass before using Reactor shutdown in upper control. Shutdown starts a 60-second escape clock and opens the lower return door. Drop through the floor hatch, return west to arrival and reach its green exit ring. Explore the return route first; the upper side room holds repairs. Blue water is safe; reactor lava damages on contact.',
  '48 spaces and nine loops. Explore twin north lanes, overhead observation and the lower coolant circuit. Restore Freight field power, Reactor coolant bypass and the Safety interlock; clear the transfer, pump and vault guards. Shoot the orange primary reactor until it ruptures, then reach the southern Extraction quay within 120 seconds. Shutdown opens an overhead return hatch. Inspect wall seams for three hidden stores. The smelter ramp leads to an optional heavy-robot challenge; lava hurts and blue coolant is safe.',
];
export default function createCampaign() {
  return campaignDocuments.map((document, index) => Object.freeze({ ...compileLevelDocument(document), campaignOrder: index + 1, briefing: briefings[index] }));
}
