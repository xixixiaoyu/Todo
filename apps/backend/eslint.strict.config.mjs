import backendConfig from './eslint.config.mjs'
import { typeAwareRules } from '../../eslint.config.mjs'

export default [
  ...backendConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    ignores: ['**/*.config.ts', '**/vitest.config.mts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: typeAwareRules,
  },
]
