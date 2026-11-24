# Current handoff — October 22, 2026

Updated with Crossfire Relay, stronger tactics and durability/salvage/weapons after implementation baseline `164bf41` (October 21) and documentation commit `5a044ec`. Start with the [current roadmap](../ROADMAP.md); the October 14 [assessment](../PROJECT_ASSESSMENT.md) and older checkpoint reports describe history.

## November 23 housekeeping

- Local `*.log` captures moved from the repository root into `logs/` (already gitignored); keep new local logs there.
- Historical `PERFORMANCE_OPTIMIZATIONS.md` moved to `docs/` with links updated. The root now holds only README, DEVELOPER_GUIDE, entry pages/scripts and configuration.
- Package renamed from `2ndaigameattempt` to `descended` (package.json and lockfile name fields only; no dependency changes).
- Root `main.js` entry keeps the same behavior without startup debug logging.
- `vite.config.js` puts three.js core in a shared, long-cached `three` vendor chunk (editor-only addons stay with the editor) and sets `chunkSizeWarningLimit` to 750 kB for that unsplittable chunk. This addresses the long-standing large-chunk advisory.
- Verified on Linux: lint (83 runtime modules) and all 507 unit/simulation tests pass. Typecheck and production build need the Windows-native TypeScript/Rollup binaries in the local install and must be confirmed with `npm run verify` on the owner's machine.

## November 24 Act 1 story and balance pass (Phase 1 complete)

- **Story:** Vector Foundry, Nightfall Reactor and Asterion Deepworks now have v13 copies with radio messages, data logs and rescuable miners (`*.v13.json`; the older files stay for tests). The campaign and the editor's **Open Deepworks** use them. Beats and names are in [STORY.md](../STORY.md#act-1-status), and briefings mention the optional story content.
- **Balance:**
  - Mine robots are drawn at 80% size with full-size hit boxes and clearance (`AUTHORED_ROBOT_SCALE`, `fitEnemyCollider`).
  - Fighters wait 1.2 s before their first wind-up (was 250 ms), so they strafe before firing. In the drill the strafe now comes at about 1 s and the first shot at about 1.65 s.
  - Details are in [enemy pressure](../ENEMY_PRESSURE.md).
- **Tests:** a new Act 1 story test, a scale and hit-box test, and the updated fighter cadence test; the fighter-drill browser test is back to its original intent (strafe before the first shot). Verify passes (584 tests). A browser smoke check confirmed each mission's opening radio line and its miner and log counts.
- **Owner check:** the long combat browser tests (keyboard victory/death, force fields, Signal Breach ranged fight, campaign routes, fighter drill) crash or exceed the VM's time limit, so confirm them on real hardware.

Next: Phase 2, the multiplayer-ready refactor.

## November 24 editor tutorial and Windows menu fix

- **Windows right-click:** the browser's own menu no longer covers the editor's menu. Windows fires `contextmenu` after the button is released, when the editor menu is already under the cursor, so the canvas never received it. `ViewportMenu` now blocks it over its own popovers too.
- **Tutorial:** ten steps in the editor (`src/js/editor/Tutorial.js`), opened by **Start the tutorial** on a new mine's hint bar or **Tutorial** next to the title. It checks each step against the level itself and remembers the current step. The written version is [level editor tutorial](../LEVEL_EDITOR_TUTORIAL.md).
- **Tests:** a unit test walks a level through every tutorial step, and a browser test covers the blocked native menu and a real step ticking off. Verify passes (581 tests).

## November 24 editor clean-up (all eight review items)

Done in one pass; details in the [editor UX review](../EDITOR_UX_REVIEW.md#second-pass-the-eight-remaining-items-done):
- calmer inspector;
- duplicate controls removed;
- Q/W/E/R and Delete shortcuts, with undo steps that name the edit;
- multi-select (Shift/Ctrl-click) with group move and delete;
- room names, which add level format 14;
- a first-run hint;
- toolbars that fit at 1366 and 1024;
- **Playtest from this room**.

New files: `EditorHistory.js`, `PlaytestStart.js` and `tests/editor-polish.test.mjs`; the second test is in `tests/browser/editor-layout.spec.js`. Verify passes (580 tests). 33 editor and My Levels browser tests pass in the VM. The playtest-from-room browser test reaches the playtest correctly; its final "Return to editor" step hits the known VM-only playtest-close problem, so confirm it on real hardware.

Next: Phase 2 (multiplayer-ready refactor).

## November 24 editor UX pass

Hands-on review with screenshots; see [editor UX review](../EDITOR_UX_REVIEW.md). Fixed: a one-row grouped top bar, about 30% taller 3D view at 1366×768, 3D/Top/Front/Side camera presets (keys 1–4), section headings in the right-click menu, and no false placement error when a menu opens. New `tests/browser/editor-layout.spec.js`; the 28 existing editor browser tests pass in the VM. The review lists eight remaining items in priority order.

## November 24 user campaigns

My Levels now builds campaigns: an ordered list of saved levels with a briefing per mission, per-campaign progress, and a shareable `.campaign.json` bundle with every level embedded. See [My Levels → Campaigns](../USER_LEVELS.md#campaigns).
- **Code:** `src/js/core/UserCampaignLibrary.js` (storage, validation, progress, bundle export/import), `src/js/ui/UserCampaigns.js` (campaign cards), `UserLevelLibrary.saveMany` (atomic multi-level import).
- **Game:** `playUserCampaign` shows a briefing screen, then launches through `startLevelDocument(document, {key, missionId})`. Completion records progress, offers NEXT MISSION within the campaign and MY LEVELS instead of SELECT MISSION. Replay keeps the campaign; other entry points clear it.
- **Tests:** `tests/user-campaigns.test.mjs` (8) and `tests/browser/user-campaigns.spec.js` (passes in the VM, with the existing My Levels browser tests). Verify passes (574 tests).

Next: the hands-on editor UX review.

## November 24 second browser run on owner hardware

61/62 passed, including the cockpit-shield test and editor-shapes:99, which the VM could not confirm. The one failure was the fighter drill's strafe check. Since commit 8865550 the fighter fires twice before its first strafe, and each cycle has up to 300 ms of random interval variation, so the strafe starts between about 2.8 and 3.4 s. The test only waited 3 s, so it was a coin flip on any machine. The window is now 5 s; the check that the strafe happens within the first four decisions is unchanged.

## November 24 editor story tools

The level designer can now author everything the story layer supports:
- **Story & radio… (header button):** add, edit, reorder and delete radio messages. Each message has a speaker, text and a trigger: mission start, pilot enters a room, relay activated or reactor destroyed, or robot destroyed. Messages with the same trigger play in list order. Cancel in the message editor returns to the list.
- **Data logs and trapped miners:** right-click inside a room → "Place data log here…" or "Place trapped miner here…", or use Build tools → Content kind. They are ordinary content: drag to move, transfer rooms, delete, and edit the title/text or name in the Content inspector (or via right-click on the item). Markers: yellow slate (log) and green capsule (miner).
- **Format:** the first story edit upgrades the draft to format 13. Deleting a room, relay or robot drops the messages and items that depended on it. Validation issues on logs and miners focus the item.
- **Code:** `src/js/editor/StoryContent.js` (helpers), `StoryDialog.js`, new `EditorDocument` commands (`addStoryMessage`, `updateStoryMessage`, `moveStoryMessage`, `deleteStoryMessage`, `addStoryItem`, `updateStoryItem`). The menu's form gained a multi-line text field and an optional "back" for Cancel.
- **Tests:** `tests/editor-story.test.mjs` (9) and `tests/browser/editor-story.spec.js` (passes in the VM). Verify passes (566 tests).

Next: the campaign builder in My Levels (mission order, briefings, bundle export/import), then the hands-on editor UX review.

## November 24 browser suite on owner hardware

Owner's full run: 52/62 passed. The VM-only concerns (reactor return-to-editor, fighter drill, force fields, victory flow) all pass on real hardware.

Fixed afterwards:
- **Seven stale editor tests:**
  - "Unlock relay" was renamed "Door control".
  - The connection list now reads "CLOSED · relay relay-1".
  - Designer doors upgrade a level to format 8 (sliding), so the expected versions changed.
  - The validation-navigation tests reach invalid items through draft recovery, because content edits are now validated before they apply.
- **Resource-bound test:** starts in the HUD view, because the cockpit compiles extra shader programs.
- **Audio-settings Tab order:** includes the new Difficulty select and the Controls section.
- **Cockpit shield readout:** refreshes immediately when shields change, instead of waiting up to 100 ms (this was a real lag behind the HUD).

Re-verified in the VM: all affected editor tests, the mixer test and the resource test pass. Still to confirm on the owner's machine: the cockpit-shield test (it crashes the VM tab) and editor-shapes:99 (too long for the VM).

## November 24 readability, comms signal, cockpit default

- **Guide:** a two-line bottom guide; control hints only for the first 15 s.
- **Comms signal:** a radio chirp, a softer data-log chime, three panel pulses and a blinking cockpit COMMS lamp (fourth status lamp).
- **Default view:** cockpit for new profiles. Older saves keep HUD. Browser tests that pressed C twice to reach the cockpit no longer do.

Verify passes (557 tests).

Browser notes from this VM:
- **Mission victory/death/reboot test:** now exceeds the 3-minute limit here because the cockpit adds a software-rendered pass.
- **Fighter drill test:** fails its 3-second strafe window here, although debug output shows identical fighter behaviour before and after the change.
- **Reactor editor test:** "Return to editor" leaves the playtest panel open. This fails even on commit 8865550 (before this work). Investigate on real hardware: it may be a real playtest-return bug or VM-specific.
- **Force-field test:** crashes the tab here (VM memory).
- **Next step:** run the full browser suite on the owner's machine or CI.

## November 24 miner figures

Survivors are now floating miner figures instead of capsules (`src/js/entities/meshBuilders/SurvivorMeshBuilder.js`): orange high-vis suit with reflective bands, yellow hard hat, dark visor, glowing lamp, waving arm, blinking backpack beacon and an amber marker ring under the boots. They bob and turn to face the ship. No lights; geometry and materials are shared and kept until the story is disposed. Survivor clearance is now 1 unit (pickup reach 1.5) so the raised arm never clips walls. Verify passes (553 tests). Reviewed in a standalone render; not yet viewed in-mission by the owner.

## November 24 mission status and comms log

From playtest feedback:
- The pause menu shows mission status (required ✓/○, optional counts, time, difficulty, escape) and a comms log of every radio line and log this attempt.
- J, or controller View, pauses and opens the log.
- The HUD guide line adds Aboard/Logs counts and shows the current key bindings.
- Completed mission cards show the best rescues and a data-log archive.

See [mission log](../MISSION_LOG.md). Verify passes (551 tests). Browser checks pass.

## November 24 story layer (format v13)

Optional `story` block: messages (start/enter/device/defeat triggers), data logs and survivors. Validated, compiled to world space, run by `src/js/core/StoryController.js`, shown in `src/js/ui/CommsPanel.js`. Survivors count only on extraction (+250 each) and logs add +100. The completion screen shows both, and campaign records keep `mostRescued` and `logIds`. Signal Breach is now v13 with 9 messages, 2 logs and 2 miners (`signal-breach.v13.json`; the v8 file is kept). The editor preserves story data, cleans up references on delete and avoids ID clashes; story authoring controls are not built yet. See [format v13](../LEVEL_DOCUMENT_FORMAT.md#version-13-story-messages-data-logs-and-survivors) and [story bible](../STORY.md). Verify passes (546 tests). Browser: Signal Breach start shows dispatch in the comms panel, pause holds it, console clean; Signal Breach hidden-wall, editor context-menu and mission-library tests pass (the mission-library count was updated for Bomber Drill).

## November 23 bomber area denial (Phase 1 start)

Authored bombers now hold at range, charge for 900 ms, then lob a non-homing bomb that lands, shows a 3.6-unit blast sphere for 1 s and detonates. Damage falls from 24 to 40% at the rim and is blocked by walls. Bombs pass through the ship, so every blast is telegraphed. Authored bomber health is now 60. There's a new **Bomber Drill** practice mission between Fighter Proving Ground and Crossfire Relay. See [bomber](../BOMBER.md). Full `npm run verify` passes (539 tests) in the Linux scratch copy. Browser: a real Bomber Drill run had a clean console; mission-list/settings tests pass. Needs human balance feedback.

Browser tests in this environment: the VM can run single Playwright tests (each command is capped at 3 minutes and Chrome renders in software). The full suite should run on the owner's machine or in CI. Seven editor browser tests are stale against the current door dialog and validation wording; this is pre-existing, and one label rename was fixed.

## November 23 controls and gamepad

Keyboard remapping (Settings → Controls; `descended.controls.v1`, two keys per action, single owner per key, Escape reserved) and standard-mapping gamepad support. Gamepad covers analog sticks, roll/slide buttons, trigger fire, weapon cycling, relay, view toggles, pause/resume and D-pad/A/B menu navigation. `InputManager.pollGamepad()` runs once per rendered frame from `Game.animate`. `Spaceship.update` accepts 0..1 analog amounts; keyboard booleans produce identical motion. See [controls](../CONTROLS.md). Lint (88 modules) and 529 unit/simulation tests pass on Linux; typecheck/build and a real-controller check need the owner's machine. Phase 0 (housekeeping, campaign save, difficulty, controls) is complete pending that check.

## November 23 difficulty levels

Trainee / Pilot / Veteran / Insane (`src/js/core/Difficulty.js`, preference `difficulty` in `descended.settings.v1`). Pilot is exactly the prior tuning. Tiers scale authored robot health, all damage taken, authored fighter interval (never below its 850 ms telegraph) and mission starting ammo/capacity; the tier is snapshotted at mission start. Selectable in Settings and at the top of Select Mission; campaign records keep the hardest tier cleared. See [difficulty](../DIFFICULTY.md). Lint (85 modules) and 521 unit/simulation tests pass on Linux; typecheck/build and a browser look at the new selectors need the owner's machine. Balance of the non-Pilot tiers is untested by humans.

## November 23 campaign progress

Built-in campaign progress now persists (`src/js/core/CampaignProgress.js`, storage key `descended.campaign.v1`). The main button continues at the first unfinished mission; the mission library shows completion, best time and best score with a two-click reset; the completion screen reports time, records and save status. Imported, playtest and practice levels never change progress. See [campaign progress](../CAMPAIGN_PROGRESS.md). Lint (84 modules) and all 515 unit/simulation tests pass on Linux; typecheck/build and browser checks of the new menus still need a run on the owner's machine.

## Accepted and delivered

M1, M3 and M4's functional workflow are owner-accepted. The owner reported hosted CI passing October 18; do not request those acceptances again. M2's broader hardware performance acceptance remains open. Earlier CI failures and pending editor-sign-off statements are historical, not current blockers.

The game has four authored campaign missions, ending with 48-space Asterion Deepworks; three camera views, cockpit/map/headlights and saved preferences; relays, sliding/shot/concealed doors, fields, lava, reactors and timed extraction. The shared editor/runtime supports formats 1–12, vertical/sloped/diagonal spaces, loops, multiple wall openings, resizing, content movement, validation navigation and playtest/return.

Latest implementation changes:

- [Durability, salvage and weapons](../SALVAGE_AND_WEAPONS.md): following the owner's report that more aggressive enemies still died easily, authored scouts/fighters have 20/40 health. Shot kills leave guaranteed equipment-specific rewards: scout pulse, fighter laser, bomber missile, destroyer/boss plasma. Special salvage unlocks/refills bounded ammo without switching selection and persists until collected or session reset. Player lasers pierce each robot once; missile/plasma blasts have falloff and wall occlusion. Special damage scales from authored pulse damage. Formats remain 1–12; old authored levels inherit these runtime rules.
- [Enemy pressure](../ENEMY_PRESSURE.md): after the owner found enemies passive, authored fighters pursue at 4.8 units/s, warn/recover for 450/400 ms, fire every 1.45–1.75 s with 18-unit/s shots; scouts pursue at 5.4 and lunge at 14 units/s with shorter recovery. Nearby observers report a real sighting to at most four allies within 24 units through adjacent open rooms, at most once per 1.2 s per reporter. Health/damage remain unchanged. Shared data versions and non-document training behavior are preserved.
- [Crossfire Relay](../CROSSFIRE_RELAY.md): a separate nine-space practice mission combining scout/fighter combat, direct/overhead approaches, optional supplies, two loops and a relay-controlled return shortcut. Six new simulation cases and two native-input browser routes exercise its behavior. Longer encounter cases now have a dedicated Playwright/CI project; diagnostic scout positions are read-only and development-only.
- [Mobile fighters](../FIGHTER_MOVEMENT.md): bounded strafe/elevation/spacing between stationary warning/fire/recovery phases, last-seen navigation and a two-fighter practice drill. Authored campaign and custom mines share the behavior.
- [My Levels](../USER_LEVELS.md): import/play/rename/export/delete, editor update/copy, local persistence, cross-tab protection and temporary operation when storage fails. Built-in campaign completion supports next-mission advancement. Saved campaign progression and user campaign bundles are not implemented.
- [Deepworks combat performance](../DEEPWORKS_COMBAT_PERFORMANCE.md): fixed campaign scene light count removes the reproduced shooting shader stalls. [Deepworks](../DEEPWORKS.md) adds destructible reactors, portal visibility, 48 spaces and nine loops.

## Next implementation task

Recheck durability/salvage in human playtests. The owner found the first Crossfire version easy/passive, then reported that the more aggressive enemies still died easily. Scouts/fighters now have 20/40 health; Crossfire needs four/eight normal pulse hits. Use its [checklist](../CROSSFIRE_RELAY.md#balance-playtest-checklist) to compare approach routes, with and without collecting the fighter's cyan laser salvage. Sight reports can draw scouts in before personal visual contact; the drill's second guard can respond early. Automated routes establish behavior, not human difficulty.

Then finish one heavy-enemy role (bomber area denial first), broaden hardware/release regression verification, and add saved campaign progress/user campaigns. Rescue objectives are a later mission-system option. Details and completion criteria are in the [roadmap queue](../ROADMAP.md#next-work-queue).

Authored heavy enemies still share much of their movement; enemy projectiles currently use 10 damage. Player piercing/blast behavior is now implemented. Bomber area denial, directional destroyer armor, boss phases and sniper/support robots remain future work. Salvage is session-local; saved campaign inventory/progress and portable editor placement of special weapons are not implemented.

## Verification available

- October 22 salvage/weapon pass: `npm run verify` passed 83 runtime modules plus two lint tooling files, strict types, all 507 unit/simulation cases and production build. Ten new cases cover durability, type-specific drops, collection/caps/reset, wall blocking, scaled special damage/ammo/fallback, piercing and blast falloff/occlusion/reentrant reset. Existing large-chunk advisory remains.
- Latest [salvage browser evidence](salvage-browser-check.json): five distinct targeted scenarios passed across completed runs, with zero retries: Signal Breach fight/extraction/replay, Crossfire direct, Crossfire overhead with ordinary laser collection/selection/fire, fighter drill and production victory/death/reboot/menu. Initial overhead assertion was corrected because descent had already collected the item; final recheck passes through extraction and replay, with the laser locked again. Final overhead observation: sixteen pulse shots, one laser shot, minimum sampled shields 65%, 152.63 simulation seconds. These are functional observations, not human balance/hardware evidence. Full 62-case and hosted runs remain open.
- October 22 pressure pass: `npm run verify` passed 82 runtime modules plus two lint tooling files, strict types, all 497 unit/simulation cases and production build. The existing large-chunk advisory remains. Scope lives in `tsconfig.check.json`.
- October 21 [fighter browser evidence](mobile-fighter-browser-check.json): four targeted functional cases passed, including ordinary combat, drill completion/reset, Signal Breach and production victory/death/reboot. [My Levels evidence](my-levels-browser-check.json) records its completed six-case checkpoint. These are targeted reports, not a fresh full-suite pass on the latest revision.
- Earlier [pressure browser evidence](enemy-pressure-browser-check.json), before durability/salvage: five distinct targeted scenarios passed across completed runs, with zero retries: Signal Breach fight/overhead/extraction/replay, both Crossfire approaches, the mobile-fighter drill and production victory/death/reboot/menu. Controllers were corrected to answer pursuing allies, prioritize the ranged guard from doorway cover, and enter the hall if a scout starts outside the local report radius. These use ordinary input and read-only diagnostics. Full 62-case browser and latest-revision hosted acceptance remain open.
- Initial [Crossfire evidence](crossfire-browser-check.json), before stronger tactics: six targeted scenarios passed, including My Levels and mission/settings compatibility. Seven shots per route, minimum shields 40% direct / 75% overhead and simulation completion 124.5 / 153.2 s describe that older behavior, not current human balance. Those dated observations and screenshots are preserved.
- October 21 [hardware evidence](deepworks-mobile-fighters.json): Intel UHD / ANGLE D3D11, headless Chromium, 1280×720 cockpit. Idle p95/worst 16.8/33.4 ms; firing 16.7/16.8 ms; encounter 16.8/33.4 ms; no frames above 100 ms and nine scene lights. This is the latest focused capture, not acceptance across traversal, sustained combat, browsers or GPUs. Older arena p95 near 18 ms remains historical evidence.

## Working commands and constraints

Use the pinned Node/npm versions in [TOOLCHAIN.md](../TOOLCHAIN.md). Run `npm run dev` for play/editor, `npm run smoke` for diagnostics, `npm run verify` for local contracts/tests/build, `npm run test:browser` for the full browser suite, and `npm run audit:deps` for a fresh dependency audit.

`npm run profile:arena` and `npm run profile:deepworks -- --renderer=hardware` own port 5185. Browser tests own ports 5183/5184. Keep runtime source/build stable while Playwright owns its servers. Software-rendered controlled-clock checks at 960×540 establish behavior; hardware profiling uses real time at 1280×720 and checks the renderer. Do not infer performance from debug HUD intervals under a mocked clock.

The October 22 review and documentation cleanup do not establish a fresh dependency audit, clean install, hardware capture, deployment or hosted run. Existing feature verification records and screenshots retain their original scope and dates.

## Historical investigations

Keep old evidence intact. CI timing and failure investigations live in [reliability](M2_CI_RELIABILITY.md), [controlled clock](M2_CI_CONTROLLED_CLOCK.md) and [job isolation](M2_CI_JOB_ISOLATION.md). Earlier editor and presentation checkpoints remain useful implementation records, but their pending acceptance language is superseded by the owner acceptances above.
