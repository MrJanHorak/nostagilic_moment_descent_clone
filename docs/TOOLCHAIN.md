# Runtime, dependencies and verification

Updated October 22, 2026. Versions below come from repository configuration; they are the project's pinned baseline, not a claim about the newest upstream releases.

- Node **24.22.0**: `.nvmrc` and Netlify configuration.
- npm **11.21.1**: `package.json` and Netlify configuration. CI explicitly installs the declared version; `packageManager` alone does not select a local installation.
- Declared compatibility: Node `^22.14.0 || ^24.0.0`, npm `>=11.2.0 <12`. Prefer the pinned baseline for reproducible checks.
- Three.js **0.176.0**, Vite **6.4.4**, Playwright Test **1.64.1**; TypeScript **7.0.2**, `@types/three` **0.176.0**, ESLint **10.12.0**, `@eslint/js` **10.0.1**, `globals` **17.13.0**. Only Three.js is a production dependency. Exact versions and the lockfile are authoritative.

## Local setup

Select the pinned Node version using your normal installer/version manager, then:

```sh
npm install --global npm@11.21.1
npm ci --no-audit
npm run verify
npm run audit:deps
npm run browser:install
npm run test:browser
```

`npm ci` replaces `node_modules` from the lockfile and fails on manifest/lock mismatch. Preserve optional platform dependencies: Rollup/esbuild require matching native binaries. `.npmrc` preserves exact saved versions and enforces engine constraints.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Game and `/editor.html` |
| `npm run smoke` | Development diagnostics on port 5183 |
| `npm run build` then `npm run preview -- --host 127.0.0.1` | Production preview |
| `npm run verify` | Scoped lint, strict JSDoc types, unit/simulation regressions and production build; stops on failure |
| `npm run audit:deps` | Audit locked production/development dependencies, failing at moderate severity or above |
| `npm run test:browser` | Production build plus all configured Playwright projects |
| `npm run profile:arena` | Repeated warmed arena hardware captures |
| `npm run profile:deepworks -- --renderer=hardware` | Deepworks idle, firing and encounter captures |

The October 22 salvage/weapon pass passed 83 runtime modules plus two lint tooling files, strict types, all 507 unit/simulation tests and the production build. `tsconfig.check.json` declares source coverage; lint uses that same JS list. These checks do not cover every source module. The existing large-chunk advisory remains. `npm run test:salvage` runs the focused salvage/weapon cases, also included in `npm test`.

## Browser checks and hardware profiling

`playwright.config.js` declares `production`, `prototypes`, `deep-relay` and `encounters` projects. The encounters group owns Crossfire Relay's two approaches and the mobile-fighter drill; the production group collects cases outside the explicitly matched flight/encounter groups. Each case belongs to one project. Test discovery grows with files; old nine-case counts are historical. After building, a focused run can use `npx playwright test tests/browser/fighter-movement.spec.js --project=encounters`.

Playwright owns production preview on 5184 and the diagnostic server on 5183. Keep source/build stable during runs. Functional checks use Chromium/SwiftShader at 960×540; many flight/combat cases use a controlled application clock and ordinary keyboard input. These establish behavior, not hardware FPS. `BROWSER_CPU_SLOWDOWN=4` exercises CPU throttling where the harness supports it.

Hardware profilers own port 5185, use real time at 1280×720 and verify the actual renderer. See [arena profiling](progress/M2_PERFORMANCE.md), [Deepworks combat performance](DEEPWORKS_COMBAT_PERFORMANCE.md) and [the latest fighter capture](FIGHTER_MOVEMENT.md#verification). Focused captures do not close broader M2 acceptance. See [the handoff](progress/NEXT_SESSION.md#verification-available) for dated browser/hardware evidence, including the completed Crossfire checks. In a restricted execution sandbox, local socket access can prevent Playwright from reaching its own servers; that October 22 startup problem was resolved using escalated execution, without changing game or server behavior.

## CI and hosting

`.github/workflows/verify.yml` runs on pushes, pull requests and manual dispatch, on Ubuntu and Windows. Each OS has a contracts/tests/build/audit job. Four separate browser jobs per OS depend on verification; each clean-installs, builds, installs Chromium/platform dependencies and runs one Playwright project. Browser jobs have a 20-minute limit and a 15-minute suite deadline, retain reports for seven days, and use read-only repository permissions. The workflow does not deploy. Inspect group durations before adding more long scenarios.

The owner reported hosted CI passing October 18, superseding earlier pending-run statements. That confirmation does not establish a hosted pass for every later revision. Historical failure investigations remain in [CI reliability](progress/M2_CI_RELIABILITY.md), [controlled clock](progress/M2_CI_CONTROLLED_CLOCK.md) and [job isolation](progress/M2_CI_JOB_ISOLATION.md).

Netlify pins matching Node/npm versions for its build. Keep `.nvmrc`, package metadata and Netlify configuration consistent when changing the baseline. Hosted game contents must be checked separately from local source; this documentation update does not establish a deployment.

## Dependency evidence and update policy

The October 14 audit found six high-severity dependency packages. The patched October 15 lockfile audit reported zero known vulnerabilities, including development dependencies: [initial patch evidence](progress/toolchain-audit.json), [later contract audit](progress/contracts-dependency-audit.json). These are dated snapshots. The October 22 review did not perform a fresh audit or clean install.

Upgrade one toolchain/rendering dependency family at a time; inspect the lockfile, clean-install, run verify/audit and production browser checks. Three.js changes also require visual and hardware checks. Check current official support/migration guidance before choosing an upgrade; the pinned Vite line is not a claim of current upstream support. Do not use unattended `npm audit fix --force` as an update policy.
