// Early-mission balance pass (Nov 25): Act 1's first three missions had 1–2 robots
// each. This adds a few more, with ammo to match, and keeps the onboarding order
// (scouts first, then one fighter at a time). Safe to re-run: it only adds missing ids.
// Run: node scripts/rebalance-act1.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { validateLevelDocument } from '../src/js/core/levels/document/validateLevelDocument.js';

const additions = {
  'signal-breach.v13.json': [
    // A second maintenance scout makes the optional loop a real fight. (The supply bay
    // can see the arrival, which must stay safe.)
    { id: 'maintenance-scout-2', kind: 'enemy', type: 'scout', roomId: 'maintenance', position: [5, 2, 5] },
    // Extraction is no longer a free walk: one scout waits behind the signal door.
    { id: 'extraction-scout', kind: 'enemy', type: 'scout', roomId: 'extraction', position: [-5, 0, 3] },
    { id: 'hall-ammo', kind: 'pickup', type: 'pulseAmmo', roomId: 'signal-hall', position: [7, 0, -6] },
  ],
  'vector-foundry.v13.json': [
    { id: 'works-scout-upper', kind: 'enemy', type: 'scout', roomId: 'upper-works', position: [5, 0, -5] },
    // The first fighter of the campaign that is not in a doorway: it guards the lift control.
    { id: 'control-fighter', kind: 'enemy', type: 'fighter', roomId: 'lift-control', position: [0, 3, -6] },
    { id: 'works-ammo', kind: 'pickup', type: 'pulseAmmo', roomId: 'upper-works', position: [-6, 0, 5] },
  ],
  'nightfall-reactor.v13.json': [
    { id: 'junction-fighter', kind: 'enemy', type: 'fighter', roomId: 'lift-junction', position: [-6, 2, 6] },
    // Upper control gets a scout so the shutdown is earned; it also chases the escape.
    { id: 'control-scout', kind: 'enemy', type: 'scout', roomId: 'upper-control', position: [6, 0, -6] },
    { id: 'junction-ammo', kind: 'pickup', type: 'pulseAmmo', roomId: 'lift-junction', position: [6, 0, -6] },
  ],
};

for (const [file, entities] of Object.entries(additions)) {
  const url = new URL(`../src/js/core/levels/documents/${file}`, import.meta.url);
  const document = JSON.parse(readFileSync(url, 'utf8'));
  let added = 0;
  for (const entity of entities) if (!document.entities.some(existing => existing.id === entity.id)) {
    // Keep the exit last, as authored.
    const exitIndex = document.entities.findIndex(existing => existing.kind === 'exit');
    document.entities.splice(exitIndex === -1 ? document.entities.length : exitIndex, 0, entity); added++;
  }
  const result = validateLevelDocument(document);
  if (!result.valid) throw new Error(`${file}:\n${result.errors.map(error => `${error.path}: ${error.message}`).join('\n')}`);
  writeFileSync(url, JSON.stringify(document, null, 2) + '\n');
  console.log(`${file}: +${added}, ${document.entities.filter(entity => entity.kind === 'enemy').length} robots`);
}
