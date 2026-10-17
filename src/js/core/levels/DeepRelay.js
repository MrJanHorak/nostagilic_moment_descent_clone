import document from './documents/deep-relay.v2.json' with { type: 'json' };
import compileLevelDocument from './document/compileLevelDocument.js';

export default function createDeepRelayLevel() { return compileLevelDocument(document); }
