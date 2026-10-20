# Relay force fields

Vector Foundry now has a cyan force field across the lower lift hatch. Activate **Lift field control** with **R** in the upper works, then climb through the cleared hatch with Space. The extraction gate remains a sliding door.

Active fields block player and enemy bodies, absorb player and enemy projectiles, and block AI sight and relay interaction through the membrane. They deal no contact damage and do not reflect shots. Shooting spends ammunition without opening them. A linked relay disables the entire barrier immediately, clearing its collider and navigation lock together. Fields stay disabled until the next attempt.

The translucent double-sided membrane uses a procedural lattice, moving scan bands, bright edge rails and repeated emitters. The same geometry supports walls and floor/ceiling hatches. Shimmer follows simulation time, so pausing freezes it. Each attempt owns and disposes its geometry/materials; no textures, external assets, extra lights or scheduled callbacks are needed.

The cockpit survey and **M** map show a pair of cyan bars at discovered field boundaries and a diamond at their control. The enlarged map labels the control. Markers become green after shutdown. Boundaries are revealed from either visited neighboring room; a control appears only after its own room has been visited. Unvisited room outlines remain hidden.

## Authoring

Select a connection in the editor's Wall tab or right-click its passage, then choose **Add or edit door…**. Under **Door appearance**, choose **Force field (relay controlled)**. Select an existing relay or **Create relay near player spawn**, then Apply door. Shot activation and concealment are rejected for fields. Selecting Marked door or Concealed wall panel converts the field back to a sliding door.

Fields use format **11**, retaining all earlier geometry, surface and reactor features. Their entry in `doors` contains `kind: "force-field"`, a `connectionId`, and a `deviceId`. Omitting `kind` retains normal door behavior. Formats 1–10 reject the new field. Relay progression validation rejects a control trapped behind its own field. Undo/Redo, JSON export/import and embedded playtest use the shared document/compiler.

## Verification

Simulation coverage includes all six doorway directions, both traversal directions, rendered membrane alignment, projectile absorption without damage behind the field, navigation unlocking, inaccessible controls, pause, stale sessions, fresh attempts, editor transactions, reactor compatibility and map discovery/state. Browser evidence is recorded in [the progress record](progress/force-field-browser-check.json).

Final verification passes: **452 tests**, 73 linted runtime modules, strict types, production build and diff checks. Four targeted browser scenarios pass across completed runs: field authoring/native collision/shutdown/extraction, the campaign lift route and replay, concealed shot doors, and reactor authoring/timeout/reboot/escape. Reviewed [cockpit field](progress/force-field-cockpit.png), [map markers](progress/force-field-map.png) and [disabled passage](progress/force-field-disabled.png). Vector Foundry’s route check isolates progression with the existing development neutralize action; the production custom mission uses ordinary inputs.
