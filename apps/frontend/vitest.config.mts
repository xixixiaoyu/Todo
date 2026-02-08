import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    alias: {
      '@': resolve(__dirname, './src'),
      '@my-app/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
    setupFiles: ['./tests/setup.ts'],
    // 限制并发，防止 Worker 崩溃导致卡死
    fileParallelism: false,
  },
})
