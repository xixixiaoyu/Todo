import axios from 'axios'
import i18n from '@/i18n'
import { useAuthStore } from '@/features/auth/stores/auth'
import { getApiBaseUrl } from '@/api/config'

/**
 * HTTP 客户端实例
 */
export const httpClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

/**
 * 从 localStorage 获取 token（兼容 pinia 持久化）
 */
let activeToken: string | null = null

/**
 * 尝试从各种可能的地方获取 token
 */
export function getToken(): string | null {
  // 1. 优先从内存获取（解决登录瞬间的竞态问题）
  if (activeToken) {
    return activeToken
  }

  // 2. 尝试从 localStorage 读取 auth 数据
  try {
    const authData = localStorage.getItem('auth')
    if (authData) {
      const parsed = JSON.parse(authData)
      // 兼容 pinia-plugin-persistedstate 的不同存储结构
      // 1. 直接存储: { token: '...' }
      // 2. 存储在 state 下: { state: { token: '...' } }
      // 3. 嵌套在 store 名下: { auth: { token: '...' } }
      const state = parsed.state || parsed.auth || parsed
      const token = state.token

      if (token) {
        activeToken = token // 顺便更新内存缓存
        return token
      }
    }
  } catch (error) {
    console.warn('Failed to parse auth token from localStorage:', error)
  }

  return null
}

export function setToken(token: string | null): void {
  activeToken = token
}

// 初始化时同步一次
getToken()

// 请求拦截器
httpClient.interceptors.request.use(
  async (config) => {
    // 获取最新的 token
    const token = getToken()

    // 如果存在 token，添加到请求头
    // 排除刷新接口本身，避免用旧的 AccessToken 去请求刷新
    if (token && !config.url?.includes('/auth/refresh')) {
      // 使用 set 方法确保正确设置 header（兼容 Axios 1.x AxiosHeaders）
      if (config.headers.set) {
        config.headers.set('Authorization', `Bearer ${token}`)
      } else {
        config.headers.Authorization = `Bearer ${token}`
      }
    }

    // 添加语言标识
    const currentLocale =
      (i18n.global.locale as { value?: string }).value || i18n.global.locale || 'zh-CN'
    config.headers['x-lang'] = currentLocale
    config.headers['Accept-Language'] = currentLocale

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
      // 如果是登录或刷新请求失败，直接返回错误，避免死锁
      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh')
      ) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(
            (token) => {
              const headers = originalRequest.headers
              if (headers?.set) {
                headers.set('Authorization', `Bearer ${token}`)
              } else {
                originalRequest.headers = {
                  ...headers,
                  Authorization: `Bearer ${token}`,
                }
              }
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
          // 确保在重试请求中也使用 set 方法
          if (originalRequest.headers.set) {
            originalRequest.headers.set('Authorization', `Bearer ${authStore.token}`)
          } else {
            originalRequest.headers.Authorization = `Bearer ${authStore.token}`
          }
          return httpClient(originalRequest)
        }

        const refreshError = new Error(
          authStore.isAuthenticated ? 'Refresh token unavailable' : 'Refresh token invalid',
        )
        onRefreshError(refreshError)
        isRefreshing = false
        return Promise.reject(refreshError)
      } catch (refreshError) {
        onRefreshError(refreshError as Error)
        isRefreshing = false
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)
