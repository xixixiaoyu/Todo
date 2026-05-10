import { defineConfig } from 'tsup'

const isDev = process.env.TSUP_DEV === 'true'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: !isDev,
  splitting: false,
  sourcemap: true,
  watch: isDev
    ? process.env.CHOKIDAR_USEPOLLING === 'true'
      ? { usePolling: true, interval: 300 }
      : true
    : false,
})
