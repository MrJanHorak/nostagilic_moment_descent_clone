import document from './documents/fighter-proving-ground.v7.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

export default function createFighterDrill() {
  return Object.freeze({ ...compileLevelDocument(document),
    briefing: 'Two fighters, four connected spaces and a flank route. Track their sideways and vertical movement; amber means charging, blue marks recovery. Use walls for cover and change height. Clear both guards, then return to the green exit in the blue sparring room. Five pulse hits defeat a fighter here; ammunition and repairs are in the eastern loop.',
  });
}
