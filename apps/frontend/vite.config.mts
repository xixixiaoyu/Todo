import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { defineConfig } from 'vite'
import type { UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import viteCompression from 'vite-plugin-compression'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isWails = process.env.WAILS === 'true'
const isPwaDevEnabled = process.env.VITE_PWA_DEV === 'true'

// 根据环境和构建目标设置 base 路径
const getBase = () => {
  // Wails 模式使用相对路径
  if (isWails) return './'
  // 生产环境优先从环境变量获取，否则默认为 '/'
  return process.env.VITE_BASE_URL || '/'
}

const getManualChunk = (id: string) => {
  if (!id.includes('node_modules')) return undefined

  if (
    id.includes('/vue/') ||
    id.includes('/vue-router/') ||
    id.includes('/pinia/') ||
    id.includes('/pinia-plugin-persistedstate/')
  ) {
    return 'vue-vendor'
  }

  if (
    id.includes('/lucide-vue-next/') ||
    id.includes('/gsap/') ||
    id.includes('/reka-ui/') ||
    id.includes('/clsx/') ||
    id.includes('/tailwind-merge/')
  ) {
    return 'ui-vendor'
  }

  if (id.includes('/echarts/') || id.includes('/zrender/') || id.includes('/vue-echarts/')) {
    return 'chart-vendor'
  }

  if (id.includes('/cytoscape/')) {
    return 'cytoscape-vendor'
  }

  if (id.includes('/mermaid/') || id.includes('/@mermaid-js/')) {
    return 'mermaid-vendor'
  }

  if (
    id.includes('/markdown-it/') ||
    id.includes('/markdown-it-highlightjs/') ||
    id.includes('/highlight.js/') ||
    id.includes('/katex/') ||
    id.includes('/@iktakahiro/markdown-it-katex/')
  ) {
    return 'markdown-vendor'
  }

  if (
    id.includes('/axios/') ||
    id.includes('/dayjs/') ||
    id.includes('/lodash-es/') ||
    id.includes('/zod/') ||
    id.includes('/vee-validate/')
  ) {
    return 'utils-vendor'
  }

  return undefined
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
        verbose: false,
        disable: false,
        threshold: 1024,
        algorithm: 'gzip',
        ext: '.gz',
      }),
      // Brotli 压缩
      viteCompression({
        verbose: false,
        disable: false,
        threshold: 1024,
        algorithm: 'brotliCompress',
        ext: '.br',
      }),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: isPwaDevEnabled,
        },
        includeAssets: [
          'favicon.ico',
          'logo.png',
          'apple-touch-icon-180x180.png',
          'pwa-64x64.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'maskable-icon-512x512.png',
          'offline.html',
        ],
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf,json,webmanifest}'],
          // 运行时缓存策略：API 请求 Network First，静态资源 Cache First
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'cdn-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|ico|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'image-cache',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /\.(?:woff2?|ttf|eot)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'font-cache',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
          // 离线回退页
          navigationPreload: false,
        },
        manifest: {
          id: '/',
          name: '简思 (Lumina)',
          short_name: '简思',
          description: '简于形，深于思 — 高效纯粹的 AI 个人待办',
          lang: 'zh-CN',
          dir: 'ltr',
          orientation: 'portrait-primary',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui', 'window-controls-overlay'],
          background_color: '#ffffff',
          theme_color: '#ffffff',
          categories: ['productivity', 'utilities'],
          start_url: './',
          scope: './',
          iarc_rating_id: '',
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
            {
              src: 'apple-touch-icon-180x180.png',
              sizes: '180x180',
              type: 'image/png',
              purpose: 'any',
            },
          ],
          shortcuts: [
            {
              name: '添加待办',
              short_name: '添加',
              description: '快速创建新待办事项',
              url: './?action=add',
              icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }],
            },
          ],
          screenshots: [
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              form_factor: 'wide',
              label: '简思主界面',
            },
          ],
          related_applications: [],
          prefer_related_applications: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@lumina/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0', // 在 Docker 环境下必须监听 0.0.0.0 才能从外部访问
      proxy: {
        '/api': {
          target: process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
          ws: true,
          changeOrigin: true,
          // 增加超时设置，防止长连接意外断开
          timeout: 60000,
          proxyTimeout: 60000,
        },
      },
      headers: {
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: getManualChunk,
        },
      },
      chunkSizeWarningLimit: 2000,
    },
  }
})
