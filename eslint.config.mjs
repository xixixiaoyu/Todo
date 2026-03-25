import js from '@eslint/js'
import ts from 'typescript-eslint'
import configPrettier from 'eslint-config-prettier'
import globals from 'globals'

export const typedFilePatterns = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.vue']

export const typeAwareRules = {
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
}

/**
 * 基础规则配置（不包含 Prettier）
 */
export const baseConfig = [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },
  {
    files: typedFilePatterns,
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.config.ts', '**/tsup.config.ts'],
    ...ts.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]

/**
 * 忽略文件配置
 */
export const ignoreConfig = {
  ignores: [
    '**/dist',
    '**/dev-dist',
    '**/node_modules',
    'apps/frontend/ios',
    'apps/frontend/android',
    '.husky',
    '.trae',
  ],
}

/**
 * 导出默认配置，关闭与 Prettier 冲突的规则，但不在 lint 阶段执行 Prettier
 */
export default [...baseConfig, ignoreConfig, configPrettier]
