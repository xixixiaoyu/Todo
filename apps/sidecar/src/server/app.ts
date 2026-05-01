import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { errorHandler } from './errors'

export function createApp(): Hono {
  const app = new Hono()

  // CORS — 仅允许 Wails 来源
  app.use(
    '*',
    cors({
      origin: [
        'http://localhost:5173',
        'wails://localhost',
        'http://wails.localhost',
        'https://wails.localhost',
      ],
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
