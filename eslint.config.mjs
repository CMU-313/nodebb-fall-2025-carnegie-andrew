'use strict';

import serverConfig from 'eslint-config-nodebb';
import publicConfig from 'eslint-config-nodebb/public';
import commonRules from 'eslint-config-nodebb/common';

import { defineConfig } from 'eslint/config';
import stylisticJs from '@stylistic/eslint-plugin-js';
import js from '@eslint/js';
import globals from 'globals';

// NEW: Prettier integration for flat config
import prettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfig([
  {
    ignores: [
      'node_modules/',
      '.project',
      '.vagrant',
      '.DS_Store',
      '.tx',
      'logs/',
      'public/uploads/',
      'public/vendor/',
      '.idea/',
      '.vscode/',
      '*.ipr',
      '*.iws',
      'coverage/',
      'build/',
      'test/files/',
      '*.min.js',
      'install/docker/',
    ],
  },
  // tests
  {
    plugins: {
      js,
      '@stylistic/js': stylisticJs,
    },
    extends: ['js/recommended'],
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.browser,
        it: 'readonly',
        describe: 'readonly',
        before: 'readonly',
        beforeEach: 'readonly',
        after: 'readonly',
        afterEach: 'readonly',
      },
    },
    rules: {
      ...commonRules,
      'no-unused-vars': 'off',
      'no-prototype-builtins': 'off',
    },
  },

  ...publicConfig,
  ...serverConfig,

  // === OUR PRETTIER LAYER (place near the end) ===
  {
    files: ['**/*.{js,cjs,mjs}'],
    plugins: { prettier },
    rules: {
      // Treat Prettier formatting issues as ESLint errors
      'prettier/prettier': 'error',

      // Silence style-only rules Prettier already handles or that are too noisy
      '@stylistic/js/arrow-parens': 'off',
      '@stylistic/js/operator-linebreak': 'off',
      '@stylistic/js/function-paren-newline': 'off',
      '@stylistic/js/no-mixed-operators': 'off',
    },
  },

  // Disable remaining conflicting stylistic rules
  eslintConfigPrettier,
]);
