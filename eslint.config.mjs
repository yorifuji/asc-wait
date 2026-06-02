// See: https://eslint.org/docs/latest/use/configure/configuration-files

import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import globals from 'globals'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default [
  {
    ignores: ['**/coverage', '**/dist', '**/linter', '**/node_modules']
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': typescriptEslint
    },

    languageOptions: {
      globals: {
        ...globals.node,
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly'
      },

      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module',

      parserOptions: {
        project: ['tsconfig.eslint.json'],
        tsconfigRootDir: __dirname
      }
    },

    rules: {
      ...typescriptEslint.configs['eslint-recommended'].overrides[0].rules,
      ...typescriptEslint.configs.recommended.rules,
      camelcase: 'off',
      'no-console': 'off',
      'no-shadow': 'off',
      'no-unused-vars': 'off'
    }
  },
  {
    files: ['**/*.js', '**/*.mjs'],

    languageOptions: {
      globals: {
        ...globals.node
      },

      ecmaVersion: 2023,
      sourceType: 'module'
    },

    rules: {
      'no-console': 'off'
    }
  }
]
