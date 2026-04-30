/**
 * API 配置 — 统一管理后端地址的解析逻辑
 *
 * 优先级：
 * 1. VITE_API_BASE_URL（构建时注入的绝对地址）
 * 2. Wails 模式下：VITE_SERVER_URL 拼接 /api，或默认 http://localhost:3000/api
 * 3. Web 模式下：/api（相对路径，由 nginx/vite-proxy 代理）
 */

/** 后端服务器源地址（不含 /api 后缀），Wails 模式专用 */
function getServerOrigin(): string {
  // 构建时通过 VITE_SERVER_URL 注入，如 https://api.lumina.app
  const serverUrl = import.meta.env.VITE_SERVER_URL?.trim()
  if (serverUrl) return serverUrl.replace(/\/+$/, '')

  // 未注入时默认 localhost（开发 / 本地部署场景）
  return 'http://localhost:3000'
}

/**
 * 获取 API 请求的 baseURL
 *
 * - Web 模式：/api（相对路径）
 * - Wails 模式：绝对地址，如 http://localhost:3000/api 或 https://api.lumina.app/api
 */
export function getApiBaseUrl(): string {
  // VITE_API_BASE_URL 优先级最高（由 .env.production 等注入）
  const envBase = import.meta.env.VITE_API_BASE_URL
  if (envBase) return envBase

  if (import.meta.env.IS_WAILS) {
    return `${getServerOrigin()}/api`
  }

  return '/api'
}

/**
 * 获取后端服务器源地址（不含 /api 后缀）
 *
 * 用于拼接头像、文件等静态资源路径，以及 WebSocket 连接地址
 */
export function getServerBaseUrl(): string {
  const apiBase = getApiBaseUrl()
  return apiBase.replace(/\/api\/?$/, '')
}
