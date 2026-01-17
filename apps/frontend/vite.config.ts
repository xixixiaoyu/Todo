import { defineConfig, type UserConfig, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import viteCompression from 'vite-plugin-compression'
import { resolve } from 'path'

const isElectron = process.env.ELECTRON === 'true'
const isWails = process.env.WAILS === 'true'

// 动态导入 electron 插件，避免在非 electron 环境下加载
const getElectronPlugins = async (): Promise<PluginOption[]> => {
  if (!isElectron) return []
  const electron = (await import('vite-plugin-electron')).default
  const renderer = (await import('vite-plugin-electron-renderer')).default
  return [
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            lib: {
              entry: 'electron/main.ts',
              formats: ['es'],
              fileName: () => 'main.mjs',
            },
            outDir: 'dist-electron',
            minify: false,
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
      },
    ]) as unknown as PluginOption,
    renderer() as unknown as PluginOption,
  ]
}

// 根据环境和构建目标设置 base 路径
const getBase = () => {
  // Electron 或 Wails 模式使用相对路径
  if (isElectron || isWails) return './'
  // 生产环境部署到 GitHub Pages
  if (process.env.NODE_ENV === 'production') return '/vue3-nest-template/'
  // 常规开发环境使用 '/'，Capacitor/Electron 会在各自的构建流程中处理
  return '/'
}

export default defineConfig(async (): Promise<UserConfig> => {
  const electronPlugins = isElectron ? await getElectronPlugins() : []

  return {
    base: getBase(),
    define: {
      'import.meta.env.IS_ELECTRON': JSON.stringify(isElectron),
      'import.meta.env.IS_WAILS': JSON.stringify(isWails),
    },
    plugins: [
      vue(),
      ...electronPlugins,
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
          name: '极简待办',
          short_name: '极简待办',
          description: '高效、纯粹的个人待办管理工具',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
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
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\..*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 1 day
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
      }) as unknown as PluginOption,
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@my-app/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: process.env.VITE_API_BASE_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
