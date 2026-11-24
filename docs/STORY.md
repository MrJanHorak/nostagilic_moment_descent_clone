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

## Authoring story in the editor

Open **Story & radio…** in the level designer to write radio messages and choose when each plays. Place data logs and trapped miners by right-clicking inside a room. The first story edit upgrades a level to format 13. See [level document format](LEVEL_DOCUMENT_FORMAT.md) for the fields and limits.

