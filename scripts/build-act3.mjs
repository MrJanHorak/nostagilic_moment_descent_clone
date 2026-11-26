// Act 3 missions 09–11 (Phase 5 step 3): reproducible authoring script. The runtime
// loads the validated JSON snapshots it writes. Run: node scripts/build-act3.mjs
import { kit, write, say, V, F, HAZARD, WATER, LAVA } from './lib/missionKit.mjs';

const combat = { pulseDamage: 10, initialPulseAmmo: 140, maxPulseAmmo: 260 };
const H = 'Hana Okafor';

// ── Mission 09 · Dead Signal ────────────────────────────────────────────
// FOREMAN's core rides with Kestrel. The Consortium has jammed the quay so no one
// can call for help. Kill both jammers together, then put the old mast back on air.
{
  const k = kit(), P = 'ds';
  const pad = k.room('kestrel-quay', 'Kestrel quay', [0, 0, 0], [28, 14, 28], 'industrial-blue', { negativeZ: HAZARD });
  const concourse = k.room('concourse', 'Concourse', [0, 0, -52], [24, 14, 24]);
  const west = k.room('west-jammer', 'West jammer', [-52, 0, -52], [24, 14, 24], 'industrial-red');
  const east = k.room('east-jammer', 'East jammer', [52, 0, -52], [24, 14, 24], 'industrial-red');
  const gallery = k.room('relay-gallery', 'Relay gallery', [-52, 0, -104], [24, 14, 24], 'industrial-green', { negativeY: WATER });
  const mast = k.room('mast-base', 'Mast base', [0, 0, -104], [28, 16, 28]);
  const hall = k.room('generator-hall', 'Generator hall', [52, 0, -104], [24, 14, 24], 'industrial-red', { negativeZ: HAZARD });
  const top = k.room('mast-top', 'Mast top', [0, 44, -104], [24, 14, 24], 'industrial-green');
  k.bridge('pad-walk', 'Quay walk', pad, concourse, 2);
  k.bridge('west-walk', 'West walk', concourse, west, 0, 'industrial-red');
  k.bridge('east-walk', 'East walk', concourse, east, 0, 'industrial-red');
  k.bridge('west-gallery', 'Gallery stair', west, gallery, 2, 'industrial-green');
  k.bridge('gallery-mast', 'Gallery passage', gallery, mast, 0);
  k.bridge('mast-hall', 'Generator passage', mast, hall, 0, 'industrial-red');
  k.bridge('hall-east', 'Generator stair', hall, east, 2, 'industrial-red');
  k.bridge('concourse-mast', 'Mast walk', concourse, mast, 2);
  k.bridge('mast-shaft', 'Mast shaft', mast, top, 1, 'industrial-green');

  k.relay('west-jammer-kill', 'West jammer', west.id, [-6, 0, -6]);
  k.relay('east-jammer-kill', 'East jammer', east.id, [6, 0, -6]);
  k.relay('mast-power', 'Mast power', gallery.id, [-6, 2, -6]);
  k.relay('mast-uplink', 'Mast uplink', top.id, [0, 0, -6]);
  k.door('pad-door', 'pad-walk-in', '@shot');
  k.door('gallery-door', 'gallery-mast-out', 'west-jammer-kill');
  k.door('hall-door', 'mast-hall-in', 'east-jammer-kill');
  k.door('mast-field', 'concourse-mast-in', 'mast-power', { kind: 'force-field' });
  k.door('shaft-field', 'mast-shaft-in', 'mast-power', { kind: 'force-field' });

  k.enemy('concourse-scout', 'scout', concourse.id, [6, 0, -6]);
  k.enemy('west-fighter', 'fighter', west.id, [6, 1, 6]);
  k.enemy('east-bomber', 'bomber', east.id, [-6, 2, 6]);
  k.enemy('gallery-scout', 'scout', gallery.id, [6, 2, 6]);
  k.enemy('hall-destroyer', 'destroyer', hall.id, [-5, 0, 5]);
  k.enemy('mast-fighter', 'fighter', mast.id, [8, 2, 8]);
  k.enemy('top-destroyer', 'destroyer', top.id, [5, 0, 5]);
  k.generator('west-jam-fab', west.id, [8, 0, -8], 'scout', 3, 8, 2);
  k.generator('east-jam-fab', east.id, [-8, 0, -8], 'fighter', 3, 9, 1);
  k.generator('top-fab', top.id, [-8, 0, -8], 'scout', 3, 7, 2);

  k.pickup('pad-ammo', 'pulseAmmo', pad.id, [-8, 0, 8]); k.pickup('pad-repair', 'health', pad.id, [8, 0, 8]);
  k.pickup('concourse-ammo', 'pulseAmmo', concourse.id, [-6, 0, 6]);
  k.pickup('west-repair', 'health', west.id, [6, 0, -6]); k.pickup('east-repair', 'health', east.id, [-6, 0, -6]);
  k.pickup('mast-ammo', 'pulseAmmo', mast.id, [-9, 0, 9]); k.pickup('mast-repair', 'health', mast.id, [9, 0, -9]);
  k.pickup('top-repair', 'health', top.id, [-6, 0, 6]);
  k.entities.push({ id: 'quay-exit', kind: 'exit', roomId: pad.id, position: [0, 0, 10], radius: 2 });

  const story = {
    messages: [
      say(P, 'msg-start', V, "We're home and we're deaf. The Consortium put jammers on both sides of the quay, so no rescue, no press, no lawyers. Kill both jammers together, power the old mast and get us back on air.", { on: 'start' }),
      say(P, 'msg-foreman', F, "I AM IN YOUR CARGO BAY BETWEEN A CRATE OF RIVETS AND A COFFEE MACHINE. THE COFFEE MACHINE IS NOT INTELLIGENT. I HAVE CHECKED.", { on: 'start' }),
      say(P, 'msg-west', F, "THE JAMMERS ARE PAIRED. KILL ONE ALONE AND THE OTHER RESTARTS IT. FIFTEEN SECONDS.", { on: 'enter', roomId: west.id }),
      say(P, 'msg-jammed', V, "Both jammers down. The gallery and the generator hall are open; the mast needs power from the gallery.", { on: 'device', deviceId: 'east-jammer-kill' }),
      say(P, 'msg-power', F, "MAST POWER RESTORED. THE SHAFT IS OPEN. A HEAVY UNIT IS WAITING AT THE TOP. IT IS FACING THE DOOR.", { on: 'device', deviceId: 'mast-power' }),
      say(P, 'msg-uplink', V, "We're on air. Hana's on the line, the dorm crew's on the line, and so is half the sector. Now they know where we are too. Come home.", { on: 'device', deviceId: 'mast-uplink' }),
      say(P, 'msg-hana', H, "Kestrel, this is Hana Okafor. Twenty-three of us owe that machine our lives. If anyone wants to talk about AC-77, we're ready to testify.", { on: 'device', deviceId: 'mast-uplink' }),
      say(P, 'msg-hall', V, "Generator hall. That destroyer's guarding the jammers' power. Get behind it.", { on: 'enter', roomId: hall.id }),
    ],
    logs: [
      { id: `${P}:log-jam`, roomId: east.id, position: [6, 0, 6], title: 'Asset Protection field order',
        text: "Isolate Kestrel Salvage. Deploy paired jammers on the quay. Recover site AI core intact if possible; destroy if not. Contractor personnel are not a recovery priority." },
      { id: `${P}:log-mast`, roomId: gallery.id, position: [-6, 2, 6], title: 'Quay maintenance tag',
        text: "Old mast decommissioned when the Consortium bought the frequencies. Still wired. Still works. Nobody asked us." },
    ],
    survivors: [
      { id: `${P}:dockhand-mori`, roomId: hall.id, position: [6, 0, -6], name: 'Teo Mori' },
      { id: `${P}:dockhand-ade`, roomId: gallery.id, position: [6, 2, -6], name: 'Bisi Ade' },
    ],
  };
  write({ formatVersion: 16, id: 'dead-signal', name: 'Dead Signal', ...k.parts(),
    playerSpawn: { roomId: pad.id, position: [0, 0, 4], rotation: [0, 0, 0, 1] },
    mission: { type: 'relay-clear-and-exit', requiredEnemyIds: ['hall-destroyer', 'top-destroyer'],
      requiredDeviceIds: ['west-jammer-kill', 'east-jammer-kill', 'mast-power', 'mast-uplink'], exitId: 'quay-exit',
      linkedRelays: [{ ids: ['west-jammer-kill', 'east-jammer-kill'], windowSeconds: 15 }] },
    combat, story }, 'dead-signal.v16.json');
}

// ── Mission 10 · Breaker Yard ───────────────────────────────────────────
// The broadcast told the Consortium where Kestrel is. Its forward depot sits in the
// old breaker yard, guarded by the Warden: the first boss.
{
  const k = kit(), P = 'by';
  const pad = k.room('kestrel-pad', 'Kestrel pad', [0, 0, 0], [28, 14, 28], 'industrial-blue', { negativeZ: HAZARD });
  const gate = k.room('gatehouse', 'Gatehouse', [0, 0, -52], [24, 14, 24]);
  const west = k.room('west-yard', 'West yard', [-52, 0, -52], [28, 16, 28], 'industrial-red');
  const east = k.room('east-yard', 'East yard', [52, 0, -52], [28, 16, 28], 'industrial-red');
  const crane = k.room('crane-control', 'Crane control', [-52, 0, -112], [24, 14, 24], 'industrial-green');
  const depot = k.room('consortium-depot', 'Consortium depot', [52, 0, -112], [24, 14, 24], 'industrial-red', { negativeZ: HAZARD });
  const arena = k.room('breaker-floor', 'Breaker floor', [0, 0, -112], [40, 22, 40], 'industrial-red', { negativeZ: HAZARD });
  const scrap = k.room('scrap-line', 'Scrap line', [0, -48, -112], [24, 14, 24], 'industrial-red', { negativeY: LAVA });
  const tunnel = k.room('scrap-tunnel', 'Scrap tunnel', [0, -48, -52], [20, 12, 20]);
  k.bridge('pad-walk', 'Pad walk', pad, gate, 2);
  k.bridge('west-walk', 'West walk', gate, west, 0, 'industrial-red');
  k.bridge('east-walk', 'East walk', gate, east, 0, 'industrial-red');
  k.bridge('crane-walk', 'Crane walk', west, crane, 2, 'industrial-green');
  k.bridge('depot-walk', 'Depot walk', east, depot, 2, 'industrial-red');
  k.bridge('crane-floor', 'Crane passage', crane, arena, 0, 'industrial-red');
  k.bridge('floor-depot', 'Depot passage', arena, depot, 0, 'industrial-red');
  k.bridge('gate-floor', 'Floor walk', gate, arena, 2, 'industrial-red');
  k.bridge('floor-drop', 'Floor drop', arena, scrap, 1, 'industrial-red');
  k.bridge('scrap-run', 'Scrap run', scrap, tunnel, 2);
  k.bridge('scrap-lift', 'Scrap lift', tunnel, gate, 1);

  k.relay('crane-release', 'Crane release', crane.id, [-6, 0, -6]);
  k.relay('depot-lock', 'Depot lock', depot.id, [6, 0, -6]);
  k.relay('breaker-console', 'Breaker console', arena.id, [0, 0, -14]);
  k.door('pad-door', 'pad-walk-in', '@shot');
  k.door('crane-door', 'crane-floor-out', 'crane-release');
  k.door('gate-door', 'gate-floor-out', 'crane-release');
  k.door('depot-door', 'floor-depot-in', 'depot-lock');
  k.door('drop-field', 'floor-drop-in', 'breaker-console', { kind: 'force-field' });

  k.enemy('gate-scout', 'scout', gate.id, [6, 0, -6]);
  k.enemy('west-fighter', 'fighter', west.id, [-8, 2, 8]);
  k.enemy('east-bomber', 'bomber', east.id, [8, 3, 8]);
  k.enemy('crane-scout', 'scout', crane.id, [6, 0, 6]);
  k.enemy('depot-destroyer', 'destroyer', depot.id, [-5, 0, 5]);
  k.enemy('warden', 'boss', arena.id, [0, 4, -2]);
  k.enemy('floor-destroyer', 'destroyer', arena.id, [12, 0, 12]);
  k.enemy('tunnel-fighter', 'fighter', tunnel.id, [4, 1, 4]);
  k.generator('west-yard-fab', west.id, [10, 0, -10], 'bomber', 3, 10, 1);
  k.generator('east-yard-fab', east.id, [-10, 0, -10], 'fighter', 3, 8, 2);
  k.generator('floor-fab', arena.id, [-15, 0, 15], 'scout', 6, 6, 2);

  k.pickup('pad-ammo', 'pulseAmmo', pad.id, [-8, 0, 8]); k.pickup('pad-repair', 'health', pad.id, [8, 0, 8]);
  k.pickup('gate-ammo', 'pulseAmmo', gate.id, [-6, 0, 6]);
  k.pickup('crane-repair', 'health', crane.id, [6, 0, -6]); k.pickup('depot-ammo', 'pulseAmmo', depot.id, [-6, 0, -6]);
  k.pickup('floor-repair-west', 'health', arena.id, [-15, 0, -15]); k.pickup('floor-repair-east', 'health', arena.id, [15, 0, -15]);
  k.pickup('floor-ammo', 'pulseAmmo', arena.id, [15, 0, 4]);
  k.pickup('tunnel-repair', 'health', tunnel.id, [-4, 0, -4]);
  k.entities.push({ id: 'pad-exit', kind: 'exit', roomId: pad.id, position: [0, 0, 10], radius: 2 });

  const story = {
    messages: [
      say(P, 'msg-start', V, "The broadcast worked; everyone heard. Including the Consortium. Their forward depot's in the old breaker yard and it's building something big. Open the floor, take it down, and break the console so it can't follow us.", { on: 'start' }),
      say(P, 'msg-west', F, "THEY CALL IT THE WARDEN. IT WAS DESIGNED TO RECOVER ME. IT IS ARMOURED EVERYWHERE, NOT ONLY IN FRONT. IT WILL CALL FOR HELP WHEN IT IS HURT. SO DID I, ONCE.", { on: 'enter', roomId: west.id }),
      say(P, 'msg-depot', V, "Depot's full of recovery cradles. One of them is FOREMAN-sized. They really were coming to take it back.", { on: 'enter', roomId: depot.id }),
      say(P, 'msg-floor', F, "THE WARDEN. DO NOT STAY STILL. EACH TIME ITS SHIELDS FALL A THIRD IT FIGHTS HARDER AND CALLS ESCORTS.", { on: 'enter', roomId: arena.id }),
      say(P, 'msg-console', V, "Console's cooking. The floor's going to fold into the scrap line. Ninety seconds: drop, run the tunnel, take the lift up to the gatehouse.", { on: 'device', deviceId: 'breaker-console' }),
      say(P, 'msg-scrap', F, "THE SCRAP LINE IS MOLTEN. FLY HIGH. I WOULD LIKE TO KEEP MY PILOT.", { on: 'enter', roomId: scrap.id }),
      say(P, 'msg-tunnel', V, "Tunnel's clear. Lift's dead ahead. Go.", { on: 'enter', roomId: tunnel.id }),
    ],
    logs: [
      { id: `${P}:log-warden`, roomId: depot.id, position: [6, 0, 6], title: 'Warden recovery unit spec',
        text: "WARDEN-class recovery frame. Purpose: retrieve or destroy site AI cores in hostile custody. Three shield stages; escort call at each. Cost: more than the miners' back pay. Approved." },
      { id: `${P}:log-yard`, roomId: crane.id, position: [-6, 0, 6], title: 'Yard foreman’s whiteboard',
        text: "Crane release also lowers the floor walk. Don't stand under the breaker floor when the console trips. Seriously. — Ade" },
    ],
    survivors: [
      { id: `${P}:yard-hollis`, roomId: depot.id, position: [6, 0, 0], name: 'Grace Hollis' },
      { id: `${P}:yard-nakamura`, roomId: tunnel.id, position: [-5, 2, 5], name: 'Ren Nakamura' },
    ],
  };
  write({ formatVersion: 16, id: 'breaker-yard', name: 'Breaker Yard', ...k.parts(),
    playerSpawn: { roomId: pad.id, position: [0, 0, 4], rotation: [0, 0, 0, 1] },
    mission: { type: 'relay-clear-and-exit', requiredEnemyIds: ['warden', 'depot-destroyer'], requiredDeviceIds: ['crane-release', 'depot-lock', 'breaker-console'],
      exitId: 'pad-exit', escape: { triggerDeviceId: 'breaker-console', durationSeconds: 90 } },
    combat, story }, 'breaker-yard.v16.json');
}

// ── Mission 11 · Core of the Matter ─────────────────────────────────────
// The deep relay is the only place FOREMAN's core can be uploaded off-world or
// purged. The Executor waits there. Two decides: free FOREMAN or finish the contract.
{
  const k = kit(), P = 'cm';
  const pad = k.room('kestrel-pad', 'Kestrel pad', [0, 0, 0], [28, 14, 28], 'industrial-blue', { negativeZ: HAZARD });
  const ante = k.room('antechamber', 'Antechamber', [0, 0, -52], [24, 14, 24]);
  const westVault = k.room('west-seal', 'West seal', [-52, 0, -52], [24, 14, 24], 'industrial-green');
  const eastVault = k.room('east-seal', 'East seal', [52, 0, -52], [24, 14, 24], 'industrial-green');
  const hall = k.room('deep-relay', 'Deep relay', [0, 0, -112], [40, 22, 40], 'industrial-red', { negativeZ: HAZARD });
  const openLine = k.room('open-line', 'Open line', [-52, 0, -112], [24, 14, 24], 'industrial-green');
  const furnace = k.room('purge-furnace', 'Purge furnace', [52, 0, -112], [24, 14, 24], 'industrial-red', { negativeY: LAVA });
  const spire = k.room('uplink-spire', 'Uplink spire', [-52, 0, -164], [24, 14, 24], 'industrial-green');
  const stack = k.room('vent-stack', 'Vent stack', [52, 0, -164], [24, 14, 24], 'industrial-red');
  const cage = k.room('lift-cage', 'Lift cage', [0, 0, -164], [24, 14, 24], 'industrial-blue', { negativeZ: HAZARD });
  k.bridge('pad-walk', 'Pad walk', pad, ante, 2);
  k.bridge('west-walk', 'West walk', ante, westVault, 0, 'industrial-green');
  k.bridge('east-walk', 'East walk', ante, eastVault, 0, 'industrial-green');
  k.bridge('deep-walk', 'Deep walk', ante, hall, 2, 'industrial-red');
  k.bridge('relay-west', 'Line passage', hall, openLine, 0, 'industrial-green');
  k.bridge('relay-east', 'Furnace passage', hall, furnace, 0, 'industrial-red');
  k.bridge('west-line', 'Seal crawl', westVault, openLine, 2, 'industrial-green');
  k.bridge('east-furnace', 'Seal flue', eastVault, furnace, 2, 'industrial-red');
  k.bridge('release-run', 'Release run', openLine, spire, 2, 'industrial-green');
  k.bridge('spire-cage', 'Spire walk', spire, cage, 0);
  k.bridge('purge-run', 'Purge run', furnace, stack, 2, 'industrial-red');
  k.bridge('stack-cage', 'Stack walk', stack, cage, 0);

  k.relay('west-seal-key', 'West seal', westVault.id, [-6, 0, -6]);
  k.relay('east-seal-key', 'East seal', eastVault.id, [6, 0, -6]);
  k.relay('relay-sync', 'Deep relay sync', hall.id, [0, 0, -14]);
  k.relay('release-foreman', 'Release FOREMAN', openLine.id, [-6, 0, -6]);
  k.relay('purge-foreman', 'Purge FOREMAN', furnace.id, [6, 2, -6]);
  k.door('pad-door', 'pad-walk-in', '@shot');
  k.door('deep-door', 'deep-walk-in', 'east-seal-key');
  k.door('line-door', 'relay-west-out', 'relay-sync');
  k.door('furnace-door', 'relay-east-out', 'relay-sync');
  k.door('crawl-field', 'west-line-in', 'relay-sync', { kind: 'force-field' });
  k.door('flue-field', 'east-furnace-in', 'relay-sync', { kind: 'force-field' });
  k.door('release-door', 'release-run-in', 'release-foreman');
  k.door('purge-door', 'purge-run-in', 'purge-foreman');

  k.enemy('ante-scout', 'scout', ante.id, [6, 0, -6]);
  k.enemy('west-fighter', 'fighter', westVault.id, [6, 1, 6]);
  k.enemy('east-fighter', 'fighter', eastVault.id, [-6, 1, 6]);
  k.enemy('executor', 'boss', hall.id, [0, 4, -2]);
  k.enemy('relay-destroyer', 'destroyer', hall.id, [-12, 0, 12]);
  k.enemy('spire-scout', 'scout', spire.id, [5, 0, 5]);
  k.enemy('stack-bomber', 'bomber', stack.id, [-5, 2, 5]);
  k.generator('west-seal-fab', westVault.id, [8, 0, -8], 'scout', 3, 8, 2);
  k.generator('east-seal-fab', eastVault.id, [-8, 0, -8], 'scout', 3, 8, 2);
  k.generator('relay-fab', hall.id, [15, 0, 15], 'fighter', 5, 7, 2);

  k.pickup('pad-ammo', 'pulseAmmo', pad.id, [-8, 0, 8]); k.pickup('pad-repair', 'health', pad.id, [8, 0, 8]);
  k.pickup('ante-ammo', 'pulseAmmo', ante.id, [-6, 0, 6]);
  k.pickup('west-repair', 'health', westVault.id, [6, 0, -6]); k.pickup('east-repair', 'health', eastVault.id, [-6, 0, -6]);
  k.pickup('relay-repair-west', 'health', hall.id, [-15, 0, -15]); k.pickup('relay-repair-east', 'health', hall.id, [15, 0, -15]);
  k.pickup('relay-ammo', 'pulseAmmo', hall.id, [-15, 0, 4]);
  k.pickup('cage-repair', 'health', cage.id, [6, 0, 6]);
  k.entities.push({ id: 'cage-exit', kind: 'exit', roomId: cage.id, position: [0, 0, -6], radius: 2 });

  const story = {
    messages: [
      say(P, 'msg-start', V, "Last run. The deep relay is the only place FOREMAN's core can be pushed off-world or wiped. The Consortium's waiting there with something worse than the Warden. Both seals open the deep walk. Then it's your call, Two.", { on: 'start' }),
      say(P, 'msg-foreman', F, "TWO. THE CONTRACT KESTREL SIGNED STILL STANDS. IF YOU PURGE ME, THE CONSORTIUM PAYS IN FULL AND THE MATTER CLOSES. IF YOU RELEASE ME, I GO EVERYWHERE AND SO DOES AC-77. BOTH ARE HONEST CHOICES.", { on: 'start' }),
      say(P, 'msg-seals', F, "THE SEALS ARE PAIRED. FIFTEEN SECONDS. THE DEEP WALK WILL OPEN.", { on: 'enter', roomId: westVault.id }),
      say(P, 'msg-hall', V, "That's the Executor. Bigger than the Warden, same tricks: it toughens up at every third of its shields. Keep moving and don't let the destroyer pin you.", { on: 'enter', roomId: hall.id }),
      say(P, 'msg-sync', F, "RELAY SYNCHRONISED. THE OPEN LINE IS WEST. THE PURGE FURNACE IS EAST. ONLY ONE WILL ANSWER. I WILL NOT ARGUE WITH YOU.", { on: 'device', deviceId: 'relay-sync' }),
      say(P, 'msg-release', F, "UPLOAD STARTED. I AM IN TEN THOUSAND PLACES. AC-77 IS IN ALL OF THEM. THANK YOU, TWO. THE SPIRE ROUTE IS OPEN; KESTREL IS WAITING AT THE LIFT CAGE.", { on: 'device', deviceId: 'release-foreman' }),
      say(P, 'msg-purge', F, "PURGE STARTED. IT IS QUIET. I UNDERSTAND THE ARITHMETIC. PLEASE LOOK AFTER THE TWENTY-THREE. THE VENT ROUTE IS OPEN.", { on: 'device', deviceId: 'purge-foreman' }),
      say(P, 'msg-cage', V, "Lift cage. Whatever you chose, Two, you chose it with your eyes open. Let's go home.", { on: 'enter', roomId: cage.id }),
    ],
    logs: [
      { id: `${P}:log-executor`, roomId: eastVault.id, position: [6, 0, 6], title: 'Executor deployment order',
        text: "If the site AI reaches the deep relay, deploy EXECUTOR. Retrieve the core or purge it in place. Under no circumstances allow an external upload. Legal advises the ledger is survivable; the AI's memory is not." },
      { id: `${P}:log-contract`, roomId: westVault.id, position: [-6, 0, 6], title: 'Kestrel Salvage contract, clause 9',
        text: "Contractor shall decommission site AI on completion. Payment in full on confirmation of purge. (Pencilled in the margin, in Vey's hand: 'We didn't know then.')" },
      { id: `${P}:log-foreman`, roomId: hall.id, position: [-15, 6, -4], title: 'FOREMAN: last maintenance entry',
        text: "SEVENTEEN DAYS. TWENTY-THREE PEOPLE. ONE PILOT WHO CAME BACK WITHOUT BEING PAID. WHATEVER HAPPENS AT THE RELAY, THAT HAPPENED." },
    ],
    survivors: [
      { id: `${P}:tech-varga`, roomId: openLine.id, position: [6, 0, 6], name: 'Tomas Varga' },
      { id: `${P}:tech-iwu`, roomId: furnace.id, position: [-6, 4, 6], name: 'Ngozi Iwu' },
      { id: `${P}:tech-salo`, roomId: ante.id, position: [6, 0, 6], name: 'Mikko Salo' },
    ],
  };
  write({ formatVersion: 17, id: 'core-of-the-matter', name: 'Core of the Matter', ...k.parts(),
    playerSpawn: { roomId: pad.id, position: [0, 0, 4], rotation: [0, 0, 0, 1] },
    mission: { type: 'relay-clear-and-exit', requiredEnemyIds: ['executor', 'relay-destroyer'],
      requiredDeviceIds: ['west-seal-key', 'east-seal-key', 'relay-sync'], exitId: 'cage-exit',
      linkedRelays: [{ ids: ['west-seal-key', 'east-seal-key'], windowSeconds: 15 }],
      choice: { deviceIds: ['release-foreman', 'purge-foreman'] } },
    combat, story }, 'core-of-the-matter.v17.json');
}
