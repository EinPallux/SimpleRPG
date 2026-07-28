import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'public/assets', 'node_modules', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // Engine purity (CLAUDE.md invariants 3+4): no React/DOM/persistence/Math.random/Date.now
    // inside game logic. The clock is injected; randomness comes from seeded streams only.
    files: ['src/engine/**/*.ts', 'src/content/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*'],
              message: 'Engine/content must stay React-free.',
            },
            {
              group: ['@/ui/*', '@/state/*', '@/persist/*'],
              message: 'Engine/content must not depend on UI, state, or persistence layers.',
            },
            { group: ['dexie'], message: 'Persistence belongs in src/persist.' },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use seeded rng streams (src/engine/rng.ts).',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'Use the injected Clock (src/engine/clock.ts).',
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'indexedDB'],
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}', 'playwright.config.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
);
