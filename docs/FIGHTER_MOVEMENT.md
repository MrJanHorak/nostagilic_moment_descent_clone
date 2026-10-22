# Mobile fighters and the proving ground

The later [salvage pass](SALVAGE_AND_WEAPONS.md) raises authored fighter health from 25 to 40 (eight proving-ground pulse hits), adds guaranteed laser salvage, and enables usable special weapons. Earlier verification and screenshots below retain their checkpoint values.

Updated October 22 after owner feedback that robots felt passive. Fighters in authored mines now pursue/reposition at 4.8 units/s, approach when farther than nine units, back away when closer than 5.5, and strafe/change height in between. Campaign and user-authored mines share this behavior. The older non-document training fixtures retain their original movement. See [the pressure pass](ENEMY_PRESSURE.md) for the full comparison.

Each guard chooses a target about every 0.35–0.5 seconds, staggered by spawn identity. Up to six alternatives are checked for body clearance and sight. Local targets stay in the current room and obey swept sphere collision. Cross-room pursuit uses the same increased speed and existing portal routes. A newly closed obstacle interrupts movement. Tactical decisions add no lights, meshes, materials or wall-clock timers.

The authored cycle now has a 450 ms amber warning and 400 ms blue recovery. Shots repeat every 1.45–1.75 seconds and travel at 18 units/s with less spread. The pressure pass kept damage and health unchanged; the later salvage pass increases authored fighter health to 40. Fighters react to visible positions, not player input or incoming bullets. Nearby allies can now pursue a reported sighting through open rooms. Losing all sight resumes navigation toward the last observed/reported position; hidden movement does not refresh it. Local spacing and bounded sighting reports do not implement coordinated flanking or cover selection.

## Play the drill

Open **SELECT MISSION → Practice & prototypes → Fighter Proving Ground**. It is a four-room loop with two required fighters, walls for cover, a second approach through the east gallery, ammunition and repairs. The second guard begins at a different height in the north bay. Clear both, then return to the green exit in the blue sparring room.

Track the first guard's sideways/vertical movement. Amber warns that it is preparing a shot; the blue recovery is a chance to return fire. Use A/D and Space/Shift to vary your position, or the room corners to break sight. The drill uses five-damage pulse rounds, so each 40-health fighter takes eight hits. It starts with 80 rounds and includes a refill; shot kills leave cyan laser salvage. The main campaign retains its own pulse damage/ammunition rules.

The portable authoring source is `src/js/core/levels/documents/fighter-proving-ground.v7.json`. It can be imported into the designer or My Levels using the normal file workflow. No new document format or hidden behavior flags are required. The drill is separate from built-in campaign progression.

## Verification

The latest [salvage pass](SALVAGE_AND_WEAPONS.md) verifies 507 unit/simulation cases, 83 checked runtime modules, strict types and build. The earlier [pressure pass](ENEMY_PRESSURE.md#implementation-and-verification) established stronger movement/fire and local alert guarantees. The checkpoint below records the original October 21 movement pass and its hardware/browser evidence, not the current tuning or a fresh hardware acceptance.

## October 21 movement checkpoint

`npm run verify` passes lint/type checks, 485 unit/simulation tests and the production build. Added checks exercise strafing/elevation, distance control, vertical sight lines, cramped rooms, a newly closed obstruction, stationary warning/recovery, comparable 30/60/120 Hz motion, bounded planning, perception memory, pause/reset and the drill's alternate route/ammunition budget. Existing live warning/projectile/collision tests remain in the suite.

Browser flight and aiming controllers use read-only development diagnostics and ordinary keyboard input. They do not set game transforms, damage enemies, grant supplies or neutralize guards. Software-rendered functional checks and real-time hardware captures are recorded separately.

Four selected browser checks passed: mission/settings compatibility; Signal Breach warning, damage, aimed return fire, overhead flank, extraction and replay; the proving ground's strafing, height change, pause, two kills, full four-room loop, extraction and reset; and the original combat victory/death/reboot/menu flow. The proving-ground finish awarded 1,200 points and replay restored both guards, 100% shields and 80 rounds. Its test controller releases held thrust before waiting for coast, and treats completed simulation as frozen instead of waiting for residual velocity to decay. See [the check record](progress/mobile-fighter-browser-check.json), [movement checkpoint](progress/mobile-fighter-strafe.png) and [completion checkpoint](progress/mobile-fighter-cleared.png). These debug screenshots use a mocked clock; their diagnostic frame intervals are not hardware FPS measurements.

The [Deepworks hardware capture](progress/deepworks-mobile-fighters.json) uses the same real-time idle, twenty-shot and pump-fighter encounter sequence as the lighting regression capture: Intel UHD Graphics `0x00009A60`, ANGLE D3D11, headless Chromium, 1280×720 cockpit view, no mocked clock or tracing. Idle p95/worst was 16.8/33.4 ms; firing 16.7/16.8 ms; the encounter 16.8/33.4 ms. All three had zero frames over 100 ms. The guard was defeated, seven enemies fell to six, and scene lights stayed nine. This focused local regression check does not close the broader M2 performance gate or establish performance on other hardware.

## Follow-up

Recheck the stronger default, increased durability and salvage with human playtests before adding explicit difficulty choices. Limited aim prediction, richer search behavior and distinct heavy-enemy roles remain later work; bounded nearby sighting reports are now implemented.
