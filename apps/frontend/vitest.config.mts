import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    alias: {
      '@': resolve(__dirname, './src'),
      '@my-app/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
})
