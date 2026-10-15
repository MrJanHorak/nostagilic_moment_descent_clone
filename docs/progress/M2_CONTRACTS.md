# M2 lint and type contracts checkpoint

Implemented October 15, 2026, following [saved control settings](M2_SETTINGS.md).

## Delivered

`npm run verify` now runs lint, strict type checking, the 106 unit/simulation/metrics regressions, and the production build in order. The existing Windows/Ubuntu CI jobs use that same command, so a contract failure stops verification before the browser checks. Hosted execution remains pending a push.

The runtime stays in JavaScript. JSDoc describes its interfaces; TypeScript checks them with `allowJs`, `checkJs`, `strict` and `noEmit`. Shared declarations live in `src/js/contracts.d.ts`. No compiler or lint code is imported into the game.

The initial scope is deliberately small:

| Checked runtime module | Contract covered |
| --- | --- |
| `core/GameSession.js` | Finite phase names, timer IDs, callbacks and simulation time |
| `core/SimulationStepper.js` | Numeric deltas, bounded stepping and callback stop signal |
| `core/UserSettings.js` | Immutable snapshots, storage port, saving status and untrusted preference input |
| `core/MissionObjective.js` | Immutable mission inputs, combat defeat causes and exit vectors |
| `utils/combatTrace.js` | Box/sphere inputs, collider wrappers and distinct wall/enemy/player hit types |
| `utils/sphereMovement.js` | World vectors, static colliders, delta and player radius |
| `ui/SettingsDialog.js` | Settings controller, dialog lifecycle, DOM controls and focus restoration |

`tsconfig.check.json` lists the checked files. The lint runner reads its JavaScript entries so these two source scopes stay aligned; it also lints its own runner and configuration. ESLint recommended rules catch issues such as undefined names and unused variables. Warnings fail the command. This checkpoint adds no formatting policy.

`tests/types/contracts.ts` contains valid consumer examples and **15 expected compile-time errors**. They cover invalid phases, timer/simulation inputs, mutable preference/mission snapshots, incomplete storage/controllers, cleanup counted as a combat defeat, malformed exit coordinates, incompatible shot targets and movement/collider inputs. The compiler must reject each marked line; an unexpectedly accepted example fails verification. Enemy hit results preserve the caller's target type while player/wall results remain distinct. These examples are compiled only and are not executed as gameplay tests.

## Small runtime changes

The simulation accumulator is initialized explicitly in its constructor. Preferences are treated as unknown data and narrowed before property access; existing type/bounds/version checks and storage failure behavior remain. The dialog verifies its owned controls, converts sensitivity to an input string explicitly, and restores focus only to focusable HTML/SVG elements. Collision helpers explicitly distinguish a box from a wrapper containing a box, and shot candidates carry their matching hit kind and target together. Collision order, wall tie priority, movement budgets and mission scoring rules are preserved by the existing regressions.

## Verification

- Clean lockfile installation and `npm run verify` pass on Windows under Node **24.22.0** / npm **11.21.1**. Verification also passed on the existing Node **22.14.0** / npm **11.2.0**.
- Lint passes for seven runtime modules and two tooling files. Strict type checking passes, including all 15 negative consumer examples. There are no blanket `any`, `@ts-ignore` or source-file check suppressions in this scope. Vendor declaration bodies use `skipLibCheck`; application code remains checked against their exported types.
- All **106** unit/simulation/metrics tests pass. The production build passes at approximately **655.91 kB** minified / **165.90 kB** gzip, retaining the existing chunk-size warning.
- The added development dependencies are pinned: TypeScript **7.0.2**, matching Three.js declarations **0.176.0**, ESLint **10.12.0**, `@eslint/js` **10.0.1**, and `globals` **17.13.0**. Existing locked package versions and all 50 existing esbuild/Rollup platform packages are preserved.
- The dependency audit reports **zero known vulnerabilities**, including development tools; see [audit evidence](contracts-dependency-audit.json). This is an October 15 snapshot.

All **four browser checks pass in one complete run**; see the [browser evidence](contracts-browser-check.json). They cover the production mission/restart flow, development ten-restart resource fixture and production settings/storage cases. Page/console/asset-request errors remain zero. After warm-up, ten measured restarts return resources to baseline. These browser checks use software rendering and do not establish a new GPU performance result or native mouse acceptance.

## Limits and next steps

This is an initial source-contract baseline, not completion of M2 cleanup. `Game`, `GameState`, `InputManager`, `Spaceship`, entity managers, rendering, metrics, level factories and legacy content are outside this checked scope. A typed helper does not check calls from excluded JavaScript. Expand the scope one boundary at a time, with consumer examples and existing regressions, rather than weakening the compiler to cover the entire repository at once.

The mission interface describes an in-memory input. It is not M3's versioned JSON document, runtime schema validation or editor format. Those still require a shared loader, semantic validation and round-trip checks before designer work.

The next usability checkpoint is saved volume/mute controls. Continue source contracts into active player/projectile/enemy ownership and remove confirmed unused code in separate changes. M1 still needs [hands-on acceptance](../M1_ACCEPTANCE.md). Hosted CI and performance acceptance remain open; the last measured Intel GPU frame p95 was around 18 ms against the provisional 16.7 ms target. M2 is not complete.
