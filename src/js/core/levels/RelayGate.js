import document from './documents/relay-gate.v2.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

export default function createRelayGateLevel() { return compileLevelDocument(document); }
