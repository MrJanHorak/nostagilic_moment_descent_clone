# Shared level document — format versions 1–7

Version 1 implemented October 15, 2026; version 2 added October 16 for relay-controlled doors. Version 3 adds offset openings, per-face colors/patterns and optional relay content on October 18. Version 4 adds quarter-turn pitch/roll for upright corridors and rotated rooms. Version 5 adds convex sloped/diagonal corridors. Version 6 expands room counts and dimension bounds for connection-preserving resizing. Version 7 permits full shared openings and multiple passages per wall. All seven versions remain supported. The executable validator and [TypeScript interfaces](../src/js/levelDocument.d.ts) define this format. The earlier example in [the designer proposal](LEVEL_EDITOR_DESIGN.md) is a design sketch, not a compatible v1 file.

The game loads [mine-link.v1.json](../src/js/core/levels/documents/mine-link.v1.json) as **Mine Link Prototype** and [relay-gate.v2.json](../src/js/core/levels/documents/relay-gate.v2.json) as **Relay Gate Prototype**. [Deep Relay](progress/M3_DEEP_RELAY.md) is the larger eight-room mission using the same v2 format: a lower loop, supply cache, five drones and two relay gates. Room/route hints derive from stable room IDs, material presets and the validated portal graph. The accepted Flight Arena and Arena Escape definitions remain available.

## Document contents

All base fields below are required. The version-3 extension below describes its optional appearance/offset fields. Unknown fields are errors, including runtime health, spawned flags, callbacks or asset URLs. Root and placement objects are JSON data only.

| Field | Contents |
| --- | --- |
| `formatVersion` | Literal `1` for the base format, `2` for relays, `3` for openings/styles, `4` for room orientation, `5` for shaped corridors, `6` for expanded authoring, or `7` for shared/multiple openings; unknown versions are rejected |
| `id`, `name` | Stable document identity and display name |
| `rooms` | Room/prefab definitions |
| `connections` | Named face ports and an opening size; v1/v2 use centered ports, v3 supports offsets |
| `playerSpawn` | `roomId`, room-local `position`, normalized local quaternion `rotation` |
| `entities` | Enemy, pickup and exit placements, with stable IDs and room-local positions |
| `mission` | `{type: "clear-and-exit", requiredEnemyIds: [...], exitId: "..."}` |
| `combat` | Numeric `pulseDamage`, integer `initialPulseAmmo`, integer `maxPulseAmmo` |

The document ID, room IDs, connection IDs entity IDs, device IDs and door IDs share one unique namespace. IDs contain 1–64 ASCII letters/digits/colon/underscore/hyphen and begin with a letter. Names contain 1–80 trimmed UTF-16 code units. Array order is preserved by export; IDs do not depend on array indices.

## Rooms, coordinates and ports

Use world units, **+Y up**, and local **-Z forward**. Room `position` is its world center. `size` is its **outer** `[x, y, z]` extent. Half-unit-thick walls sit inside those bounds; clear interior dimensions are therefore one unit smaller. Versions 1–5 use a 0.5-unit position/dimension grid. Version 6 retains half-unit dimensions and permits quarter-unit centers so half-unit stretches can hold one end fixed.

A room has `id`, `prefab`, `position`, `size`, `yaw` and `materialPreset`. Supported prefabs are `box-room` and `straight-corridor`; both use the same rectangular shell generator. In versions 1–5 all dimensions are 4–64 units. A straight corridor additionally has local width/height at most 8 and local Z length at least its width/height.

Room `yaw` is exactly `0`, `90`, `180` or `270` degrees around +Y. For example, at yaw 90 local +Z maps to world +X and local +X maps to world -Z. Versions 1–3 have yaw only; v4 optionally adds pitch/roll as described below. Player rotation is a normalized `[x,y,z,w]` quaternion relative to its room, composed with the complete room orientation when loaded.

Local face names are `negativeX`, `positiveX`, `negativeY`, `positiveY`, `negativeZ`, `positiveZ`. Each port is centered on its face; versions 1–6 support at most one connection per face. V7 permits up to eight non-overlapping openings on a face. Endpoint face names remain local after rotating a room. A connection's two world centers must coincide and their normals must oppose one another. Self-connections are errors.

`openingSize` has two dimensions, interpreted in a **canonical world-plane basis**:

| World normal axis | First dimension | Second dimension |
| --- | --- | --- |
| X | Z width | Y height |
| Z | X width | Y height |
| Y | X width | Z depth |

Versions 1–5 openings are 2–62 units on the half-unit grid and must fit **both** faces with frame clearance: each dimension is at most the corresponding face dimension minus 1.5. The generator splits each connected wall into four rectangular solids around that opening. Unconnected faces stay closed. Both adjoining half-unit walls receive the same opening, producing continuous traversable space. The very same solid definitions generate visible boxes and colliders.

## Content, placement and objectives

- Enemies use the actual five `EnemyTypes` names. The authoring clearance sphere is conservatively `4 × definition.size`; regression tests check every model's collision envelope against it. This is an authoring margin, not a change to its gameplay collider.
- Pickups are `health` and `pulseAmmo`. Model name/size/color come from metadata shared with actual pickup creation. Unfinished weapon pickups are excluded from v1.
- An exit has `kind: "exit"` and a numeric `radius` from 0.75–4. Its placement reserves an additional 0.6 units for the decorative ring/pointers. Exactly one exit is required; `mission.exitId` must identify it.
- Every entity has `id`, `roomId` and a finite room-local `position`. Enemies/pickups add `type`. Unknown properties are rejected.

All placement clearance spheres must fit inside their room's clear interior and must not overlap one another or the player spawn. Player clearance uses the actual shared radius 0.5. Room volumes cannot overlap, though faces can touch. All rooms must be graph-reachable from the spawn through valid connections. Required IDs must uniquely reference enemies; empty required lists support an extraction-only fixture.

The geometric guarantee is deliberately bounded: v1 consists of empty convex room shells connected by unobstructed openings. It has no authored obstacles, doors, keys or arbitrary scripts. Graph reachability is not a combat-fairness or ammo-budget proof. JSON mine enemies now remain resident for the session and preserve health, position and firing cooldowns across revisits. They route through the shared room/portal graph, filtering passages by actual body clearance, and pursue remembered sightings or damage alerts without tracking hidden movement. An enemy with no body-clear route waits; player reachability does not imply every enemy fits every passage. See the [navigation checkpoint](progress/M3_ROOM_NAVIGATION.md). Version 2 adds the bounded relay/door extension below; the larger authored mission and human acceptance remain M3 work.

Pulse damage is 1–100; ammo values are integers up to 2,000, capacity is positive, and initial ammo cannot exceed capacity. Pulse-only encounter rules, session-owned cooldowns/objectives and restart behavior are reused.

## Version 2: relay-controlled doors

Version 2 keeps the same rooms, ports, entities, spawn and combat fields. It requires two additional root arrays, each with **1–16** entries:

```json
{
  "devices": [
    { "id": "relay:ceiling", "label": "Ceiling hatch relay", "roomId": "return", "position": [3, 0, 3] }
  ],
  "doors": [
    { "id": "door:ceiling", "connectionId": "return-upper", "deviceId": "relay:ceiling" }
  ],
  "mission": {
    "type": "relay-clear-and-exit",
    "requiredEnemyIds": ["mine:fighter", "mine:scout"],
    "requiredDeviceIds": ["relay:ceiling"],
    "exitId": "mine:exit"
  }
}
```

This is an extension fragment; see [the complete v2 sample](../src/js/core/levels/documents/relay-gate.v2.json). Labels are 1–40 trimmed UTF-16 code units. Device positions reserve a 0.75-unit clearance radius inside their room, with no initial overlaps. Every device must appear exactly once in `requiredDeviceIds`; IDs must reference devices. Doors require valid connection/device references, unique IDs and at most one door per connection. One relay can open multiple doors. All doors begin closed and open permanently on activation until restart.

The validator repeatedly finds rooms reachable through currently open connections and activates accessible relays in its abstract progression model. A self-locked relay, an unbootstrappable lock cycle or any room still inaccessible is an error with code `locked-route`. This is geometric progression validation, not a combat or ammo-budget proof.

Closed doors fill the complete portal thickness and block bodies, shots, visibility and interaction. Press **R** within 2.5 units of a visible inactive cyan relay to activate it. Pause, settings and terminal/session guards apply. Activating a relay hides linked doors and removes their colliders, updates enemy routing and records one objective event; all required drones and devices must be handled before extraction. Beacons turn green. Runtime activated/open flags and navigation revisions are excluded from JSON.

V1 remains strict: `devices`, `doors` and relay mission fields are rejected on a version-1 file. Loading/export does not silently upgrade it. To author a relay level, deliberately create a version-2 copy with the required lists and mission. Future incompatible behavior requires another version or explicit migration.

## Version 3: designer openings and surfaces

V3 uses the v2 root structure and `relay-clear-and-exit` mission. `devices`, `doors` and `requiredDeviceIds` remain explicit arrays, but may be empty. This permits an extraction-only level, independent relay objectives, and removing the last relay/door while authoring. V2 retains its original 1–16 device/door requirement. All existing ID, placement, progression and count checks still apply.

Each connection endpoint may have an optional `offset: [u, v]`, defaulting to `[0, 0]`. The basis is the same canonical **world-plane** basis as `openingSize`, including rotated rooms and floor/ceiling hatches. Offsets are finite half-unit values between -32 and 32. They are relative to each endpoint's face center; the two offset opening centers must coincide, with opposing normals. The centers of the full room faces may differ along the wall plane. Rooms still cannot overlap.

```json
{
  "id": "high-passage",
  "a": { "roomId": "bay", "port": "negativeZ", "offset": [4, 2] },
  "b": { "roomId": "corridor", "port": "positiveZ", "offset": [0, 0] },
  "openingSize": [6, 6]
}
```

This is a fragment: it fits a bay at `[0,0,0]` of size `[16,12,16]` and an `[8,8,16]` corridor at `[4,2,-16]`, both yaw 0. The opening is high and right in the bay and centered in the narrower corridor. For each endpoint, `abs(offset) + openingDimension / 2` must be at most `faceDimension / 2 - 0.75` on both plane axes. The wall splits, door mesh/collider, shots, player collision and enemy navigation all use this same opening frame. Moving an opening does not create an extra centered hole.

Rooms may also have a `surfaces` object keyed by local face name. Omitted faces retain `materialPreset`; each override requires an RGB integer color from 0 to 16777215 and one pattern from `plain`, `grid`, `panels`, `hazard`:

```json
{
  "negativeZ": { "color": 11933488, "pattern": "panels" },
  "negativeY": { "color": 4213355, "pattern": "grid" }
}
```

This is the value of `room.surfaces`, not a complete room. Patterns are small, deterministic local textures repeating every four world units, with continuous world-plane UVs across split wall pieces. They do not change collision. The world owns and disposes its textures. Image URLs, uploaded images, shader code and extra appearance properties are not accepted in this version.

Import preserves the input version. The editor upgrades an owned legacy draft to v3 when an operation needs offsets, face styles or flexible relay content, and preserves an existing v4 draft. Undo restores the previous version and data. V1/v2 reject the new fields; use a compatible game build for exported files.

## Version 4: room pitch and roll

V4 keeps the entire v3 root/mission structure, including explicit (possibly empty) device/door arrays. Rooms may additionally contain `pitch` and `roll`, each exactly `0`, `90`, `180` or `270` degrees; omission means zero. `yaw` remains required. V1–3 reject these fields, including explicit zero, rather than silently ignoring orientation.

Orientation uses Three.js Euler order `YXZ`: apply local roll about Z, then pitch about X, then yaw about Y. Equivalently, `Qroom = Qyaw × Qpitch × Qroll`, and `Qspawn = Qroom × QlocalSpawn`. Local dimensions, placements, surface keys and endpoint face names stay local. World bounds/normals, opening planes, preview picking and navigation use the full orientation. Exact signed coordinate permutations retain snapped planes and axis-aligned collision without floating-point cracks.

For example, a corridor with size `[8,8,16]`, pitch `90`, yaw `0` and center `[0,-14,0]` extends vertically from Y=-22 to Y=-6. Its local `negativeZ` end faces up; `positiveZ` faces down. It attaches to the floor of the starter `[16,12,16]` room at `[0,0,0]`. Its width/height remain its local X/Y dimensions; the size constraints do not change when tipped upright.

The designer automatically orients attached corridors along the chosen world face normal, including floors/ceilings. This creates one atomic undo command and upgrades the draft to v4 only when needed. Numeric Pitch (X)/Roll (Z) and the XYZ rotation gizmo use quarter turns. Applying unchanged zero controls preserves a legacy file's version. Subsequent style/relay/offset edits never downgrade v4. Undo and structural draft recovery retain orientation.

V4 retains rectangular shells. V5 adds the bounded sloped/diagonal extension below; arbitrary vertex editing remains unsupported.

## Version 5: convex sloped/diagonal corridors

V5 keeps v4 fields and adds prefab `offset-corridor`. It requires `endOffset: [sideways, rise]`, two whole-unit values from -32 through 32. Their combined Euclidean distance cannot exceed local Z length; the centerline slope is at most 45 degrees. Width/height are 4–8; length is 4–64 and at least the width/height. Other prefabs reject `endOffset`; v1–4 reject the new prefab/field.

For local coordinates `[x,y,z]`, let `[dx,dy] = endOffset` and `L = size[2]`. Before quarter-turn orientation/translation the point is `[x - dx*z/L, y - dy*z/L, z]`. Local -Z is the far/forward end, so a positive rise raises it relative to +Z. Size describes the unsheared cross-section and length; position is the midpoint of the two end centers. For example, an `[8,8,16]` corridor at `[4,4,-16]` with yaw 0 and `endOffset: [8,8]` has end centers `[0,0,-8]` and `[8,8,-24]`.

Only local `negativeZ`/`positiveZ` faces accept connections. They remain rectangular and axis-aligned after the existing quarter-turn orientation, so endpoint offsets, opening sizes and relay doors retain the v3 rules. Side faces are sloped/diagonal solid parallelograms with independent styles. Local wall thickness is still 0.5 before shear; its perpendicular thickness changes with slope. Perpendicular body clearance uses the actual planes, not just local coordinate bounds.

All eight corners of each solid wall panel are compiled as shared vertices for rendering/convex collision. Room overlap uses actual convex volumes; navigation and picking invert the shear as well as the orthogonal orientation. Placements remain in cross-section coordinates relative to the centerline. The shared convex solver preserves rounded sphere edge/corner contacts and bounded sliding. Shots use actual hull planes with the existing small conservative radius expansion.

Import/export, styles, relay edits, rotation, duplication, undo/redo and structurally safe draft recovery preserve v5. Initial shaped attachment upgrades an owned legacy draft atomically; it never edits an imported file in place. See [the authoring and verification checkpoint](progress/M4_SHAPED_CORRIDORS.md).

## Validation, snapshots and loading

The shared modules live under `src/js/core/levels/document/`:

```js
import { parseLevelDocument, validateLevelDocument, serializeLevelDocument }
  from './src/js/core/levels/document/validateLevelDocument.js';
import compileLevelDocument, { prepareLevelDocument }
  from './src/js/core/levels/document/compileLevelDocument.js';

const result = validateLevelDocument(unknownData);
if (!result.valid) console.log(result.errors); // {path, code, message}[]
const document = parseLevelDocument(jsonText); // throws LevelDocumentError
const exportedText = serializeLevelDocument(document);
const definition = compileLevelDocument(document); // runtime vectors, no meshes
const candidate = prepareLevelDocument(document); // detached world, caller owns it
```

Validation creates an owned, deeply frozen JSON snapshot. It never freezes or edits the caller's editing document. Serialization validates again and emits a deterministic two-space JSON representation with a final newline. It preserves authored ordering, not arbitrary input property order. Runtime vectors, scene objects and mutable session state appear only in the adapter/session, never in the exported document.

`Game.startLevelDocument(unknownData)` validates, compiles and constructs a detached candidate **before** ending the current run. Invalid data and candidate-construction failures preserve that run and its catalog. A successful handoff reuses one imported catalog slot, starts through the normal session path and supports restart. Once mounting begins, failures use normal error-session recovery and release claimed resources; the old run is not restored at that later stage. Unclaimed candidate resources are released by the caller's cleanup path. Direct users of `prepareLevelDocument` must likewise mount/claim or dispose their candidate.

The separate `/editor.html` entry provides JSON file import/export and playtest through these APIs. Canonical samples are also bundled by Vite and loaded by Node tests through JSON import attributes. Invalid input produces paths such as `$.connections[1]` with an alignment error or `$.entities[0].position` with a clearance error. No code evaluation or remote asset loading is involved.

## Version 6: expanded authoring and connected resizing

V6 retains all v5 fields and geometry. It raises the room/connection limits to **256/512**; entities remain capped at 256. Every prefab accepts local width, height and length from **4–256**, on the half-unit grid. The old corridor cross-section/aspect restrictions no longer apply. Room centers use a quarter-unit grid, with the unchanged ±4096 component bound. Openings are 2–254 on the half-unit grid; endpoint offsets allow ±128. Shaped end offsets are whole units within ±256 and their combined distance still cannot exceed local Z length (45° maximum centerline slope).

These are authoring bounds, not unlimited streaming or a hardware-performance guarantee. Empty space between pieces remains closed unless a connection explicitly cuts matching openings. Overlap remains invalid.

The editor opts into v6 on a successful Stretch/Resize command, numeric dimension edit, or attachment/duplication beyond 64 rooms (connections beyond 128 also opt in). Import preserves versions 1–5 and their original validation rules. Later style/orientation/relay edits retain v6; undo restores the exact previous document/version. No editing metadata enters JSON.

Resizing holds the chosen opening's world center fixed (default: first connection), translates attached branches to keep every opening aligned, and keeps content in the resized piece at its previous world position. Translated neighbors carry their own local content. A center anchor is also available. End offsets, opening offsets/dimensions, face styles and door/relay links are retained. Contradictory loop constraints, overlap, wall/placement clearance failures and out-of-range positions reject the entire command without changing history. The separate **Snap connections** command repairs an existing displaced/center-resized draft, holding its first connected neighbor fixed and carrying content with translated pieces. It does not invent new connections or resolve incompatible orientations/loops.

Validation and editor overlap highlights use cached world bounds and a sweep before the existing exact convex intersection test. See [the authoring checkpoint](progress/M4_CONNECTED_RESIZING.md).

## Version 7: shared faces and multiple wall openings

V7 keeps the v6 room/mission fields and caps. Opening dimensions are 2–255 and endpoint offsets remain within ±128; both use an eighth-unit grid. This represents exact centers of partially overlapping quarter-grid wall rectangles. Room sizes stay half-unit and centers quarter-unit. Each endpoint opening must fit the clear face with the physical 0.5-unit wall margin, without the older extra 0.25 authoring rim. A full shared opening removes the mutual clear rectangle, retaining side-wall/floor/ceiling thickness.

Up to eight separate openings may reference one face. Their U/V rectangles cannot overlap. Wall compilation subtracts all holes, preserving solids between/outside them; rectangular sloped-corridor end caps use the same decomposition. Door slabs and navigation continue to derive from each connection's exact center/size. Room volumes must remain non-overlapping and endpoint planes/normals must still meet/oppose. This is not a geometric union of intersecting rooms.

The editor's join command can keep touching faces in place, translate a separate branch, or fit an anchored corridor's free end to a fixed target before adding the connection. New shared joins, full-opening fitting and additional same-wall attachments opt into v7. Later edits preserve it; imports of older versions and Undo retain their original contracts. See [the workflow and verification](progress/M4_LOOPS_AND_SHARED_OPENINGS.md).

## Limits and compatibility

| Limit | Value |
| --- | ---: |
| Rooms / connections / entities, v1–5 | 64 / 128 / 256 |
| Rooms / connections / entities, v6–7 | 256 / 512 / 256 |
| Parsed JSON text | 1,000,000 UTF-16 code units |
| Validated tree nodes / nesting depth | 50,000 / 16 |
| Connections per face, v1–6 / v7 | 1 / 8 |
| Reported diagnostics | 100 |
| Coordinate component magnitude | 4,096 |

Programmatic input must be a plain JSON tree. Accessors, non-enumerable/symbol properties, nonfinite numbers, sparse/extended arrays, cycles, functions and class instances are rejected. These checks do not establish a sandbox for arbitrary JavaScript proxies supplied by application code. Text input is parsed with `JSON.parse` before validation.

These are input/work bounds, not a promise that maximum-size worlds meet the reference GPU frame-time target. Future incompatible geometry/objective semantics require a new version or an explicit migration of a copy. Old executable level blueprints are retained as legacy content and are not automatically converted by this implementation.
