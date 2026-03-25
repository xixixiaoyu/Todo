import sharedConfig from './eslint.config.mjs'
import { typeAwareRules } from '../../eslint.config.mjs'

export default [
  ...sharedConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    ignores: ['**/*.config.ts', '**/tsup.config.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: typeAwareRules,
  },
]
