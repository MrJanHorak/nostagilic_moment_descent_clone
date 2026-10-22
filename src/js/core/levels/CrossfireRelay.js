import document from './documents/crossfire-relay.v7.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

export default function createCrossfireRelay() {
  return Object.freeze({ ...compileLevelDocument(document),
    briefing: 'A fighter watches the amber hall while a scout approaches from the green side passage. Use the arrival doorway for cover, or climb the blue ceiling hatch with Space to approach from above. Amber warns of an attack; sidestep the scout, then answer during recovery. Clear both guards and activate Return shortcut with R in the hall. The green loop holds optional repairs and ammunition and now leads back to the blue arrival exit. Forty pulse rounds; eight hits defeat the fighter and four defeat the scout. Fly into the fighter\'s cyan salvage to acquire a piercing laser; press 2 to select it, 1 for pulse.',
  });
}
