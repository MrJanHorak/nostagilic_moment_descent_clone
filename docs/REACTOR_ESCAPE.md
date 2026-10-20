# Reactor escape

Nightfall Reactor now ends with a timed return through familiar rooms. Clear both guards, activate Coolant bypass, then reach Reactor shutdown in the upper control room. Pressing R at shutdown starts **60 simulation seconds** and opens the lower return door. Drop through the floor hatch into the lift junction, head west into arrival, and reach the green extraction ring at arrival's west side. The upper side room is now an optional repair cache, accessible before shutdown. The briefing explains the route and the consequence of arming the reactor.

The reactor control has an interlock: it cannot activate until all required drones and other required relays are clear. A blocked activation shows a message and leaves the control, doors and clock untouched. This prevents starting an escape with another objective still locking extraction. Optional enemies are not prerequisites.

The permanent **REACTOR CRITICAL · ESCAPE MM:SS** display appears in the cockpit and other views, including when H hides the optional instruments. The final ten seconds use a red text warning. Pause freezes the clock. At zero the mine is lost, the result says **REACTOR MELTDOWN**, and no extraction bonus is awarded. Entering the exit strictly before zero wins; a simulation step reaching zero fails before movement or extraction. Completion, death, reboot, replay and changing missions cannot carry a countdown into a new attempt. The clock uses no scheduled callbacks.

## Authoring

Use **Reactor escape…** in the designer's document controls. Select an existing required relay and a whole-number allowance from **10–600 seconds**. Every authored relay is already a required objective. Choose **No escape countdown** to disable it. Undo/Redo, import/export and production Playtest retain these rules. Deleting the trigger relay or its room removes the countdown; Undo restores it.

Connect a return gate to the trigger relay using the existing door controls, place extraction along the return route, and allow the player to explore that route before arming the reactor. The timer does not create doors or move an exit automatically. Provide a generous initial allowance, then tune with player feedback. Nightfall uses a 60-second allowance with no requirement to enter lava or water.

This opts the document into **format 10** with optional `mission.escape`:

```json
"escape": { "triggerDeviceId": "relay-reactor", "durationSeconds": 60 }
```

Versions 1–9 reject the field. A v10 document without it plays as an ordinary untimed mission. The trigger must identify a required relay. Validation also considers the interlock when solving progression: placing a required relay or guard behind a door that only the reactor can open is invalid. It checks geometric progression, not a guaranteed completion time or ammunition budget. Runtime deadlines, failure flags and remaining time never enter exported JSON.

This pass uses the existing relay interaction to initiate reactor failure. It does not introduce a destructible reactor combat entity, voice countdown, continuous siren or scripted room destruction. The warning, exit gate and failure deadline are functional gameplay systems; those additional presentation/combat elements can follow separately.

## Verification

`npm run verify` passes: 72 linted runtime modules, strict types, all 440 unit/simulation cases and the production build. New cases cover exact expiry boundaries, prerequisite interlocks, duplicate activation, pause, completed/dead runs, restart, gate reconstruction, no stale callbacks, version gates, editor history and invalid prerequisite placement.

Four targeted browser scenarios pass across completed runs: the Nightfall return route/map and replay; production editor import/export, HUD-hidden countdown, pause, timeout/reboot and successful native-input escape; existing cockpit controls; and the production combat/extraction/death/reboot flow. See the [verification record](progress/reactor-escape-browser-check.json), reviewed [countdown and map](progress/reactor-escape-map.png), [Nightfall extraction](progress/reactor-escape-complete.png), [HUD-hidden cockpit timer](progress/reactor-countdown-cockpit.png), and [meltdown result](progress/reactor-meltdown.png). The Nightfall route check isolates progression by neutralizing guards through the labeled development control; the production scenarios use ordinary input. These are functional checks, with no new hardware frame-time acceptance claimed.
