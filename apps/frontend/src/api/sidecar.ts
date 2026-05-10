import axios from 'axios'
import type { AxiosInstance } from 'axios'

/**
 * 创建 Sidecar 专用 HTTP 客户端
 * - Bearer Token 鉴权 （由 Wails binding 下发的 SidecarInfo.token 提供）
 * - Sidecar 同时强制 Host 头白名单校验防 DNS rebinding
 * - 更短超时（本地调用）
 * - 不携带 X-Requested-With（Sidecar 不需要）
 */
export function createSidecarClient(port: number, token: string): AxiosInstance {
  if (!token) {
    throw new Error('createSidecarClient requires a token')
  }
  return axios.create({
    baseURL: `http://127.0.0.1:${port}/sidecar`,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
}

export type SidecarClient = ReturnType<typeof createSidecarClient>
