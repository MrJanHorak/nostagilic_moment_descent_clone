import twinValves from './documents/team-twin-valves.v15.json' with { type: 'json' };
import deepFreight from './documents/team-deep-freight.v15.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

/** Missions designed for a team (Phase 4): linked relays split the pilots up.
 * Built by scripts/build-team-missions.mjs. Solo pilots may fly them too: linked
 * windows are four times longer alone. */
export const teamDocuments = Object.freeze([twinValves, deepFreight]);
const briefings = [
  'Team mission for 2–4 pilots. The pump station\'s pressure core opens only when the West and East valves turn within 10 seconds of each other, so split up: one pilot per wing. The valves open both core lines. Defeat the destroyer guarding the core, pull Pressure release and get back to the drop through the return line within 60 seconds. Flying solo? You get 40 seconds to reach the second valve; take the long way round through the drop.',
  'Team mission for 2–4 pilots. Close the deep freight line Asset Protection came in on. The North and South cranes lower the freight shaft only when activated within 12 seconds of each other. In the cargo hold, the West and East rail switches must turn within 8 seconds to open the freight lock; the switch room floor is slag. Clear the hold fighters and the line destroyer, pull Line release and take the maintenance lift up to the north crane, then the dock, within 90 seconds. Solo windows are four times longer.',
];
export default function createTeamMissions() {
  return teamDocuments.map((document, index) => Object.freeze({ ...compileLevelDocument(document), team: true, briefing: briefings[index] }));
}
