import { baseConfig, ignoreConfig } from '../../eslint.config.mjs'
import vue from 'eslint-plugin-vue'
import ts from 'typescript-eslint'
import globals from 'globals'
import configPrettier from 'eslint-config-prettier'

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
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        projectService: false,
        extraFileExtensions: ['.vue'],
      },
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
  configPrettier, // 只关闭与 Prettier 冲突的规则，避免在 lint 阶段重复执行格式化
]
