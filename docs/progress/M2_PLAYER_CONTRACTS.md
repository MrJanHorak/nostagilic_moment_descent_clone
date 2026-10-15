# M2 player and input contracts checkpoint

> Follow-up: [projectile contracts and ownership](M2_PROJECTILE_CONTRACTS.md) expand checking to fourteen runtime modules, with 118 runtime tests and 51 negative compiler examples. Counts below record the earlier player/input checkpoint.

Implemented October 15, 2026, after the owner's [M1 Chrome acceptance](../M1_ACCEPTANCE.md).

## Delivered

Scoped lint and strict JSDoc checking now cover **eleven runtime modules**, up from seven. The added modules are `GameState`, `InputManager`, `Spaceship` and their shared `effectsUtils` dependency. Existing session, settings, objective, collision and trace modules remain checked. The lint runner automatically follows the JavaScript entries in `tsconfig.check.json`, and CI continues to use `npm run verify`.

The checked interfaces cover:

- Physical keyboard codes and numeric mouse deltas, including existing vendor mouse fields and native DOM event compatibility.
- Optional boolean flight inputs, numeric movement/rotation arguments and mounting a real camera on the authoritative player root.
- Supported weapon/enemy names, inventory ammunition, tracked unlock pickups, and the two allowed timed modifiers.
- Explicit input collaborators for firing, pause, capture release, settings and feedback; state collaborators for audio, HUD, death and completion.
- Presentation callbacks returning a completion boolean, typed scene/particle inputs, and shake resting positions separate from gameplay pose.

`tests/types/player-contracts.ts` exercises the actual checked classes with valid collaborator implementations and **18 new expected compiler rejections**. Together with the prior fixture there are **35** negative examples. Misspelled movement flags, numeric thrust flags, string ammo/damage, unsupported weapon names, arbitrary timed-state writes, incorrect animation returns and incomplete action ports now fail checking in this scope.

## Small runtime changes

State fields and nullable collaborators are initialized explicitly in the constructor, so normal use does not depend on the compiler inferring assignments inside a reset call. Constructor/reset paths share fresh inventory and statistic factories. Reset values remain health 100, score 0, multipliers 1, pulse selected, and the original default inventory; Arena Escape still applies its authored 40-round loadout during session startup.

References are assigned explicitly against their declared interfaces. Refreshing a timed modifier cancels an existing timer only when one exists. Input capture state and the error-message timestamp also have explicit initial values.

Two setup edge cases were fixed while establishing the nullable contracts:

1. With no canvas attached, both `document.pointerLockElement` and the input canvas could be null, causing a capture request to report success. It now follows the existing unavailable-capture path and returns false.
2. An active input fixture could invoke firing/pause or collision feedback before its collaborators were attached. Optional dependencies are now guarded, including an absent flash callback, while the fully attached game retains its normal behavior.

Movement constants, quaternion turn order, damping, simulation timing, collision algorithms, shot ordering, mission rules and audio preferences are unchanged. The existing flight/combat regressions remain the behavioral checks for the accepted M1 slice.

## Verification

`npm run verify` passes on Windows under the pinned **Node 24.22.0 / npm 11.21.1** toolchain and the existing **Node 22.14.0 / npm 11.2.0**. This includes lint for eleven runtime modules plus two tooling files, strict checks with 35 negative examples, **114 unit/simulation/metrics tests**, and the production build. Compiler file enumeration confirms that these eleven application modules are checked; this is not a claim of whole-repository coverage.

The two added runtime cases verify unattached-canvas capture failure and safe input before collaborator attachment. Existing tests cover constructor/session defaults, locked/unlocked input, stale capture promises, pause/focus loss, local/inverted movement, 30/60/120 Hz agreement, shake isolation, modifier refresh/expiry, damage, restart and the complete mission loop.

Production output is approximately **658.55 kB** minified / **166.47 kB** gzip. The existing chunk-size warning remains. No dependency or lockfile changes were required; the last [audit snapshot](contracts-dependency-audit.json) is retained rather than presented as a new audit.

All **six browser cases pass in one complete run**, with zero page/console/asset-request errors; see [the player-contract browser evidence](player-contracts-browser-check.json). They cover production victory/loss/replay, ten measured restarts returning resources to baseline after warm-up, settings focus/persistence/storage failure, mixer ownership and unavailable audio. These software-rendered checks do not establish a new native mouse playthrough or GPU timing result. The owner's recorded M1 acceptance remains complete.

## Remaining M2 work

The main game orchestrator, UI/audio implementations, entity managers, metrics, level factories and legacy content remain outside the checked scope. Their narrow collaborator interfaces are checked here, but this does not statically verify every implementation or every call from excluded JavaScript. In particular, `PlayerFire` specifies the player-to-firing boundary; it does not yet check `ProjectileManager` internals.

Next, extend the projectile/enemy contracts and resource ownership, then remove confirmed unused code in small changes. M3 still needs a versioned, validated shared level document and connected-room mission before the designer UI. Hosted CI and M2 performance acceptance remain open: the last Intel GPU frame p95 was around 18 ms against the provisional 16.7 ms target. M2 is not complete.
