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
