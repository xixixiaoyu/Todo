import axios, { type AxiosInstance } from 'axios'

/**
 * 创建 Sidecar 专用 HTTP 客户端
 * - 无 auth（localhost-only 安全模型）
 * - 更短超时（本地调用）
 * - 不携带 X-Requested-With（Sidecar 不需要）
 */
export function createSidecarClient(port: number): AxiosInstance {
  return axios.create({
    baseURL: `http://127.0.0.1:${port}/sidecar`,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

export type SidecarClient = ReturnType<typeof createSidecarClient>
