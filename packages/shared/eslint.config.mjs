import { baseConfig, ignoreConfig } from '../../eslint.config.mjs'
import configPrettier from 'eslint-config-prettier'

/**
 * Shared Package ESLint 配置
 * 继承根目录配置
 */
export default [
  ...baseConfig,
  ignoreConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    ignores: ['**/*.config.ts', '**/tsup.config.ts'],
  },
  {
    ignores: ['dist', 'node_modules'],
  },
  configPrettier,
]
