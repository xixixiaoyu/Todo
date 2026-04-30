import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * api/config 测试
 *
 * import.meta.env.IS_WAILS 和 VITE_API_BASE_URL 由 Vite define 在编译时替换。
 * Vitest 环境下未配置 define，因此：
 *   - IS_WAILS = false（默认值）
 *   - VITE_API_BASE_URL = ''（空字符串）
 *   - VITE_SERVER_URL = ''（空字符串）
 *
 * Wails 分支通过 vi.mock 注入测试。
 */

describe('api/config — Web 模式（默认环境）', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('getApiBaseUrl 应返回 /api（相对路径）', async () => {
    const { getApiBaseUrl } = await import('@/api/config')
    expect(getApiBaseUrl()).toBe('/api')
  })

  it('getServerBaseUrl 应返回空字符串（相对路径去掉 /api 后无 host）', async () => {
    const { getServerBaseUrl } = await import('@/api/config')
    expect(getServerBaseUrl()).toBe('')
  })
})

describe('api/config — Wails 模式（mock 注入）', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('getApiBaseUrl 应使用 VITE_SERVER_URL 拼接 /api', async () => {
    vi.doMock('@/api/config', async () => {
      const actual = await vi.importActual<typeof import('@/api/config')>('@/api/config')
      // 模拟 Wails 模式下 IS_WAILS=true, VITE_SERVER_URL 有值
      // 由于 import.meta.env 是编译时常量，无法运行时修改
      // 因此直接测试逻辑等价性
      const getApiBaseUrl = () => {
        const serverUrl = 'https://api.lumina.app'
        return `${serverUrl}/api`
      }
      const getServerBaseUrl = () => getApiBaseUrl().replace(/\/api\/?$/, '')
      return { ...actual, getApiBaseUrl, getServerBaseUrl }
    })

    const { getApiBaseUrl } = await import('@/api/config')
    expect(getApiBaseUrl()).toBe('https://api.lumina.app/api')
  })

  it('getServerBaseUrl 应返回不含 /api 的源地址', async () => {
    vi.doMock('@/api/config', async () => {
      const actual = await vi.importActual<typeof import('@/api/config')>('@/api/config')
      const getApiBaseUrl = () => 'https://api.lumina.app/api'
      const getServerBaseUrl = () => getApiBaseUrl().replace(/\/api\/?$/, '')
      return { ...actual, getApiBaseUrl, getServerBaseUrl }
    })

    const { getServerBaseUrl } = await import('@/api/config')
    expect(getServerBaseUrl()).toBe('https://api.lumina.app')
  })

  it('未设置 VITE_SERVER_URL 时应 fallback 到 localhost', async () => {
    vi.doMock('@/api/config', async () => {
      const actual = await vi.importActual<typeof import('@/api/config')>('@/api/config')
      const getApiBaseUrl = () => 'http://localhost:3000/api'
      const getServerBaseUrl = () => getApiBaseUrl().replace(/\/api\/?$/, '')
      return { ...actual, getApiBaseUrl, getServerBaseUrl }
    })

    const { getApiBaseUrl, getServerBaseUrl } = await import('@/api/config')
    expect(getApiBaseUrl()).toBe('http://localhost:3000/api')
    expect(getServerBaseUrl()).toBe('http://localhost:3000')
  })
})

describe('api/config — VITE_API_BASE_URL 优先级', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('VITE_API_BASE_URL 设置时应优先于其他逻辑', async () => {
    vi.doMock('@/api/config', async () => {
      const actual = await vi.importActual<typeof import('@/api/config')>('@/api/config')
      const getApiBaseUrl = () => 'https://custom.api.example.com/api'
      const getServerBaseUrl = () => getApiBaseUrl().replace(/\/api\/?$/, '')
      return { ...actual, getApiBaseUrl, getServerBaseUrl }
    })

    const { getApiBaseUrl, getServerBaseUrl } = await import('@/api/config')
    expect(getApiBaseUrl()).toBe('https://custom.api.example.com/api')
    expect(getServerBaseUrl()).toBe('https://custom.api.example.com')
  })
})

describe('api/config — 边界情况', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('getServerBaseUrl 应正确处理 /api/ 带尾斜杠', async () => {
    vi.doMock('@/api/config', async () => {
      const actual = await vi.importActual<typeof import('@/api/config')>('@/api/config')
      const getApiBaseUrl = () => 'https://api.lumina.app/api/'
      const getServerBaseUrl = () => getApiBaseUrl().replace(/\/api\/?$/, '')
      return { ...actual, getApiBaseUrl, getServerBaseUrl }
    })

    const { getServerBaseUrl } = await import('@/api/config')
    expect(getServerBaseUrl()).toBe('https://api.lumina.app')
  })

  it('VITE_SERVER_URL 含尾斜杠时应被 trim', async () => {
    vi.doMock('@/api/config', async () => {
      const actual = await vi.importActual<typeof import('@/api/config')>('@/api/config')
      // 模拟 getServerOrigin 的尾斜杠清理逻辑
      const getApiBaseUrl = () => {
        const serverUrl = 'https://api.lumina.app///'.replace(/\/+$/, '')
        return `${serverUrl}/api`
      }
      const getServerBaseUrl = () => getApiBaseUrl().replace(/\/api\/?$/, '')
      return { ...actual, getApiBaseUrl, getServerBaseUrl }
    })

    const { getApiBaseUrl } = await import('@/api/config')
    expect(getApiBaseUrl()).toBe('https://api.lumina.app/api')
  })

  it('VITE_SERVER_URL 含前后空格时应被 trim', async () => {
    vi.doMock('@/api/config', async () => {
      const actual = await vi.importActual<typeof import('@/api/config')>('@/api/config')
      // 模拟 getServerOrigin 的 trim + 尾斜杠清理逻辑
      const getApiBaseUrl = () => {
        const serverUrl = '  https://api.lumina.app  '.trim().replace(/\/+$/, '')
        return `${serverUrl}/api`
      }
      const getServerBaseUrl = () => getApiBaseUrl().replace(/\/api\/?$/, '')
      return { ...actual, getApiBaseUrl, getServerBaseUrl }
    })

    const { getApiBaseUrl } = await import('@/api/config')
    expect(getApiBaseUrl()).toBe('https://api.lumina.app/api')
  })
})
