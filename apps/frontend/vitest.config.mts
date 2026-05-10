import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    maxWorkers: '50%',
    alias: {
      '@': resolve(__dirname, './src'),
      '@lumina/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
    setupFiles: ['./tests/setup.ts'],
  },
})
