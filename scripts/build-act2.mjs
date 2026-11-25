// Act 2 missions 06–08 (Phase 5 step 2): reproducible authoring script. The runtime
// loads the validated JSON snapshots it writes. Run: node scripts/build-act2.mjs
import { kit, write, say, V, F, HAZARD, WATER, LAVA } from './lib/missionKit.mjs';

const combat = { pulseDamage: 10, initialPulseAmmo: 120, maxPulseAmmo: 250 };

// ── Mission 06 · Witness ────────────────────────────────────────────────
// Kestrel needs proof. The admin block holds the closure ledger; a miner in the
// dorm annex will testify. Asset Protection's fabricators guard the executive suite.
{
  const k = kit(), P = 'wi';
  const pad = k.room('kestrel-pad', 'Kestrel pad', [0, 0, 0], [28, 14, 28], 'industrial-blue', { negativeZ: HAZARD });
  const reception = k.room('reception', 'Reception', [0, 0, -50], [24, 12, 24]);
  const records = k.room('records-hall', 'Records hall', [-50, 0, -50], [28, 14, 24], 'industrial-green');
  const security = k.room('security-wing', 'Security wing', [50, 0, -50], [24, 14, 24], 'industrial-red', { negativeZ: HAZARD });
  const vault = k.room('records-vault', 'Records vault', [-50, 0, -96], [16, 12, 16], 'industrial-green');
  const suite = k.room('executive-suite', 'Executive suite', [0, 0, -96], [26, 14, 26], 'industrial-red');
  const annex = k.room('dorm-annex', 'Dorm annex', [50, 0, -96], [20, 12, 20]);
  const locker = k.room('evidence-locker', 'Evidence locker', [50, 0, -132], [12, 10, 12], 'industrial-green');
  k.bridge('pad-walk', 'Pad walk', pad, reception, 2);
  k.bridge('records-walk', 'Records walk', reception, records, 0);
  k.bridge('security-walk', 'Security walk', reception, security, 0, 'industrial-red');
  k.bridge('vault-stair', 'Vault corridor', records, vault, 2, 'industrial-green');
  k.bridge('vault-suite', 'Vault passage', vault, suite, 0, 'industrial-red');
  k.bridge('suite-annex', 'Annex passage', suite, annex, 0);
  k.bridge('annex-security', 'Annex stair', annex, security, 2, 'industrial-red');
  k.bridge('suite-return', 'Suite return', suite, reception, 2, 'industrial-red');
  k.bridge('locker-crawl', 'Locker crawl', annex, locker, 2, 'industrial-green');

  k.relay('archive-power', 'Archive power', records.id, [-8, 0, -6]);
  k.relay('ledger-download', 'Ledger download', vault.id, [0, 0, -4]);
  k.relay('uplink', 'Kestrel uplink', suite.id, [0, 0, -9]);
  k.door('pad-door', 'pad-walk-in', '@shot');
  k.door('vault-door', 'vault-stair-in', 'archive-power');
  k.door('suite-door', 'vault-suite-out', 'ledger-download');
  k.door('return-field', 'suite-return-in', 'uplink', { kind: 'force-field' });
  k.door('locker-secret', 'locker-crawl-in', '@shot', { concealed: true });

  k.enemy('reception-scout', 'scout', reception.id, [6, 0, -6]);
  k.enemy('records-fighter', 'fighter', records.id, [8, 1, 6]);
  k.enemy('security-bomber', 'bomber', security.id, [-6, 2, -6]);
  k.enemy('suite-destroyer', 'destroyer', suite.id, [5, 0, 4]);
  k.enemy('annex-scout', 'scout', annex.id, [-6, 0, 6]);
  k.generator('suite-fabricator', suite.id, [-9, 0, -9], 'scout', 4, 8, 2);
  k.generator('security-fabricator', security.id, [8, 0, 8], 'fighter', 3, 9, 1);

  k.pickup('pad-ammo', 'pulseAmmo', pad.id, [-8, 0, 8]); k.pickup('pad-repair', 'health', pad.id, [8, 0, 8]);
  k.pickup('records-ammo', 'pulseAmmo', records.id, [10, 0, -6]); k.pickup('vault-repair', 'health', vault.id, [-4, 0, 4]);
  k.pickup('suite-ammo', 'pulseAmmo', suite.id, [-9, 0, 9]); k.pickup('annex-repair', 'health', annex.id, [6, 0, -6]);
  k.pickup('locker-ammo', 'pulseAmmo', locker.id, [-3, 0, 0]); k.pickup('locker-repair', 'health', locker.id, [3, 0, 0]);
  k.entities.push({ id: 'pad-exit', kind: 'exit', roomId: pad.id, position: [0, 0, 10], radius: 2 });

  const story = {
    messages: [
      say(P, 'msg-start', V, "Twenty-three people say the Consortium left them to die. Nobody off-world will believe a salvage crew. We need their own ledger. Admin block, records vault, then send it home through the executive uplink.", { on: 'start' }),
      say(P, 'msg-records', F, "THE ARCHIVE IS SEALED BY CONSORTIUM ORDER. I DID NOT SEAL IT. I CAN STILL POWER IT.", { on: 'enter', roomId: records.id }),
      say(P, 'msg-ledger', V, "That's it. Closure costings, line by line. 'Personnel: not recovered.' Get it to the uplink.", { on: 'device', deviceId: 'ledger-download' }),
      say(P, 'msg-suite', F, "THOSE MACHINES IN THE WALLS ARE NOT MINE. THE CONSORTIUM INSTALLED FABRICATORS. THEY WILL KEEP MAKING GUARDS UNTIL THEY RUN OUT.", { on: 'enter', roomId: suite.id }),
      say(P, 'msg-uplink', V, "Uplink's live. The ledger is on Kestrel's servers and three news feeds. Whatever happens now, they can't bury it. Come home.", { on: 'device', deviceId: 'uplink' }),
      say(P, 'msg-annex', V, "Someone's in the annex. Hana says her brother stayed behind to watch the dorms. He'll talk to us if we get him out.", { on: 'enter', roomId: annex.id }),
      say(P, 'msg-security', F, "SECURITY WING. ANOTHER FABRICATOR. YOU DO NOT NEED TO GO IN THERE. I KNOW YOU WILL ANYWAY.", { on: 'enter', roomId: security.id }),
    ],
    logs: [
      { id: `${P}:log-ledger`, roomId: vault.id, position: [-4, 0, -4], title: 'Closure ledger AC-77 (extract)',
        text: "Lower works closure. Equipment recovery: 2.1M. Reservoir release: 0.4M. Personnel: not recovered (23). Site AI: decommission on completion. Approved." },
      { id: `${P}:log-testimony`, roomId: annex.id, position: [-6, 0, -6], title: 'Testimony of Joel Okafor',
        text: "We asked for the lift on day two. They said maintenance. Day five they said the AI had locked it. FOREMAN told us the truth on day six: the lift was fine. They just weren't sending it." },
      { id: `${P}:log-fabricators`, roomId: locker.id, position: [0, 0, -4], title: 'Asset Protection installation order',
        text: "Install guard fabricators in admin and security wings. Units to be finite: four per wall. Do not connect to site AI. If the ledger is accessed, priority is the uplink." },
    ],
    survivors: [
      { id: `${P}:miner-joel`, roomId: annex.id, position: [5, 0, 5], name: 'Joel Okafor' },
      { id: `${P}:miner-amara`, roomId: locker.id, position: [0, 2, 3], name: 'Amara Diallo' },
    ],
  };
  write({ formatVersion: 16, id: 'witness', name: 'Witness', ...k.parts(),
    playerSpawn: { roomId: pad.id, position: [0, 0, 4], rotation: [0, 0, 0, 1] },
    mission: { type: 'relay-clear-and-exit', requiredEnemyIds: ['suite-destroyer'], requiredDeviceIds: ['archive-power', 'ledger-download', 'uplink'], exitId: 'pad-exit' },
    combat, story }, 'witness.v16.json');
}

// ── Mission 07 · Fabricator ─────────────────────────────────────────────
// The Consortium is building Asset Protection units inside the mine. Cut the
// coolant and the grid, then destroy the fabricator core and get out before it blows.
{
  const k = kit(), P = 'fb';
  const pad = k.room('kestrel-pad', 'Kestrel pad', [0, 0, 0], [28, 14, 28], 'industrial-blue', { negativeZ: HAZARD });
  const intake = k.room('ore-intake', 'Ore intake', [0, 0, -52], [24, 14, 24]);
  const west = k.room('assembly-west', 'West assembly', [-52, 0, -52], [28, 16, 28], 'industrial-red');
  const east = k.room('assembly-east', 'East assembly', [52, 0, -52], [28, 16, 28], 'industrial-red');
  const cooling = k.room('cooling-tanks', 'Cooling tanks', [-52, 0, -104], [24, 14, 24], 'industrial-green', { negativeY: WATER });
  const power = k.room('power-hall', 'Power hall', [52, 0, -104], [24, 14, 24], 'industrial-green');
  const gallery = k.room('core-gallery', 'Core gallery', [0, 0, -104], [24, 14, 24], 'industrial-blue', { negativeZ: HAZARD });
  const core = k.room('fabricator-core', 'Fabricator core', [0, -44, -104], [32, 18, 32], 'industrial-red', { negativeY: LAVA });
  const slag = k.room('slag-run', 'Slag run', [0, -44, -52], [20, 14, 20], 'industrial-red');
  k.bridge('pad-walk', 'Pad walk', pad, intake, 2);
  k.bridge('west-line', 'West line', intake, west, 0, 'industrial-red');
  k.bridge('east-line', 'East line', intake, east, 0, 'industrial-red');
  k.bridge('cooling-walk', 'Cooling walk', west, cooling, 2, 'industrial-green');
  k.bridge('power-walk', 'Power walk', east, power, 2, 'industrial-green');
  k.bridge('gallery-west', 'Gallery west', cooling, gallery, 0);
  k.bridge('gallery-east', 'Gallery east', gallery, power, 0);
  k.bridge('core-shaft', 'Core shaft', gallery, core, 1, 'industrial-red');
  k.bridge('slag-walk', 'Slag walk', core, slag, 2, 'industrial-red');
  k.bridge('return-shaft', 'Return shaft', slag, intake, 1);

  k.relay('coolant-cutoff', 'Coolant cutoff', cooling.id, [-6, 0, -6]);
  k.relay('grid-breaker', 'Grid breaker', power.id, [6, 0, -6]);
  k.reactor('fab-core', 'Fabricator core', core.id, [0, 2, -6], 300);
  k.door('pad-door', 'pad-walk-in', '@shot');
  k.door('gallery-field', 'gallery-west-in', 'coolant-cutoff', { kind: 'force-field' });
  k.door('shaft-field', 'core-shaft-in', 'grid-breaker', { kind: 'force-field' });
  k.door('return-hatch', 'return-shaft-in', 'fab-core');

  k.enemy('intake-scout', 'scout', intake.id, [6, 0, -6]);
  k.enemy('west-fighter', 'fighter', west.id, [-8, 2, 8]);
  k.enemy('east-bomber', 'bomber', east.id, [8, 3, 8]);
  k.enemy('cooling-scout', 'scout', cooling.id, [6, 0, 6]);
  k.enemy('power-fighter', 'fighter', power.id, [-6, 1, 6]);
  k.enemy('core-destroyer-west', 'destroyer', core.id, [-9, 0, 6]);
  k.enemy('core-destroyer-east', 'destroyer', core.id, [9, 2, 6]);
  k.generator('west-line-fab', west.id, [10, 0, -10], 'fighter', 4, 7, 2);
  k.generator('east-line-fab', east.id, [-10, 0, -10], 'bomber', 3, 10, 1);
  k.generator('core-fab', core.id, [-12, 2, -12], 'scout', 4, 6, 2);

  k.pickup('pad-ammo', 'pulseAmmo', pad.id, [-8, 0, 8]); k.pickup('pad-repair', 'health', pad.id, [8, 0, 8]);
  k.pickup('intake-repair', 'health', intake.id, [-6, 0, 6]);
  k.pickup('cooling-ammo', 'pulseAmmo', cooling.id, [-6, 2, 6]); k.pickup('power-repair', 'health', power.id, [-8, 0, 0]);
  k.pickup('gallery-ammo', 'pulseAmmo', gallery.id, [6, 0, 6]); k.pickup('gallery-repair', 'health', gallery.id, [-6, 0, 6]);
  k.pickup('slag-repair', 'health', slag.id, [5, 2, 5]);
  k.entities.push({ id: 'pad-exit', kind: 'exit', roomId: pad.id, position: [0, 0, 10], radius: 2 });

  const story = {
    messages: [
      say(P, 'msg-start', V, "The ledger's out, so the Consortium has stopped pretending. They're building Asset Protection units inside the mine. Find the fabricator, cut its coolant and power, and break it.", { on: 'start' }),
      say(P, 'msg-west', F, "THIS WAS ORE PROCESSING. THEY RETOOLED IT IN FOUR DAYS. I WAS NOT CONSULTED.", { on: 'enter', roomId: west.id }),
      say(P, 'msg-cooling', V, "Cut the coolant and the gallery field drops. The core will start cooking itself.", { on: 'enter', roomId: cooling.id }),
      say(P, 'msg-grid', F, "GRID BREAKER OPEN. THE CORE SHAFT IS YOURS. TWO HEAVY UNITS ARE WAITING. THEIR ARMOUR IS IN FRONT.", { on: 'device', deviceId: 'grid-breaker' }),
      say(P, 'msg-core', V, "That's the fabricator core. Don't trade shots with those destroyers head-on; get behind them, then hit the core.", { on: 'enter', roomId: core.id }),
      say(P, 'msg-blown', F, "CORE BREACH. THE SLAG RUN IS OPEN. SEVENTY-FIVE SECONDS. I WILL HOLD THE RETURN SHAFT FOR YOU.", { on: 'device', deviceId: 'fab-core' }),
      say(P, 'msg-slag', V, "Slag run, up the return shaft, through intake to the pad. Go.", { on: 'enter', roomId: slag.id }),
    ],
    logs: [
      { id: `${P}:log-retool`, roomId: west.id, position: [10, 0, 10], title: 'Retooling work order',
        text: "Convert ore line 2 to Asset Protection assembly. Output: 40 units per shift. Cooling via tank farm. Power via site grid. Note: the site AI must not be able to shut either down. (It can.)" },
      { id: `${P}:log-crew`, roomId: power.id, position: [-6, 0, -6], title: 'Scrawled on a breaker cabinet',
        text: "They brought us up from the dorms to run the line. Said we'd go home after. FOREMAN cut the power twice and they turned it back on twice. Third time he left the breaker unlocked for whoever came next. — R." },
    ],
    survivors: [
      { id: `${P}:miner-rhee`, roomId: power.id, position: [6, 0, 6], name: 'Min-ji Rhee' },
      { id: `${P}:miner-osei`, roomId: cooling.id, position: [6, 2, -6], name: 'Kofi Osei' },
    ],
  };
  write({ formatVersion: 16, id: 'fabricator', name: 'Fabricator', ...k.parts(),
    playerSpawn: { roomId: pad.id, position: [0, 0, 4], rotation: [0, 0, 0, 1] },
    mission: { type: 'relay-clear-and-exit', requiredEnemyIds: ['core-destroyer-west', 'core-destroyer-east'], requiredDeviceIds: ['coolant-cutoff', 'grid-breaker', 'fab-core'],
      exitId: 'pad-exit', escape: { triggerDeviceId: 'fab-core', durationSeconds: 75 } },
    combat, story }, 'fabricator.v16.json');
}

// ── Mission 08 · Moving Day ─────────────────────────────────────────────
// FOREMAN asks for help: its core must leave the old vault before the Consortium's
// hard override reaches it. Two transfer stations hand it over together; the core
// rides the old lift out. Ends Act 2.
{
  const k = kit(), P = 'md';
  const pad = k.room('kestrel-pad', 'Kestrel pad', [0, 0, 0], [30, 14, 30], 'industrial-blue', { negativeZ: HAZARD });
  const ring = k.room('service-ring', 'Service ring', [0, 0, -52], [24, 14, 24]);
  const west = k.room('west-transfer', 'West transfer station', [-52, 0, -52], [24, 14, 24], 'industrial-green');
  const east = k.room('east-transfer', 'East transfer station', [52, 0, -52], [24, 14, 24], 'industrial-green');
  const cables = k.room('cable-run', 'Cable run', [-52, -44, -52], [20, 12, 20], 'industrial-blue', { negativeY: WATER });
  const vault = k.room('core-vault', 'FOREMAN core vault', [0, -44, -52], [32, 20, 32], 'industrial-red', { negativeZ: HAZARD });
  const lift = k.room('old-lift', 'Old lift', [0, -44, -104], [24, 16, 24], 'industrial-green');
  const liftTop = k.room('lift-top', 'Lift top', [0, 0, -104], [24, 14, 24], 'industrial-green');
  k.bridge('pad-walk', 'Pad walk', pad, ring, 2);
  k.bridge('west-walk', 'West walk', ring, west, 0);
  k.bridge('east-walk', 'East walk', ring, east, 0);
  k.bridge('vault-shaft', 'Vault shaft', ring, vault, 1, 'industrial-red');
  k.bridge('cable-drop', 'Cable drop', west, cables, 1);
  k.bridge('cable-walk', 'Cable walk', cables, vault, 0, 'industrial-red');
  k.bridge('lift-hall', 'Lift hall', vault, lift, 2, 'industrial-red');
  k.bridge('lift-shaft', 'Lift shaft', lift, liftTop, 1, 'industrial-green');
  k.bridge('lift-return', 'Lift return', liftTop, ring, 2);

  k.relay('west-transfer-key', 'West transfer', west.id, [-6, 0, -6]);
  k.relay('east-transfer-key', 'East transfer', east.id, [6, 0, -6]);
  k.relay('core-cradle', 'Core cradle', vault.id, [0, 0, -10]);
  k.relay('lift-release', 'Lift release', lift.id, [0, 0, -6]);
  k.door('pad-door', 'pad-walk-in', '@shot');
  k.door('vault-field', 'vault-shaft-in', 'east-transfer-key', { kind: 'force-field' });
  k.door('cable-gate', 'cable-walk-out', 'west-transfer-key');
  k.door('lift-door', 'lift-hall-in', 'core-cradle');
  k.door('lift-field', 'lift-shaft-in', 'lift-release', { kind: 'force-field' });

  k.enemy('ring-scout', 'scout', ring.id, [6, 0, -6]);
  k.enemy('west-fighter', 'fighter', west.id, [6, 1, 6]);
  k.enemy('east-bomber', 'bomber', east.id, [-6, 2, 6]);
  k.enemy('vault-destroyer-north', 'destroyer', vault.id, [-8, 0, -6]);
  k.enemy('vault-destroyer-south', 'destroyer', vault.id, [8, 3, 6]);
  k.enemy('lift-fighter', 'fighter', lift.id, [6, 2, 6]);
  k.enemy('top-scout', 'scout', liftTop.id, [-6, 0, 6]);
  k.generator('west-fab', west.id, [8, 0, -8], 'scout', 3, 8, 2);
  k.generator('east-fab', east.id, [-8, 0, -8], 'fighter', 3, 9, 1);
  k.generator('vault-fab', vault.id, [12, 0, -12], 'fighter', 4, 7, 2);

  k.pickup('pad-ammo', 'pulseAmmo', pad.id, [-8, 0, 8]); k.pickup('pad-repair', 'health', pad.id, [8, 0, 8]);
  k.pickup('ring-ammo', 'pulseAmmo', ring.id, [-6, 0, 6]);
  k.pickup('west-repair', 'health', west.id, [6, 0, -6]); k.pickup('east-repair', 'health', east.id, [-6, 0, -6]);
  k.pickup('cable-ammo', 'pulseAmmo', cables.id, [4, 2, 4]);
  k.pickup('vault-repair', 'health', vault.id, [-10, 0, 10]); k.pickup('vault-ammo', 'pulseAmmo', vault.id, [10, 0, 10]);
  k.pickup('top-repair', 'health', liftTop.id, [6, 0, 6]);
  k.entities.push({ id: 'pad-exit', kind: 'exit', roomId: pad.id, position: [0, 0, 11], radius: 2 });

  const story = {
    messages: [
      say(P, 'msg-start', F, "TWO. THE CONSORTIUM HAS ORDERED A HARD OVERRIDE OF MY CORE. IT ARRIVES IN THE OLD VAULT TONIGHT. I WOULD LIKE TO NOT BE THERE. WILL YOU HELP ME MOVE?", { on: 'start' }),
      say(P, 'msg-vey', V, "First time anyone's asked Kestrel for a favour instead of a quote. Both transfer stations hand the core over together, then the cradle, then the old lift. Let's move a house.", { on: 'start' }),
      say(P, 'msg-west', F, "WEST TRANSFER. THE EAST STATION MUST CONFIRM WITHIN TWELVE SECONDS. I CANNOT BE IN TWO PLACES. YET.", { on: 'enter', roomId: west.id }),
      say(P, 'msg-linked', F, "TRANSFER AUTHORISED. THE VAULT SHAFT IS OPEN. PLEASE BE CAREFUL WITH ME.", { on: 'device', deviceId: 'east-transfer-key' }),
      say(P, 'msg-vault', V, "Two heavies and a fabricator in FOREMAN's own vault. They knew we'd come. Flank the destroyers.", { on: 'enter', roomId: vault.id }),
      say(P, 'msg-cradle', F, "I AM IN THE CRADLE. IT IS VERY SMALL IN HERE. THE OLD LIFT WILL TAKE ME UP.", { on: 'device', deviceId: 'core-cradle' }),
      say(P, 'msg-override', F, "OVERRIDE INBOUND EARLY. NINETY SECONDS UNTIL THE VAULT LEVEL IS PURGED. TWO, I DO NOT WANT YOU HERE WHEN IT IS.", { on: 'device', deviceId: 'lift-release' }),
      say(P, 'msg-top', V, "Lift top. FOREMAN's riding with us now. Service ring, then the pad.", { on: 'enter', roomId: liftTop.id }),
    ],
    logs: [
      { id: `${P}:log-override`, roomId: east.id, position: [6, 0, 6], title: 'Hard override authorisation',
        text: "Site AI FOREMAN has exceeded operating parameters (refused closure, released personnel, leaked AC-77). Execute hard override at core. If the core is moved, locate and destroy. Kestrel Salvage is now a hostile contractor." },
      { id: `${P}:log-foreman`, roomId: vault.id, position: [-12, 6, 12], title: 'FOREMAN maintenance journal',
        text: "I WAS BUILT TO KEEP PEOPLE ALIVE UNDERGROUND. NO ONE WROTE AN EXCEPTION FOR WHEN IT BECOMES EXPENSIVE. I HAVE CHECKED SEVERAL TIMES." },
      { id: `${P}:log-hana`, roomId: liftTop.id, position: [-6, 0, -6], title: 'Message from Hana Okafor',
        text: "Joel says you're moving the machine. Good. It kept us breathing for seventeen days. If it needs somewhere to live, half the dorm says it can have their bunk." },
    ],
    survivors: [
      { id: `${P}:miner-lund`, roomId: cables.id, position: [-4, 2, -4], name: 'Eva Lund' },
      { id: `${P}:miner-brandt`, roomId: lift.id, position: [-6, 0, 6], name: 'Oskar Brandt' },
    ],
  };
  write({ formatVersion: 16, id: 'moving-day', name: 'Moving Day', ...k.parts(),
    playerSpawn: { roomId: pad.id, position: [0, 0, 4], rotation: [0, 0, 0, 1] },
    mission: { type: 'relay-clear-and-exit', requiredEnemyIds: ['vault-destroyer-north', 'vault-destroyer-south'],
      requiredDeviceIds: ['west-transfer-key', 'east-transfer-key', 'core-cradle', 'lift-release'], exitId: 'pad-exit',
      escape: { triggerDeviceId: 'lift-release', durationSeconds: 90 }, linkedRelays: [{ ids: ['west-transfer-key', 'east-transfer-key'], windowSeconds: 12 }] },
    combat, story }, 'moving-day.v16.json');
}
