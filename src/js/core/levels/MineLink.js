import document from './documents/mine-link.v1.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

export default function createMineLinkLevel() { return compileLevelDocument(document); }
