import js from '@eslint/js';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

const dayjsRestriction = ['error', {
  paths: [{
    name: 'dayjs',
    message: 'Import dayjs from ./dayjs (local wrapper) instead of the npm package to ensure Europe/London timezone.'
  }]
}];

const sharedGlobals = {
  ...globals.browser,
  ...globals.node,
  Atomics: 'readonly',
  SharedArrayBuffer: 'readonly',
};

export default [
  {
    ignores: ['static/**/*'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },

  // JavaScript / JSX — use TypeScript parser (tsconfig has allowJs: true)
  {
    files: ['**/*.js', '**/*.jsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: sharedGlobals,
    },
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooksPlugin.configs['recommended-latest'].rules,
      'no-prototype-builtins': 0,
      'no-unused-vars': 0,
      'no-constant-binary-expression': 0,
      'semi': 1,
      'no-restricted-imports': dayjsRestriction,
    },
  },

  // TypeScript / TSX
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: sharedGlobals,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs['recommended-latest'].rules,
      // TypeScript handles these; ESLint's base rules don't understand TS syntax
      'no-undef': 0,
      'no-redeclare': 0,
      'no-constant-binary-expression': 0,
      // Project-wide overrides
      '@typescript-eslint/no-explicit-any': 0,
      '@typescript-eslint/no-non-null-assertion': 0,
      '@typescript-eslint/no-unused-vars': 0,
      '@typescript-eslint/no-require-imports': 0,
      'no-prototype-builtins': 0,
      'no-unused-vars': 0,
      'no-restricted-imports': dayjsRestriction,
    },
  },

  // Jest test files (JS and TS)
  {
    files: ['**/*.test.js', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      globals: globals.jest,
    },
  },

  // dayjs.ts is the one file allowed to import from 'dayjs' directly
  {
    files: ['dayjs.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
];
