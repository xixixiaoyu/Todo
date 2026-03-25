import { baseConfig, ignoreConfig } from '../../eslint.config.mjs'
import configPrettier from 'eslint-config-prettier'

/**
 * Backend ESLint 配置
 * 继承根目录配置，添加 NestJS 相关规则
 */
export default [
  ...baseConfig,
  ignoreConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    ignores: ['**/*.config.ts', '**/vitest.config.mts'],
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    ignores: ['dist', 'node_modules', 'src/generated', 'prisma/generated', 'coverage', '*.log'],
  },
  configPrettier, // 只关闭与 Prettier 冲突的规则
]
