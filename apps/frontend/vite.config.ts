import { resolve } from 'path'
import { defineConfig, type UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import viteCompression from 'vite-plugin-compression'

const isWails = process.env.WAILS === 'true'

// 根据环境和构建目标设置 base 路径
const getBase = () => {
  // Wails 模式使用相对路径
  if (isWails) return './'
  // 生产环境优先从环境变量获取，否则默认为 '/'
  return process.env.VITE_BASE_URL || '/'
}

export default defineConfig(async (): Promise<UserConfig> => {
  return {
    base: getBase(),
    define: {
      'import.meta.env.IS_WAILS': JSON.stringify(isWails),
    },
    plugins: [
      vue(),
      // Gzip 压缩
      viteCompression({
        verbose: true,
        disable: false,
        threshold: 1024,
        algorithm: 'gzip',
        ext: '.gz',
      }),
      // Brotli 压缩
      viteCompression({
        verbose: true,
        disable: false,
        threshold: 1024,
        algorithm: 'brotliCompress',
        ext: '.br',
      }),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
        },
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon-180x180.png',
          'pwa-64x64.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'maskable-icon-512x512.png',
        ],
        manifest: {
          name: '简思',
          short_name: '简思',
          description: '简于形，深于思 — 高效纯粹的 AI 个人待办',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'pwa-64x64.png',
              sizes: '64x64',
              type: 'image/png',
            },
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@my-app/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            'ui-vendor': ['lucide-vue-next', 'gsap'],
            'chart-vendor': ['echarts', 'vue-echarts'],
            'markdown-vendor': ['markdown-it', 'mermaid', 'highlight.js', 'katex'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
  }
})
