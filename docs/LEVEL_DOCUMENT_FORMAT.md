# Shared level document — format version 1

Implemented October 15, 2026. The executable validator and [TypeScript interfaces](../src/js/levelDocument.d.ts) define this format. The earlier example in [the designer proposal](LEVEL_EDITOR_DESIGN.md) is a design sketch, not a compatible v1 file.

The game now loads [mine-link.v1.json](../src/js/core/levels/documents/mine-link.v1.json) as **Select Level → Mine Link Prototype**. It uses five rooms, a horizontal loop, a vertical hatch, two drones, health/ammo and a clear-and-exit objective. The accepted Flight Arena and Arena Escape definitions remain available.

## Document contents

All fields below are required. Unknown fields are errors, including runtime health, spawned flags, callbacks or asset URLs. Root and placement objects are JSON data only.

| Field | Contents |
| --- | --- |
| `formatVersion` | Literal `1`; unsupported versions are rejected without migration |
| `id`, `name` | Stable document identity and display name |
| `rooms` | Room/prefab definitions |
| `connections` | Pairs of centered named face ports and an opening size |
| `playerSpawn` | `roomId`, room-local `position`, normalized local quaternion `rotation` |
| `entities` | Enemy, pickup and exit placements, with stable IDs and room-local positions |
| `mission` | `{type: "clear-and-exit", requiredEnemyIds: [...], exitId: "..."}` |
| `combat` | Numeric `pulseDamage`, integer `initialPulseAmmo`, integer `maxPulseAmmo` |

The document ID, room IDs, connection IDs and entity IDs share one unique namespace. IDs contain 1–64 ASCII letters/digits/colon/underscore/hyphen and begin with a letter. Names contain 1–80 trimmed UTF-16 code units. Array order is preserved by export; IDs do not depend on array indices.

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

The geometric guarantee is deliberately bounded: v1 consists of empty convex room shells connected by unobstructed openings. It has no authored obstacles, doors, keys or arbitrary scripts. Graph reachability is not a combat-fairness or ammo-budget proof. Enemy navigation still uses existing visibility/local pursuit and the legacy 5–50-unit spawn/removal window; revisiting a distant undefeated enemy can restore its initial health. Persistent activation, room-graph routing and richer objectives remain M3 work before expanding the mine.

Pulse damage is 1–100; ammo values are integers up to 2,000, capacity is positive, and initial ammo cannot exceed capacity. Pulse-only encounter rules, session-owned cooldowns/objectives and restart behavior are reused.

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
