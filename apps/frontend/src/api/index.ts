import axios from 'axios'
import { useAuthStore } from '@/features/auth/stores/auth'

/**
 * HTTP 客户端实例
 */
const httpClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

/**
 * 初始化 CSRF Token
 * 在首次请求前发起一个 GET 请求获取 CSRF token cookie
 */
let csrfInitialized = false

async function initCsrfToken(): Promise<void> {
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
 * 刷新令牌成功后通知所有订阅者
 */
function onRefreshed(token: string) {
  refreshSubscribers.forEach(({ resolve }) => resolve(token))
  refreshSubscribers = []
}

/**
 * 刷新令牌失败后通知所有订阅者
 */
function onRefreshFailed(error: Error) {
  refreshSubscribers.forEach(({ reject }) => reject(error))
  refreshSubscribers = []
}

// 响应拦截器
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // 处理 401 错误
    if (error.response?.status === 401 && !originalRequest._retry) {
      // 如果正在刷新，将请求加入队列
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(httpClient(originalRequest))
          }, reject)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const authStore = useAuthStore()
        const success = await authStore.refreshAccessToken()

        if (success && authStore.token) {
          const newToken = authStore.token
          onRefreshed(newToken)
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return httpClient(originalRequest)
        } else {
          // 刷新失败，通知所有等待的请求
          const refreshError = new Error('Token refresh failed')
          onRefreshFailed(refreshError)
          throw refreshError
        }
      } catch (refreshError) {
        // 刷新失败，通知所有等待的请求并清除认证状态
        onRefreshFailed(
          refreshError instanceof Error ? refreshError : new Error('Token refresh failed'),
        )
        localStorage.removeItem('auth')
        // 触发登出事件，让组件决定是否跳转
        window.dispatchEvent(new CustomEvent('auth:logout'))
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

export { httpClient, initCsrfToken }
