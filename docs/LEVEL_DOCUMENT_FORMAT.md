# Shared level document — format versions 1, 2 and 3

Version 1 implemented October 15, 2026; version 2 added October 16 for relay-controlled doors. Version 3 adds offset openings, per-face colors/patterns and optional relay content on October 18. All three versions remain supported. The executable validator and [TypeScript interfaces](../src/js/levelDocument.d.ts) define this format. The earlier example in [the designer proposal](LEVEL_EDITOR_DESIGN.md) is a design sketch, not a compatible v1 file.

The game loads [mine-link.v1.json](../src/js/core/levels/documents/mine-link.v1.json) as **Mine Link Prototype** and [relay-gate.v2.json](../src/js/core/levels/documents/relay-gate.v2.json) as **Relay Gate Prototype**. [Deep Relay](progress/M3_DEEP_RELAY.md) is the larger eight-room mission using the same v2 format: a lower loop, supply cache, five drones and two relay gates. Room/route hints derive from stable room IDs, material presets and the validated portal graph. The accepted Flight Arena and Arena Escape definitions remain available.

## Document contents

All base fields below are required. The version-3 extension below describes its optional appearance/offset fields. Unknown fields are errors, including runtime health, spawned flags, callbacks or asset URLs. Root and placement objects are JSON data only.

| Field | Contents |
| --- | --- |
| `formatVersion` | Literal `1` for the base format, `2` for the relay extension, or `3` for the designer extension; unknown versions are rejected |
| `id`, `name` | Stable document identity and display name |
| `rooms` | Room/prefab definitions |
| `connections` | Named face ports and an opening size; v1/v2 use centered ports, v3 supports offsets |
| `playerSpawn` | `roomId`, room-local `position`, normalized local quaternion `rotation` |
| `entities` | Enemy, pickup and exit placements, with stable IDs and room-local positions |
| `mission` | `{type: "clear-and-exit", requiredEnemyIds: [...], exitId: "..."}` |
| `combat` | Numeric `pulseDamage`, integer `initialPulseAmmo`, integer `maxPulseAmmo` |

The document ID, room IDs, connection IDs entity IDs, device IDs and door IDs share one unique namespace. IDs contain 1–64 ASCII letters/digits/colon/underscore/hyphen and begin with a letter. Names contain 1–80 trimmed UTF-16 code units. Array order is preserved by export; IDs do not depend on array indices.

## Rooms, coordinates and ports

Use world units, **+Y up**, and local **-Z forward**. Room `position` is its world center. `size` is its **outer** `[x, y, z]` extent. Half-unit-thick walls sit inside those bounds; clear interior dimensions are therefore one unit smaller. Room positions/dimensions use a 0.5-unit grid.

A room has `id`, `prefab`, `position`, `size`, `yaw` and `materialPreset`. Supported prefabs are `box-room` and `straight-corridor`; both use the same rectangular shell generator. All dimensions are 4–64 units. A straight corridor additionally has local width/height at most 8 and local Z length at least its width/height.

Room `yaw` is exactly `0`, `90`, `180` or `270` degrees around +Y. For example, at yaw 90 local +Z maps to world +X and local +X maps to world -Z. Room pitch/roll and freeform vertices are not part of v1. Vertical connections use ceiling/floor ports. Player rotation is a normalized `[x,y,z,w]` quaternion relative to its room, composed with room yaw when loaded.

Local face names are `negativeX`, `positiveX`, `negativeY`, `positiveY`, `negativeZ`, `positiveZ`. Each port is centered on its face; each face supports at most one connection. Endpoint face names remain local after rotating a room. A connection's two world centers must coincide and their normals must oppose one another. Self-connections are errors.

`openingSize` has two dimensions, interpreted in a **canonical world-plane basis**:

| World normal axis | First dimension | Second dimension |
| --- | --- | --- |
| X | Z width | Y height |
| Z | X width | Y height |
| Y | X width | Z depth |

Openings are 2–62 units on the half-unit grid and must fit **both** faces with frame clearance: each dimension is at most the corresponding face dimension minus 1.5. The generator splits each connected wall into four rectangular solids around that opening. Unconnected faces stay closed. Both adjoining half-unit walls receive the same opening, producing continuous traversable space. The very same solid definitions generate visible boxes and colliders.

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

Import preserves the input version. The editor upgrades an owned draft to v3 when an operation needs offsets, face styles or flexible relay content. Undo restores the previous version and data. V1/v2 reject the new fields; use a v3-capable game build for exported v3 files.

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

There is no file-picker/import UI or editor yet. The canonical JSON is bundled by Vite and loaded by Node tests through JSON import attributes, supported by the pinned Node runtime. The exported APIs provide the boundary for that later UI. Invalid input produces paths such as `$.connections[1]` with an alignment error or `$.entities[0].position` with a clearance error. No code evaluation or remote asset loading is involved.

## Limits and compatibility

| Limit | Value |
| --- | ---: |
| Rooms / connections / entities | 64 / 128 / 256 |
| Parsed JSON text | 1,000,000 UTF-16 code units |
| Validated tree nodes / nesting depth | 50,000 / 16 |
| Reported diagnostics | 100 |
| Coordinate component magnitude | 4,096 |

Programmatic input must be a plain JSON tree. Accessors, non-enumerable/symbol properties, nonfinite numbers, sparse/extended arrays, cycles, functions and class instances are rejected. These checks do not establish a sandbox for arbitrary JavaScript proxies supplied by application code. Text input is parsed with `JSON.parse` before validation.

These are input/work bounds, not a promise that maximum-size worlds meet the reference GPU frame-time target. Future incompatible geometry/objective semantics require a new version or an explicit migration of a copy. Old executable level blueprints are retained as legacy content and are not automatically converted by this implementation.
