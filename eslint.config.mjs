import js from '@eslint/js'
import ts from 'typescript-eslint'
import prettier from 'eslint-plugin-prettier/recommended'
import globals from 'globals'

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
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts', '**/*.vue'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
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
 * 导出默认配置，方便简单使用
 */
export default [...baseConfig, ignoreConfig, prettier]
