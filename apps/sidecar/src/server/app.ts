import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { errorHandler } from './errors'
import { createAuthMiddleware } from './auth'

export interface CreateAppOptions {
  /** Bearer Token，由 main 从 config 透传 */
  authToken: string
  /** 实际监听端口，用于 Host 头校验 */
  port: number
}

export function createApp(options: CreateAppOptions): Hono {
  const app = new Hono()

  // CORS — 允许 Wails、本地开发来源
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return null
        // 允许所有 wails:// 协议来源（Wails 桌面端 WebView）
        if (origin.startsWith('wails://')) return origin
        // 允许本地开发服务器
        if (
          origin.startsWith('http://localhost:') ||
          origin.startsWith('http://127.0.0.1:') ||
          origin.startsWith('http://wails.localhost') ||
          origin.startsWith('https://wails.localhost')
        ) {
          return origin
        }
        return null
      },
    }),
  )

  // 鉴权中间件 — 放在 CORS 之后（CORS 预检不携 Authorization）
  // /sidecar/health 放行：供宿主 readiness 探活
  app.use(
    '*',
    createAuthMiddleware({
      token: options.authToken,
      port: options.port,
      skipPaths: ['/sidecar/health'],
    }),
  )

  // 请求日志（输出到 stderr）
  app.use(
    '*',
    honoLogger((msg) => process.stderr.write(msg + '\n')),
  )

  // 全局错误处理
  app.onError(errorHandler)

  return app
}
