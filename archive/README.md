# Historical source archive

These 24 files were moved out of the live source tree during the October 15, 2026 M2 cleanup. Their contents are preserved byte for byte under `legacy/`, retaining their original relative paths. [manifest.json](manifest.json) records original/archive paths, reasons, byte sizes and SHA-256 hashes.

The live game entry is `index.html -> main.js -> src/js/main.js`. The retained runtime managers, concrete enemy builders, current developer diagnostics, tests, supported legacy levels and public assets remain in place. `public/vite.svg` is still the current favicon and was retained.

| Group | Files | Why archived |
| --- | ---: | --- |
| Old entries, audio copy, debug pages and repair scripts | 8 | Outside the live import path; repair scripts can rewrite source with obsolete code |
| Vite starter | 4 | Its counter/demo entry is not loaded by the game |
| Demo tests and empty enemy backup | 3 | Logging/demo or empty files, not the current assertion suite |
| Projectile table | 1 | Not imported by firing; actual behavior is in `ProjectileManager` |
| Ship JSON | 4 | No active loader; preserved as design references |
| Unintegrated geometry/lighting/obstacle/debug helpers | 4 | Duplicate or unfinished implementations outside the live path; old debug helper patches global prototypes |

Reference checks covered static and literal dynamic imports, entry HTML, package scripts, tests and repository text references. Historical assessment/guide mentions do not constitute runtime use. The production build and browser regressions verify that live imports still resolve after the move; this inventory does not claim to discover arbitrary runtime-generated URLs.

This folder is reference material, not an alternate runnable project. Do not run its repair scripts against the current tree. Archived relative imports may point at other obsolete files or missing historical dependencies. To reuse an idea, port it into the current implementation, satisfy its contracts and run `npm run verify` plus the browser checks. The supported development diagnostics remain `npm run smoke` and `npm run profile:arena`.
