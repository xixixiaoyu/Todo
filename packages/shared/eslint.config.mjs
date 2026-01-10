import baseConfig from '../../eslint.config.mjs'

/**
 * Shared Package ESLint 配置
 * 继承根目录配置
 */
export default [
  ...baseConfig,
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
]
