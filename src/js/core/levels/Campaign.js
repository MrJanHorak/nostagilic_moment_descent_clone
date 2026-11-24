import signal from './documents/signal-breach.v13.json' with { type: 'json' };
import vector from './documents/vector-foundry.v13.json' with { type: 'json' };
import reactor from './documents/nightfall-reactor.v13.json' with { type: 'json' };
import deepworks from './documents/asterion-deepworks.v13.json' with { type: 'json' };
import seal from './documents/the-seal.v14.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

export const campaignDocuments = Object.freeze([signal, vector, reactor, deepworks, seal]);
const briefings = [

  'Kestrel Salvage has a simple contract: Asterion\'s Ridge relay station went dark nine days ago and the Consortium wants its uplink restored. Shoot the striped entry door to open it. Restore the uplink in the amber hall; R activates the cyan relay and opens extraction. A fighter covers the tunnel: use doorway cover or climb the blue ceiling hatch with Space. Inspect wall seams for hidden repair access. The green maintenance loop holds a scout. Kills are optional. Listen to dispatch, collect data logs and fly close to any stranded miners: they count only if you reach extraction.',
  'Disable the cyan lift force field with its nearby control relay (R), climb the foundry shaft, and unlock extraction. Active fields stop ships and absorb shots. Use Space/Shift to follow the rising ramp and ceiling hatch. Keep above the glowing lava floor in the upper works; contact damages shields. The distress loop leads into the side bays: dispatch, data logs and stranded miners are optional but worth the detour.',
  'Clear both guards and activate the coolant bypass before using Reactor shutdown in upper control. Shutdown starts a 60-second escape clock and opens the lower return door. Drop through the floor hatch, return west to arrival and reach its green exit ring. Explore the return route first; the upper side room holds repairs. Blue water is safe; reactor lava damages on contact. Two miners are hiding in the side caches, and the logs explain who really wired that shutdown.',
  '48 spaces and nine loops. Explore twin north lanes, overhead observation and the lower coolant circuit. Restore Freight field power, Reactor coolant bypass and the Safety interlock; clear the transfer, pump and vault guards. Shoot the orange primary reactor until it ruptures, then reach the southern Extraction quay within 120 seconds. Shutdown opens an overhead return hatch. Inspect wall seams for three hidden stores. The smelter ramp leads to an optional heavy-robot challenge; lava hurts and blue coolant is safe. Three miners and three records are hidden here; FOREMAN may have something to say.',
  'No contract, no pay: Kestrel is going back for the miners. Shoot open the dock door, then release the main shaft field from the Pump hall relay. Below the seal, clear the two Asset Protection fighters, release the seal from Seal control and fight through to Evac lift control. Powering the lift triggers a Consortium flood: 75 seconds to climb the evac shaft and fly back to the dock. Four miners are sheltering below; they count only if you get them out. The Old smelter has a lava floor, the Flood sump is safe water, and the survey office hides more than a whiteboard.',
];
export default function createCampaign() {
  return campaignDocuments.map((document, index) => Object.freeze({ ...compileLevelDocument(document), campaignOrder: index + 1, briefing: briefings[index] }));
}
