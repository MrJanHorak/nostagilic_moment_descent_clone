import document from './documents/bomber-drill.v7.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

export default function createBomberDrill() {
  return Object.freeze({ ...compileLevelDocument(document),
    briefing: 'Two bombers hold the far side of each room. Their pods glow amber and pulse faster while charging; then they lob a slow bomb at where you are. It lands, shows an orange blast sphere and detonates about a second later. Leave the sphere or put a wall between you and the bomb. Close in during the blue recovery window. Twelve pulse hits defeat a bomber here; each drops missile salvage (3 to select). Ammunition and repairs are in the eastern loop; return to the green exit in the blue sparring room.',
  });
}
