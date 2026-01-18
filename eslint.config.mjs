import js from '@eslint/js'
import ts from 'typescript-eslint'
import prettier from 'eslint-plugin-prettier/recommended'

/**
 * 基础规则配置（不包含 Prettier）
 */
export const baseConfig = [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
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
 * 导出默认配置，方便简单使用
 */
export default [...baseConfig, ignoreConfig, prettier]
