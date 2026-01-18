import { baseConfig, ignoreConfig } from '../../eslint.config.mjs'
import prettier from 'eslint-plugin-prettier/recommended'

/**
 * Shared Package ESLint 配置
 * 继承根目录配置
 */
export default [
  ...baseConfig,
  ignoreConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ['dist', 'node_modules'],
  },
  prettier,
]
