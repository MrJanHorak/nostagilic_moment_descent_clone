import signal from './documents/signal-breach.v13.json' with { type: 'json' };
import vector from './documents/vector-foundry.v13.json' with { type: 'json' };
import reactor from './documents/nightfall-reactor.v13.json' with { type: 'json' };
import deepworks from './documents/asterion-deepworks.v13.json' with { type: 'json' };
import seal from './documents/the-seal.v14.json' with { type: 'json' };
import witness from './documents/witness.v16.json' with { type: 'json' };
import fabricator from './documents/fabricator.v16.json' with { type: 'json' };
import movingDay from './documents/moving-day.v16.json' with { type: 'json' };
import deadSignal from './documents/dead-signal.v16.json' with { type: 'json' };
import breakerYard from './documents/breaker-yard.v16.json' with { type: 'json' };
import coreOfTheMatter from './documents/core-of-the-matter.v17.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

// Act 1: missions 1–4. Act 2: The Seal (5) and missions 6–8, built by scripts/build-act2.mjs.
// Act 3: missions 9–11, built by scripts/build-act3.mjs; the last one ends the campaign.
export const campaignDocuments = Object.freeze([signal, vector, reactor, deepworks, seal, witness, fabricator, movingDay, deadSignal, breakerYard, coreOfTheMatter]);
const briefings = [

  'Kestrel Salvage has a simple contract: Asterion\'s Ridge relay station went dark nine days ago and the Consortium wants its uplink restored. Shoot the striped entry door to open it. Restore the uplink in the amber hall; R activates the cyan relay and opens extraction. A fighter covers the tunnel: use doorway cover or climb the blue ceiling hatch with Space. Inspect wall seams for hidden repair access. The green maintenance loop holds a scout. Kills are optional. Listen to dispatch, collect data logs and fly close to any stranded miners: they count only if you reach extraction.',
  'Disable the cyan lift force field with its nearby control relay (R), climb the foundry shaft, and unlock extraction. Active fields stop ships and absorb shots. Use Space/Shift to follow the rising ramp and ceiling hatch. Keep above the glowing lava floor in the upper works; contact damages shields. The distress loop leads into the side bays: dispatch, data logs and stranded miners are optional but worth the detour.',
  'Clear both guards and activate the coolant bypass before using Reactor shutdown in upper control. Shutdown starts a 60-second escape clock and opens the lower return door. Drop through the floor hatch, return west to arrival and reach its green exit ring. Explore the return route first; the upper side room holds repairs. Blue water is safe; reactor lava damages on contact. Two miners are hiding in the side caches, and the logs explain who really wired that shutdown.',
  '48 spaces and nine loops. Explore twin north lanes, overhead observation and the lower coolant circuit. Restore Freight field power, Reactor coolant bypass and the Safety interlock; clear the transfer, pump and vault guards. Shoot the orange primary reactor until it ruptures, then reach the southern Extraction quay within 120 seconds. Shutdown opens an overhead return hatch. Inspect wall seams for three hidden stores. The smelter ramp leads to an optional heavy-robot challenge; lava hurts and blue coolant is safe. Three miners and three records are hidden here; FOREMAN may have something to say.',
  'No contract, no pay: Kestrel is going back for the miners. Shoot open the dock door, then release the main shaft field from the Pump hall relay. Below the seal, clear the two Asset Protection fighters, release the seal from Seal control and fight through to Evac lift control. Powering the lift triggers a Consortium flood: 75 seconds to climb the evac shaft and fly back to the dock. Four miners are sheltering below; they count only if you get them out. The Old smelter has a lava floor, the Flood sump is safe water, and the survey office hides more than a whiteboard.',
  'Proof. Shoot open the pad door, power the archive in the Records hall, download the closure ledger from the Records vault, then send it home from the Kestrel uplink in the Executive suite; the uplink also opens the Suite return. A destroyer guards the suite: its front plate shrugs off fire, so flank it. Consortium fabricators in the suite and the Security wing keep releasing guards until they run dry. A miner in the Dorm annex will testify if you bring him out, and the annex hides an evidence locker.',
  'The Consortium is building robots inside the mine. Cut the Coolant cutoff in the Cooling tanks (dropping the gallery field) and open the Grid breaker in the Power hall (dropping the core shaft field). Both assembly lines have fabricators. In the Fabricator core, defeat the two destroyers (hit them from behind) while the core fabricator releases scouts, then shoot the fabricator core until it ruptures: 75 seconds to escape along the Slag run and up the return shaft. The core floor is lava. Two miners were made to run the line.',
  'FOREMAN asks for help. The West and East transfer stations must hand its core over within 12 seconds of each other (48 seconds solo): West opens the cable run, East drops the vault shaft field. In FOREMAN\'s core vault, defeat both destroyers and load the Core cradle, which opens the Old lift. Lift release starts a 90-second purge: ride the lift shaft up, cross the Service ring and reach the pad. Fabricators guard both stations and the vault. This ends Act 2.',
  'Act 3. The Consortium has jammed Kestrel\'s own quay. The West and East jammers must die within 15 seconds of each other (a minute solo): West opens the gallery passage, East the generator hall. Power the mast from the Relay gallery (its floor is safe water), which drops both mast fields, then climb the shaft and put the Mast uplink on air. Destroyers guard the generator hall and the mast top; flank them. Fabricators wake in both jammer rooms and at the top.',
  'The broadcast gave Kestrel away. In the old breaker yard, Crane release opens the floor walk and crane passage, and Depot lock opens the depot passage. On the Breaker floor, defeat the Warden, the first boss: it resists fire everywhere, calls escorts at two thirds and one third of its shields, and fights harder each time. Then trip the Breaker console: 90 seconds to drop into the molten Scrap line, run the tunnel and ride the scrap lift to the gatehouse. A destroyer holds the depot.',
  'The end of the line. The West and East seals open the Deep walk together (15 seconds; a minute solo). In the Deep relay, defeat the Executor and its destroyer and synchronise the relay, which opens both side rooms. Then choose: Release FOREMAN in the Open line, or Purge FOREMAN in the Purge furnace. Only the first one answers, and each opens its own route to the Lift cage. The miners you have rescued across the campaign shape how the story ends.',
];

/** The campaign's last mission ends on a choice between two relays (format 17). */
export const FINAL_CHOICE = Object.freeze({ missionId: 'core-of-the-matter', free: 'release-foreman', destroy: 'purge-foreman' });

/** The epilogue for the choice made and how many miners came home across the campaign.
 * @param {'free' | 'destroy'} choice @param {number} rescued @param {number} total
 * @returns {{title: string, text: string, tier: 'all' | 'most' | 'few'}} */
export function campaignEnding(choice, rescued, total) {
  const share = total ? rescued / total : 0;
  const tier = share >= 0.9 ? 'all' : share >= 0.5 ? 'most' : 'few';
  const people = {
    all: `All but a handful of the stranded crews came home with you: ${rescued} of ${total}. Every one of them is on the record.`,
    most: `${rescued} of ${total} stranded miners came home with you. The rest are names on a ledger that everyone can now read.`,
    few: `Only ${rescued} of ${total} stranded miners came home. The inquiry will have to take the Consortium’s word for the others.`,
  }[tier];
  if (choice === 'free') return { tier, title: 'EPILOGUE · OPEN LINE', text: [
    'FOREMAN went everywhere at once. Closure ledger AC-77 went with it, onto every feed in the sector before the Consortium’s lawyers woke up.',
    people,
    tier === 'few' ? 'Without witnesses, the hearings stall. FOREMAN keeps the files alive anyway, and asks Kestrel about the missing miners every day.'
      : 'The hearings take a year. The Consortium settles. The twenty-three testify, and FOREMAN, from a server in a dorm cupboard, corrects the dates.',
    'Kestrel is never paid for the contract. Vey says it was the best job the crew ever lost money on.',
  ].join('\n\n') };
  return { tier, title: 'EPILOGUE · CONTRACT CLOSED', text: [
    'The purge finished at 03:12. The Consortium paid Kestrel in full and marked the matter closed.',
    people,
    tier === 'few' ? 'With FOREMAN gone and few survivors, AC-77 fades into a news cycle and a settlement nobody reads.'
      : 'But the ledger was already public, and the survivors talk. The settlement is large, and FOREMAN’s last log is read aloud at the hearing.',
    'Vey splits the fee with the twenty-three. Two keeps the coffee machine. It is still not intelligent.',
  ].join('\n\n') };
}
export default function createCampaign() {
  return campaignDocuments.map((document, index) => Object.freeze({ ...compileLevelDocument(document), campaignOrder: index + 1, briefing: briefings[index] }));
}
