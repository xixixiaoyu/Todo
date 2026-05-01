import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { SidecarError, NotFoundError, ValidationError, errorHandler } from '../../src/server/errors'

function createTestApp() {
  const app = new Hono()
  app.onError(errorHandler)
  return app
}

describe('Errors', () => {
  describe('SidecarError', () => {
    it('默认状态码为 400', () => {
      const err = new SidecarError('bad request')
      expect(err.statusCode).toBe(400)
      expect(err.message).toBe('bad request')
      expect(err.name).toBe('SidecarError')
    })

    it('支持自定义状态码', () => {
      const err = new SidecarError('server error', 500)
      expect(err.statusCode).toBe(500)
    })
  })

  describe('NotFoundError', () => {
    it('生成正确的消息和 404 状态码', () => {
      const err = new NotFoundError('User', '123')
      expect(err.message).toBe('User not found: 123')
      expect(err.statusCode).toBe(404)
      expect(err.name).toBe('NotFoundError')
    })
  })

  describe('ValidationError', () => {
    it('状态码为 400', () => {
      const err = new ValidationError('Name is required')
      expect(err.message).toBe('Name is required')
      expect(err.statusCode).toBe(400)
      expect(err.name).toBe('ValidationError')
    })
  })

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
})
