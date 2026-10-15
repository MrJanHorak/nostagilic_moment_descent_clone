# Runtime, dependencies and verification

Baseline established October 15, 2026.

- Primary runtime: **Node 24.22.0**, pinned in `.nvmrc` and Netlify configuration.
- Primary package manager: **npm 11.21.1**, declared in `package.json` and Netlify configuration. CI installs the declared version explicitly; the `packageManager` field alone does not change a local npm installation.
- Compatibility range: Node 22.14+ within 22.x, or Node 24.x; npm 11.2+ within 11.x. These are compatibility floors, not a recommendation to keep old security patch levels. Prefer the exact primary baseline.
- Runtime/build/browser dependencies: Vite **6.4.4**, Three.js **0.176.0**, and Playwright Test **1.64.1**. Development checks use TypeScript **7.0.2**, `@types/three` **0.176.0**, ESLint **10.12.0**, `@eslint/js` **10.0.1**, and `globals` **17.13.0**. Only Three.js is a production dependency. Exact direct versions and the committed lockfile make changes reviewable. `.npmrc` preserves exact versions on future saves and rejects unsupported engine ranges.

## Local setup

Install/select Node 24.22.0 using your normal Node installation or version manager (`nvm install` / `nvm use` with a compatible manager). Then select the declared npm version:

```sh
npm install --global npm@11.21.1
npm ci --no-audit
npm run verify
npm run audit:deps
```

Use `npm ci` for an existing checkout. It replaces `node_modules` from the lockfile, fails on manifest/lock mismatch, and does not update locked versions. Preserve optional platform dependencies; Rollup/esbuild need the matching native binary. `npm run verify` runs scoped lint, strict JSDoc type checking, all 118 unit/simulation/metrics tests and the production build, stopping on failure. See the [projectile checkpoint](progress/M2_PROJECTILE_CONTRACTS.md) for the fourteen checked runtime modules and limits; this does not check all legacy source. The separate audit includes development dependencies and fails at moderate severity or above; network failures also fail that step. `npm run browser:install` downloads Chromium; `npm run test:browser` builds and runs the six browser checks. `npm run profile:arena` runs a separate hardware benchmark; see the [profiling checkpoint](progress/M2_PERFORMANCE.md).

Run `npm run dev` for normal play, `npm run smoke` for the development diagnostics, or `npm run preview -- --host 127.0.0.1` after building for a production preview. See [M1 acceptance](M1_ACCEPTANCE.md) for the owner's Chrome sign-off and the repeatable regression playthrough.

The implementation session verified the pinned runtime using temporary npm-exec packages; it did not replace the user's global Node/npm installation. Their existing Node 22.14.0/npm 11.2.0 remains separate from that validation.

## CI and hosting

`.github/workflows/verify.yml` runs on pushes, pull requests and manual dispatch, on both Ubuntu and Windows. Each job selects `.nvmrc`, installs npm from `packageManager`, performs a clean lockfile install, runs lint/types/tests/build, installs Chromium/platform libraries, runs browser smoke/resource checks, and audits all dependencies. It retains browser reports and measurements for seven days, has read-only repository permissions, and does not deploy. Hosted execution remains unverified until these files are pushed and GitHub runs the workflow.

Netlify has matching Node/npm versions declared for its next build. This checkpoint does not publish a deployment. Keep `.nvmrc`, package metadata and Netlify versions consistent when changing the baseline. Netlify's automatic dependency installation uses its own build process; CI/local `npm ci` is the explicit clean-install check.

## Findings and update policy

The initial audit reported **six high-severity dependency packages**: Vite, Rollup, PostCSS, nanoid, picomatch and source-map-js. Several packages had multiple advisories. The patched lockfile has **zero known vulnerabilities** in the October 15 audit, including development dependencies; see [audit evidence](progress/toolchain-audit.json). This is an advisory snapshot, not a guarantee against future findings.

Vite's findings affect development-server access/file handling, including Windows paths. The other findings involve build-time parsing, matching, source maps or generated output. These packages are development/build tools, rather than the Three.js runtime shipped with the game, but still warrant patching. Restrict local dev/preview servers to trusted use.

Vite 6.4 is a security-patched maintenance line according to the [official release policy](https://vite.dev/releases). This checkpoint patches within the existing major to avoid mixing security work with a bundler migration. A supported newer Vite major remains a separate follow-up, followed by its own production-browser check. Three.js is unchanged; evaluate its migration separately with visual checks.

For future updates: change one toolchain/rendering dependency family at a time, review the lockfile, clean-install, run verify/audit, and perform the production browser flow. Do not use `npm audit fix --force` as an unattended upgrade policy. npm 11.21.1 currently reports an install-script review warning for esbuild's native-binary setup; the clean install and production build succeeded. No blanket install-script approval has been added.

Useful primary references: [Node releases](https://nodejs.org/en/about/previous-releases), [Vite supported releases](https://vite.dev/releases), [setup-node](https://github.com/actions/setup-node), and [Netlify dependency configuration](https://docs.netlify.com/build/configure-builds/manage-dependencies/).

## Verification and remaining M2 work

On Windows, a clean install with Node 24.22.0/npm 11.21.1 passed, all 89 tests passed, and Vite 6.4.4 built the production game. All 89 tests also passed on the existing Node 22.14.0/npm 11.2.0. The workflow parsed successfully with YAML 2.8.1; this does not prove hosted GitHub execution. The output asset retains the prior filename/hash and approximately 644 kB minified / 162 kB gzip; the existing chunk-size warning remains. The source map changes with the upgraded bundler. No gameplay source changed in this checkpoint.

This records the first M2 toolchain checkpoint. Follow-ups add [browser/resource regressions](progress/M2_BROWSER.md), a [three-run Intel GPU baseline and lighting reduction](progress/M2_PERFORMANCE.md), [saved mouse controls](progress/M2_SETTINGS.md), initial [lint/type contracts](progress/M2_CONTRACTS.md), [saved audio controls](progress/M2_AUDIO_SETTINGS.md), expanded [player/input contracts](progress/M2_PLAYER_CONTRACTS.md), and [projectile ownership](progress/M2_PROJECTILE_CONTRACTS.md). The latest scoped checks, 118 unit/simulation/metrics tests, six browser checks and build pass locally on the pinned toolchain. The lockfile is unchanged since the clean install and [audit](progress/contracts-dependency-audit.json), which reported zero known vulnerabilities. The frame-time target, hosted CI and broader source contracts/cleanup remain.
