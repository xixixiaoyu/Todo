import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { sidecar: 'src/main.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  bundle: true,
  splitting: false,
  sourcemap: false,
  minify: true,
  treeshake: true,
  clean: true,
  outExtension() {
    return { js: '.mjs' }
  },
})
