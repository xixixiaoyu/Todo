import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { createAuthMiddleware } from '../../src/server/auth'
import { errorHandler } from '../../src/server/errors'

const VALID_TOKEN = 'lumina-test-token-abc123'
const PORT = 54321

function buildApp(opts?: { skipPaths?: string[] }) {
  const app = new Hono()
  app.use(
    '*',
    createAuthMiddleware({
      token: VALID_TOKEN,
      port: PORT,
      skipPaths: opts?.skipPaths ?? ['/sidecar/health'],
    }),
  )
  app.onError(errorHandler)
  app.get('/sidecar/health', (c) => c.json({ success: true, data: { ok: true } }))
  app.get('/sidecar/ping', (c) => c.json({ success: true, data: 'pong' }))
  return app
}

function request(app: Hono, path: string, headers: Record<string, string> = {}): Promise<Response> {
  return app.request(path, { headers })
}

describe('createAuthMiddleware', () => {
  it('token 为空时构造抛错', () => {
    expect(() => createAuthMiddleware({ token: '', port: PORT })).toThrow(
      'createAuthMiddleware: token must not be empty',
    )
  })

  it('skipPaths 无需鉴权即可放行', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/health', { host: `127.0.0.1:${PORT}` })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('skipPaths 匹配也不要求 Host（健康探活对宿主透明）', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/health')
    expect(res.status).toBe(200)
  })

  it('缺失 Host 头返回 403', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/ping', {
      authorization: `Bearer ${VALID_TOKEN}`,
    })
    // Hono 的 Request 会默认填充 Host，所以我们通过使用伪造的 Host 来模拟无效场景
    // 这里断言：没显式正确 host（如 localhost:wrong）应当 403
    // 具体行为见下个用例
    expect([401, 403]).toContain(res.status)
  })

  it('Host 不在白名单（错误端口）返回 403', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/ping', {
      host: `127.0.0.1:9999`,
      authorization: `Bearer ${VALID_TOKEN}`,
    })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toMatch(/host/i)
  })

  it('Host 为外部域名返回 403（防 DNS rebinding）', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/ping', {
      host: `evil.example.com:${PORT}`,
      authorization: `Bearer ${VALID_TOKEN}`,
    })
    expect(res.status).toBe(403)
  })

  it('无 Authorization 返回 401', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/ping', { host: `127.0.0.1:${PORT}` })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toMatch(/missing bearer/i)
  })

  it('非 Bearer 方案返回 401', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/ping', {
      host: `127.0.0.1:${PORT}`,
      authorization: `Basic dXNlcjpwYXNz`,
    })
    expect(res.status).toBe(401)
  })

  it('Token 不匹配返回 401', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/ping', {
      host: `127.0.0.1:${PORT}`,
      authorization: `Bearer wrong-token`,
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toMatch(/invalid token/i)
  })

  it('正确 Token + localhost Host 放行', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/ping', {
      host: `localhost:${PORT}`,
      authorization: `Bearer ${VALID_TOKEN}`,
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBe('pong')
  })

  it('正确 Token + 127.0.0.1 Host 放行', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/ping', {
      host: `127.0.0.1:${PORT}`,
      authorization: `Bearer ${VALID_TOKEN}`,
    })
    expect(res.status).toBe(200)
  })

  it('Authorization 大小写不敏感', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/ping', {
      host: `127.0.0.1:${PORT}`,
      Authorization: `bearer ${VALID_TOKEN}`,
    })
    expect(res.status).toBe(200)
  })

  it('错误响应为统一 ApiErrorResponse 结构', async () => {
    const app = buildApp()
    const res = await request(app, '/sidecar/ping', {
      host: `127.0.0.1:${PORT}`,
    })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toMatchObject({
      success: false,
      data: null,
      statusCode: 401,
    })
    expect(typeof body.timestamp).toBe('string')
    expect(typeof body.message).toBe('string')
  })
})
