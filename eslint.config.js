import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'playwright-report/**', 'test-results/**'] },
  {
    files: ['src/js/**/*.js', 'eslint.config.js', 'scripts/lint.mjs'],
    rules: js.configs.recommended.rules,
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser },
  },
  { files: ['scripts/*.mjs', 'eslint.config.js'], languageOptions: { globals: globals.node } },
];
