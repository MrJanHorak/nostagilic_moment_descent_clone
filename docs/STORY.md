# Story: DESCENDED

Working story bible, started November 24, 2026. Keep new missions consistent with it. The format and runtime are described under [level format v13](LEVEL_DOCUMENT_FORMAT.md#version-13-story-messages-data-logs-and-survivors).

## Premise

You are **Two**, a pilot for **Kestrel Salvage**, a small salvage co-op that takes jobs nobody else wants. The **Asterion Consortium** runs a chain of deep mines whose autonomous mine-control AI, **FOREMAN**, sealed the shafts nine days ago with miners still inside. The Consortium hires Kestrel to restore relays and "recover equipment".

**The twist (revealed gradually):** the Consortium planned a "controlled closure" of the unprofitable lower works and left the crews to "site automation". FOREMAN sealed the mine to stop that, and is protecting the miners from their employer. The player eventually chooses between destroying FOREMAN's core (finishing the contract) and freeing it (exposing the Consortium). How many miners you rescued changes the ending.

## Voices

| Character | Role | Voice |
| --- | --- | --- |
| Vey | Kestrel dispatcher and handler | Dry, practical, protective of the crew; asks the questions the player is thinking |
| FOREMAN | Asterion mine-control AI | ALL CAPS safety notices; never threatens, always "protects"; grows more personal across acts |
| Miners | Survivors and log authors | Tired, scared, specific; logs give names, days, places |
| The Consortium | Faceless employer | Only memos and contract language; never speaks on the radio |

Radio lines are short (at most 280 characters) and never name keys, since controls are remappable. Mission briefings may still describe objectives.

## Structure

| Act | Missions | Story beat |
| --- | --- | --- |
| 1: The Ridge | Signal Breach, Vector Foundry, Nightfall Reactor, Asterion Deepworks | A routine relay job turns up a distress loop, hidden caches and a closure memo |
| 2: The Seal | 4–5 new missions | Kestrel defies the contract to evacuate crews; FOREMAN starts talking back |
| 3: The Core | 4–5 new missions | The Consortium sends its own robots; the choice at FOREMAN's core |

## Act 1 status

- **Signal Breach (v13): written.** Survivors appear as floating, waving miner figures.
  - 9 radio messages from Vey and FOREMAN.
  - 2 data logs: a miner's shift log and a Consortium memo fragment.
  - 2 rescuable miners: Dara Okafor (maintenance) and Teo Brandt (supply bay).
- **Vector Foundry (v13): written.** FOREMAN withdraws lift power, then lets Two pass once the miner in the coolant bay is safe; "Take them up, not down."
  - 9 radio messages; logs: maintenance ticket 4471 (the Consortium's failed override) and a voice note from Mira Sato (FOREMAN's ration drops).
  - Miners: Ivo Marsh (coolant cache), Mira Sato (lift control).
- **Nightfall Reactor (v13): written.** The shutdown is FOREMAN's own failsafe, wired by miner Jonah Hale to seal the lower works on backup air.
  - 9 radio messages; logs: Hale's shift log and the scrubber status board ("Do not count personnel against recovery budget").
  - Miners: Jonah Hale (upper cache), Ana Pell (reserve cache).
- **Asterion Deepworks (v13): written.** Closure order AC-77, the Consortium's own Asset Protection robots ("THEY ARE THE CONSORTIUM'S"), and FOREMAN's first direct message to Two on the observation deck.
  - 10 radio messages; logs: closure order AC-77, the freight manifest for the security frames, and a FOREMAN core note.
  - Miners: Sela Rook (hidden repair locker), Pete Dunn (coolant reservoir), Inés Varga (cargo marshalling).

Act 1 ends on Vey's line at the quay: "we need to talk about who we're actually working for." Act 2 picks up there.

## Act 2 status

- **The Seal (mission 05, v14): written.** Kestrel goes back without a contract to evacuate the lower works. FOREMAN cooperates openly. The Consortium's Asset Protection robots are already inside, and powering the evac lift triggers a Consortium flood with a 75-second escape. See [The Seal](THE_SEAL.md).
  - 13 radio messages; logs: the shelter roll call, FOREMAN's seal log, Asset Protection's standing orders, and Inés's locker note.
  - Miners: Hana Okafor, Luis Ferro (lower dorms), Pavel Ostrov (flood sump), Kit Brandt (old smelter).
- **Witness (mission 06, v16): written.** Kestrel needs proof nobody can bury. Two pulls closure ledger AC-77 from the admin block's records vault and sends it home through the executive uplink. Consortium guard fabricators in the walls keep releasing Asset Protection units. Joel Okafor (Hana's brother) testifies.
  - 7 radio messages; logs: the ledger extract ("Personnel: not recovered (23)"), Joel's testimony, and the fabricator installation order.
  - Miners: Joel Okafor (dorm annex), Amara Diallo (evidence locker).
- **Fabricator (mission 07, v16): written.** With the ledger public, the Consortium stops pretending: it has retooled ore line 2 to build Asset Protection units inside the mine. Two cuts the coolant and the grid, flanks two destroyers and ruptures the fabricator core (75-second escape).
  - 7 radio messages; logs: the retooling work order and a miner's note that FOREMAN left the breaker unlocked.
  - Miners: Min-ji Rhee (power hall), Kofi Osei (cooling tanks), both forced to run the line.
- **Moving Day (mission 08, v16): written. Ends Act 2.** FOREMAN asks for a favour: a hard override is coming for its core.
  - Two transfer stations hand the core over together (a linked pair), the cradle takes it, and the old lift carries it out under a 90-second purge.
  - The Consortium declares Kestrel a hostile contractor.
  - 8 radio messages (FOREMAN opens it); logs: the hard-override authorisation, FOREMAN's maintenance journal, and Hana's offer of a bunk for the machine.
  - Miners: Eva Lund (cable run), Oskar Brandt (old lift).
## Act 3 status

- **Dead Signal (mission 09, v16): written.** FOREMAN's core rides in Kestrel's cargo bay ("THE COFFEE MACHINE IS NOT INTELLIGENT"). The Consortium has jammed the quay. Two kills both jammers together (a linked pair), powers the old mast and puts Kestrel on air. Hana Okafor speaks on the open channel and offers the twenty-three as witnesses.
  - 8 radio messages; logs: the Asset Protection field order ("Contractor personnel are not a recovery priority") and a quay maintenance tag.
  - Dockhands: Teo Mori (generator hall), Bisi Ade (relay gallery).
- **Breaker Yard (mission 10, v16): written.** The broadcast gave Kestrel's position away. In the old breaker yard, the Consortium depot holds recovery cradles, one of them FOREMAN-sized. **The Warden**, the first boss, guards the breaker floor. The breaker console starts a 90-second escape through the molten scrap line.
  - 7 radio messages; logs: the Warden spec ("Cost: more than the miners' back pay") and the yard whiteboard.
  - Miners: Grace Hollis (depot), Ren Nakamura (scrap tunnel).
- **Core of the Matter (mission 11, v17): written. Ends the campaign.** At the deep relay, the only place FOREMAN can be uploaded off-world or purged, **the Executor** waits. After the relay syncs, FOREMAN sets out both honest choices and refuses to argue: **Release** (it goes everywhere, and AC-77 with it) or **Purge** (Kestrel's contract is paid in full). Only the first relay touched answers.
  - 8 radio messages, with a different FOREMAN farewell for each choice; logs: the Executor order, clause 9 of Kestrel's contract with Vey's pencilled note, and FOREMAN's last maintenance entry.
  - Technicians: Tomas Varga (open line), Ngozi Iwu (purge furnace), Mikko Salo (antechamber).
- **Endings:** there are two epilogues, *Open line* and *Contract closed*. Each changes with the miners brought home across all 11 missions: 90% or more, half or more, or fewer. With many witnesses, the hearings succeed either way. With few, the Open line keeps the files alive but the hearings stall, and the Contract closed ending fades into a settlement nobody reads. The text is in `campaignEnding` (`src/js/core/levels/Campaign.js`).

## Authoring story in the editor

Open **Story & radio…** in the level designer to write radio messages and choose when each plays. Place data logs and trapped miners by right-clicking inside a room. The first story edit upgrades a level to format 13. See [level document format](LEVEL_DOCUMENT_FORMAT.md) for the fields and limits.

