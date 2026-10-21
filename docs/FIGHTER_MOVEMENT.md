# Mobile fighters and the proving ground

Fighters in authored mines now choose short movements between attacks. They approach when farther than 12 units, back away when closer than seven, and strafe/change height within their preferred firing distance. Campaign and user-authored mines use the same behavior. The older non-document training fixtures keep their original movement.

Each guard chooses a target about every 0.75–0.9 seconds, staggered by its spawn identity. Up to six local alternatives are checked for body clearance and sight. Targets stay in the current room, use its actual geometry and obey the same swept sphere collision as navigation. A door closing after a target was chosen interrupts movement and allows another bounded decision. No lights, meshes, materials or timers are created for tactical movement.

The existing 650 ms amber warning, firing flash and 850 ms blue recovery remain stationary counterattack opportunities. Existing movement speed, health, campaign pulse damage and enemy projectile damage remain unchanged. Fighters react to the visible ship position, not its input or incoming bullets. Losing sight resumes room-graph navigation toward the last observed position; the route is rebuilt once from the dodged position to avoid backtracking to a stale starting waypoint. This is local spacing and evasion, not coordinated squad flanking or cover selection.

## Play the drill

Open **SELECT MISSION → Practice & prototypes → Fighter Proving Ground**. It is a four-room loop with two required fighters, walls for cover, a second approach through the east gallery, ammunition and repairs. The second guard begins at a different height in the north bay. Clear both, then return to the green exit in the blue sparring room.

Track the first guard's sideways/vertical movement. Amber warns that it is preparing a shot; the blue recovery is a chance to return fire. Use A/D and Space/Shift to vary your position, or the room corners to break sight. The drill uses five-damage pulse rounds, so each 25-health fighter takes five hits. It starts with 80 rounds and includes a refill; the main campaign retains its own weapon rules.

The portable authoring source is `src/js/core/levels/documents/fighter-proving-ground.v7.json`. It can be imported into the designer or My Levels using the normal file workflow. No new document format or hidden behavior flags are required. The drill is separate from built-in campaign progression.

## Verification

`npm run verify` passes lint/type checks, 485 unit/simulation tests and the production build. Added checks exercise strafing/elevation, distance control, vertical sight lines, cramped rooms, a newly closed obstruction, stationary warning/recovery, comparable 30/60/120 Hz motion, bounded planning, perception memory, pause/reset and the drill's alternate route/ammunition budget. Existing live warning/projectile/collision tests remain in the suite.

Browser flight and aiming controllers use read-only development diagnostics and ordinary keyboard input. They do not set game transforms, damage enemies, grant supplies or neutralize guards. Software-rendered functional checks and real-time hardware captures are recorded separately.

Four selected browser checks passed: mission/settings compatibility; Signal Breach warning, damage, aimed return fire, overhead flank, extraction and replay; the proving ground's strafing, height change, pause, two kills, full four-room loop, extraction and reset; and the original combat victory/death/reboot/menu flow. The proving-ground finish awarded 1,200 points and replay restored both guards, 100% shields and 80 rounds. Its test controller releases held thrust before waiting for coast, and treats completed simulation as frozen instead of waiting for residual velocity to decay. See [the check record](progress/mobile-fighter-browser-check.json), [movement checkpoint](progress/mobile-fighter-strafe.png) and [completion checkpoint](progress/mobile-fighter-cleared.png). These debug screenshots use a mocked clock; their diagnostic frame intervals are not hardware FPS measurements.

The [Deepworks hardware capture](progress/deepworks-mobile-fighters.json) uses the same real-time idle, twenty-shot and pump-fighter encounter sequence as the lighting regression capture: Intel UHD Graphics `0x00009A60`, ANGLE D3D11, headless Chromium, 1280×720 cockpit view, no mocked clock or tracing. Idle p95/worst was 16.8/33.4 ms; firing 16.7/16.8 ms; the encounter 16.8/33.4 ms. All three had zero frames over 100 ms. The guard was defeated, seven enemies fell to six, and scene lights stayed nine. This focused local regression check does not close the broader M2 performance gate or establish performance on other hardware.

## Follow-up

Next balance work should add explicit difficulty choices and tune encounters around these counterattack windows. Limited aim prediction, search/alert behavior and distinct heavy-enemy roles can follow. More health alone is not the current behavior change.
