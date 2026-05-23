import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { NotFoundError, ValidationError, errorHandler } from '../../src/server/errors'

function createTestApp() {
  const app = new Hono()
  app.onError(errorHandler)
  return app
}

describe('errorHandler', () => {
  it('SidecarError 返回对应的状态码', async () => {
    const app = createTestApp()
    app.get('/test', () => {
      throw new NotFoundError('Item', '42')
    })

    const res = await app.request('/test')
    expect(res.status).toBe(404)

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toBe('Item not found: 42')
    expect(body.statusCode).toBe(404)
  })

  it('ValidationError 返回 400', async () => {
    const app = createTestApp()
    app.get('/test', () => {
      throw new ValidationError('Field is required')
    })

    const res = await app.request('/test')
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.statusCode).toBe(400)
  })

  it('未捕获的普通 Error 返回 500', async () => {
    const app = createTestApp()
    app.get('/test', () => {
      throw new Error('something crashed')
    })

    const res = await app.request('/test')
    expect(res.status).toBe(500)

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toBe('something crashed')
    expect(body.statusCode).toBe(500)
  })
})
