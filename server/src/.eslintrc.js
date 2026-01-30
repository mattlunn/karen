module.exports = {
  ignorePatterns: ['static/**/*'],
  env: {
    browser: true,
    es6: true,
    node: true
  },
  extends: [
    'plugin:react/recommended',
    'eslint:recommended',
    'plugin:react-hooks/recommended'
  ],
  settings: {
    react: {
      version: 'detect'
    }
  },
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parser: 'babel-eslint',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 11,
    sourceType: 'module'
  },
  plugins: [
    'react',
    'babel'
  ],
  rules: {
    'no-prototype-builtins': 0,
    'no-unused-vars': 0,
    'react/prop-types': 0,
    'babel/semi': 1,
    'no-restricted-imports': ['error', {
      paths: [{
        name: 'dayjs',
        message: 'Import dayjs from ./dayjs (local wrapper) instead of the npm package to ensure Europe/London timezone.'
      }]
    }]
  },
  overrides: [
    {
      files: [
        "**/*.test.js"
      ],
      env: {
        jest: true
      }
    },
    {
      files: ["**/*.ts", "**/*.tsx"],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        'plugin:@typescript-eslint/recommended'
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 0,
        '@typescript-eslint/no-non-null-assertion': 0,
        '@typescript-eslint/no-unused-vars': 0
      }
    },
    {
      // The dayjs wrapper is allowed to import from 'dayjs' npm package
      files: ['dayjs.ts'],
      rules: {
        'no-restricted-imports': 'off'
      }
    }
  ],
};
