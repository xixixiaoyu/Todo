import { describe, it, expect } from 'vitest'
import { createSidecarClient } from '@/api/sidecar'

describe('createSidecarClient', () => {
  it('缺少 token 时抛错（fail-closed）', () => {
    expect(() => createSidecarClient(12345, '')).toThrow(/token/i)
  })

  it('返回 axios 实例并预设 baseURL 与 Authorization', () => {
    const client = createSidecarClient(12345, 'tkn-abc')
    expect(client.defaults.baseURL).toBe('http://127.0.0.1:12345/sidecar')
    expect(client.defaults.timeout).toBe(5000)
    expect(client.defaults.headers['Authorization']).toBe('Bearer tkn-abc')
    expect(client.defaults.headers['Content-Type']).toBe('application/json')
  })

  it('每次调用返回独立实例（token 轮换后不污染旧客户端）', () => {
    const a = createSidecarClient(12345, 'tkn-a')
    const b = createSidecarClient(12345, 'tkn-b')
    expect(a).not.toBe(b)
    expect(a.defaults.headers['Authorization']).toBe('Bearer tkn-a')
    expect(b.defaults.headers['Authorization']).toBe('Bearer tkn-b')
  })
})
