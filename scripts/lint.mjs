import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

// Keep the initial JavaScript scope identical to the type-check scope.
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(await readFile(new URL('../tsconfig.check.json', import.meta.url), 'utf8'));
const sourceFiles = config.files.filter(file => file.endsWith('.js'));
const eslint = new ESLint({ cwd: root });
const results = await eslint.lintFiles([...sourceFiles, 'eslint.config.js', 'scripts/lint.mjs']);
const formatter = await eslint.loadFormatter('stylish');
const output = formatter.format(results);
if (output) process.stdout.write(output);
const failures = results.reduce((count, result) => count + result.errorCount + result.warningCount, 0);
if (failures) process.exitCode = 1;
else process.stdout.write(`Lint passed: ${sourceFiles.length} runtime modules and 2 lint tooling files.\n`);
