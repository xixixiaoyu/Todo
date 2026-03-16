import { baseConfig, ignoreConfig } from '../../eslint.config.mjs'
import vue from 'eslint-plugin-vue'
import ts from 'typescript-eslint'
import globals from 'globals'
import prettier from 'eslint-plugin-prettier/recommended'

/**
 * Frontend ESLint 配置
 * 继承根目录配置，添加 Vue 相关规则
 */
export default [
  ...baseConfig,
  ignoreConfig,
  ...vue.configs['flat/recommended'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    files: ['*.ts', '*.tsx', '*.mts', '*.cts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: [
      'tests/**/*.ts',
      'tests/**/*.tsx',
      'tests/**/*.mts',
      'tests/**/*.cts',
      'tests/**/*.vue',
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
  {
    files: ['**/*.vue'],
    rules: {
      'vue/block-order': [
        'error',
        {
          order: ['script', 'template', 'style'],
        },
      ],
      'vue/multi-word-component-names': 'off',
    },
  },
  {
    files: [
      '**/capacitor.config.ts',
      '**/pwa-assets.config.ts',
      '**/vitest.config.mts',
      '**/vite.config.mts',
    ],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    ignores: [
      'dist',
      'dev-dist',
      'node_modules',
      'ios',
      'android',
      'public',
      'src/assets',
      'capacitor.config.ts',
      'wailsjs',
    ],
  },
  prettier, // Prettier 必须放在最后，自动关闭所有格式冲突规则
]
