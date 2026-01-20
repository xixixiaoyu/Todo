import { baseConfig, ignoreConfig } from '../../eslint.config.mjs'
import prettier from 'eslint-plugin-prettier/recommended'

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
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    ignores: ['dist', 'node_modules', 'prisma/generated', 'coverage', '*.log'],
  },
  prettier, // Prettier 必须放在最后
]
