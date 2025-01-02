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
    'babel/semi': 1
  },
  overrides: [
    {
      files: [
        "**/*.test.js"
      ],
      env: {
        jest: true
      }
    }
  ],
};
