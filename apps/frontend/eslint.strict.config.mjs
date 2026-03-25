import frontendConfig from './eslint.config.mjs'
import { typeAwareRules } from '../../eslint.config.mjs'
import ts from 'typescript-eslint'

export default [
  ...frontendConfig,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: typeAwareRules,
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: typeAwareRules,
  },
  {
    files: [
      '**/tests/**/*.ts',
      '**/tests/**/*.tsx',
      '**/tests/**/*.mts',
      '**/tests/**/*.cts',
      '**/tests/**/*.vue',
    ],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        projectService: false,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
]
