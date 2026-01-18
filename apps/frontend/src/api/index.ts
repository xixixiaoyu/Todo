import axios from 'axios'
import i18n from '@/i18n'
import { useAuthStore } from '@/features/auth/stores/auth'

/**
 * HTTP 客户端实例
 */
export const httpClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.IS_WAILS ? 'http://localhost:3000/api' : '/api'),
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * 初始化 CSRF Token
 * 在首次请求前发起一个 GET 请求获取 CSRF token cookie
 */
let csrfInitialized = false

export async function initCsrfToken(): Promise<void> {
  if (csrfInitialized) return

  try {
    // 发起一个 GET 请求到健康检查端点，后端会设置 CSRF token cookie
    await httpClient.get('/health', { timeout: 5000 })
    csrfInitialized = true
  } catch {
    // 静默失败，不影响后续请求
    csrfInitialized = true
  }
}

/**
 * 从 cookie 中获取指定名称的值
 */
function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`))
  return match ? decodeURIComponent(match[2]) : null
}

/**
 * 从 localStorage 获取 token（兼容 pinia 持久化）
 */
function getToken(): string | null {
  // 尝试从 localStorage 获取（pinia-plugin-persistedstate 默认存储位置）
  const authData = localStorage.getItem('auth')
  if (authData) {
    try {
      const parsed = JSON.parse(authData)
      return parsed.token || null
    } catch {
      return null
    }
  }
  return null
}

// 请求拦截器
httpClient.interceptors.request.use(
  async (config) => {
    // 首次请求前初始化 CSRF token
    if (!csrfInitialized) {
      await initCsrfToken()
    }

    // 如果存在 token，添加到请求头
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // 添加语言标识
    const currentLocale =
      (i18n.global.locale as { value?: string }).value || i18n.global.locale || 'zh-CN'
    config.headers['x-lang'] = currentLocale
    config.headers['Accept-Language'] = currentLocale

    // 非 GET 请求添加 CSRF token
    if (config.method && !['get', 'head', 'options'].includes(config.method.toLowerCase())) {
      const csrfToken = getCookie('XSRF-TOKEN')
      if (csrfToken) {
        config.headers['X-XSRF-TOKEN'] = csrfToken
      }
    }

    return config
  },
  (error) => Promise.reject(error),
)

// 防止并发刷新请求
let isRefreshing = false
let refreshSubscribers: Array<{
  resolve: (token: string) => void
  reject: (error: Error) => void
}> = []

/**
 * 订阅刷新令牌完成事件
 */
function subscribeTokenRefresh(resolve: (token: string) => void, reject: (error: Error) => void) {
  refreshSubscribers.push({ resolve, reject })
}

/**
 * 刷新订阅者
 */
function onRefreshed(token: string) {
  refreshSubscribers.map((cb) => cb.resolve(token))
  refreshSubscribers = []
}

/**
 * 刷新失败
 */
function onRefreshError(error: Error) {
  refreshSubscribers.map((cb) => cb.reject(error))
  refreshSubscribers = []
}

// 响应拦截器
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error
    const originalRequest = config

    // 如果是 401 错误且不是重复请求
    if (response && response.status === 401 && !originalRequest._retry) {
      // 如果是登录请求失败，直接返回错误
      if (originalRequest.url === '/auth/login') {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(
            (token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`
              resolve(httpClient(originalRequest))
            },
            (err) => {
              reject(err)
            },
          )
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const authStore = useAuthStore()
        const success = await authStore.refreshAccessToken()

        if (success && authStore.token) {
          onRefreshed(authStore.token)
          isRefreshing = false
          originalRequest.headers.Authorization = `Bearer ${authStore.token}`
          return httpClient(originalRequest)
        }
      } catch (refreshError) {
        onRefreshError(refreshError as Error)
        isRefreshing = false
        const authStore = useAuthStore()
        await authStore.logout()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)

export default httpClient
