import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api'
import { setToken } from '@/api'
import { unwrapApiResponse, type User, type LoginInput, type RegisterInput } from '@lumina/shared'
import { emitAiStorageScopeChanged } from '@/features/ai/composables/aiStorageScope'
import { requestAnonymousAiMigration } from '@/features/ai/composables/useAiAnonymousMigration'

const refreshRetryDelayMs = 300
const refreshMaxAttempts = 2

type AuthTelemetryEvent =
  | 'refresh_retry'
  | 'refresh_failed_transient'
  | 'refresh_failed_unauthorized'
  | 'fetch_me_failed_transient'
  | 'fetch_me_failed_unauthorized'

/**
 * 认证状态管理
 * 使用 pinia-plugin-persistedstate 持久化 token
 */
export const useAuthStore = defineStore(
  'auth',
  () => {
    // 状态
    const token = ref<string | null>(null)
    const refreshToken = ref<string | null>(null)
    const user = ref<User | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)
    const fieldErrors = ref<Record<string, string>>({})

    // 计算属性
    const isAuthenticated = computed(() => !!token.value)

    /**
     * 处理 API 错误
     */
    function handleApiError(e: unknown, defaultMessage: string): void {
      const err = e as {
        response?: {
          data?: {
            message?: string
            errors?: Record<string, string>
          }
        }
      }
      error.value = err.response?.data?.message || defaultMessage
      fieldErrors.value = err.response?.data?.errors || {}
    }

    function persistAuthState(): void {
      localStorage.setItem(
        'auth',
        JSON.stringify({
          token: token.value,
          refreshToken: refreshToken.value,
          user: user.value,
        }),
      )

      emitAiStorageScopeChanged(user.value?.id || null)
    }

    function clearPersistedAuth(): void {
      localStorage.removeItem('auth')
      emitAiStorageScopeChanged(null)
    }

    function isUnauthorizedError(e: unknown): boolean {
      const maybeError = e as {
        response?: {
          status?: number
        }
      }
      return maybeError.response?.status === 401
    }

    function isTransientError(e: unknown): boolean {
      const maybeError = e as {
        code?: string
        response?: {
          status?: number
        }
      }
      const status = maybeError.response?.status
      if (typeof status === 'number') {
        return status >= 500
      }

      return (
        maybeError.code === 'ECONNABORTED' ||
        maybeError.code === 'ERR_NETWORK' ||
        maybeError.code === 'ETIMEDOUT'
      )
    }

    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms))
    }

    function reportAuthEvent(event: AuthTelemetryEvent, extra?: Record<string, unknown>): void {
      const detail = {
        event,
        ts: Date.now(),
        ...extra,
      }
      window.dispatchEvent(new CustomEvent('auth:telemetry', { detail }))
    }

    function hydrateFromStorage(): void {
      if (token.value && refreshToken.value && user.value) return

      try {
        const authData = localStorage.getItem('auth')
        if (!authData) return

        const parsed = JSON.parse(authData)
        const storedToken = parsed.token || parsed.state?.token || parsed.auth?.token
        const storedRefreshToken =
          parsed.refreshToken || parsed.state?.refreshToken || parsed.auth?.refreshToken
        const storedUser = parsed.user || parsed.state?.user || parsed.auth?.user

        if (!token.value && storedToken) {
          token.value = storedToken
        }

        if (!refreshToken.value && storedRefreshToken) {
          refreshToken.value = storedRefreshToken
        }

        if (!user.value && storedUser) {
          user.value = storedUser
        }

        if (token.value) {
          setToken(token.value)
        }
      } catch {
        return
      }
    }

    /**
     * 登录
     */
    async function login(credentials: LoginInput): Promise<boolean> {
      loading.value = true
      error.value = null
      fieldErrors.value = {}

      try {
        const response = await authApi.login(credentials)
        const payload = unwrapApiResponse(response)
        token.value = payload.accessToken
        refreshToken.value = payload.refreshToken || null
        user.value = payload.user

        // 立即同步到拦截器内存，确保后续请求能拿到最新的 Token
        setToken(token.value)

        // 立即手动触发一次持久化同步，确保跨页面或刷新后能恢复
        persistAuthState()

        // 登录成功后触发数据合并同步
        const { useTodoStore } = await import('@/features/todo/stores/todo')
        const todoStore = useTodoStore()
        await todoStore.mergeOnLogin(payload.user.id)
        requestAnonymousAiMigration(payload.user.id)

        return true
      } catch (e: unknown) {
        handleApiError(e, 'login.failed')
        return false
      } finally {
        loading.value = false
      }
    }

    /**
     * 注册
     */
    async function register(userData: RegisterInput): Promise<boolean> {
      loading.value = true
      error.value = null
      fieldErrors.value = {}

      try {
        const response = await authApi.register(userData)
        const payload = unwrapApiResponse(response)
        token.value = payload.accessToken
        refreshToken.value = payload.refreshToken || null
        user.value = payload.user

        setToken(token.value)
        persistAuthState()

        // 注册成功后触发数据同步
        const { useTodoStore } = await import('@/features/todo/stores/todo')
        const todoStore = useTodoStore()
        await todoStore.mergeOnLogin(payload.user.id)
        requestAnonymousAiMigration(payload.user.id)

        return true
      } catch (e: unknown) {
        handleApiError(e, 'register.failed')
        return false
      } finally {
        loading.value = false
      }
    }

    /**
     * 上传用户头像
     */
    async function uploadAvatar(file: File): Promise<boolean> {
      loading.value = true
      error.value = null

      try {
        const response = await authApi.uploadAvatar(file)
        const updatedUser = unwrapApiResponse(response)
        user.value = updatedUser
        persistAuthState()
        return true
      } catch (e: unknown) {
        handleApiError(e, 'upload.avatar_failed')
        return false
      } finally {
        loading.value = false
      }
    }

    /**
     * 刷新访问令牌
     */
    async function forgotPassword(email: string): Promise<boolean> {
      loading.value = true
      error.value = null
      fieldErrors.value = {}

      try {
        await authApi.forgotPassword(email)
        return true
      } catch (e: unknown) {
        handleApiError(e, 'forgotPassword.failed')
        return false
      } finally {
        loading.value = false
      }
    }

    /**
     * 重置密码
     */
    async function resetPassword(tokenValue: string, password: string): Promise<boolean> {
      loading.value = true
      error.value = null
      fieldErrors.value = {}

      try {
        await authApi.resetPassword(tokenValue, password)
        return true
      } catch (e: unknown) {
        handleApiError(e, 'resetPassword.failed')
        return false
      } finally {
        loading.value = false
      }
    }

    /**
     * 获取当前用户信息
     */
    async function fetchCurrentUser(): Promise<void> {
      if (!token.value) return

      try {
        const response = await authApi.getMe()
        user.value = unwrapApiResponse(response)
      } catch (e: unknown) {
        if (isUnauthorizedError(e)) {
          reportAuthEvent('fetch_me_failed_unauthorized')
          void logout()
        } else {
          reportAuthEvent('fetch_me_failed_transient')
          console.warn('Fetch current user failed (transient):', e)
        }
      }
    }

    /**
     * 刷新访问令牌
     */
    async function refreshAccessToken(): Promise<boolean> {
      if (!refreshToken.value) {
        hydrateFromStorage()
      }

      if (!refreshToken.value) return false

      const maxAttempts = refreshMaxAttempts
      let lastError: unknown = null

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const response = await authApi.refreshToken(refreshToken.value)
          const payload = unwrapApiResponse(response)
          token.value = payload.accessToken
          refreshToken.value = payload.refreshToken
          user.value = payload.user
          setToken(token.value)
          persistAuthState()
          return true
        } catch (e: unknown) {
          lastError = e

          if (isUnauthorizedError(e)) {
            reportAuthEvent('refresh_failed_unauthorized')
            void logout()
            return false
          }

          const shouldRetry = attempt < maxAttempts && isTransientError(e)
          if (shouldRetry) {
            reportAuthEvent('refresh_retry', { attempt, maxAttempts })
            await sleep(refreshRetryDelayMs)
            continue
          }

          reportAuthEvent('refresh_failed_transient')
          console.warn('Refresh access token failed (transient):', e)
          return false
        }
      }

      reportAuthEvent('refresh_failed_transient')
      console.warn('Refresh access token failed (transient):', lastError)
      return false
    }

    /**
     * 登出
     */
    async function logout(): Promise<void> {
      const currentToken = token.value
      const currentRefreshToken = refreshToken.value

      // 先清除本地状态，确保 UI 立即响应
      token.value = null
      refreshToken.value = null
      user.value = null
      error.value = null
      setToken(null)
      clearPersistedAuth()

      // 通知后端注销令牌（仅当本地曾有令牌时）
      if (currentRefreshToken && currentToken) {
        try {
          await authApi.logout(currentRefreshToken)
        } catch (e) {
          // 如果是 401，说明令牌本身已失效，无需处理
          console.warn('Backend logout failed (likely token expired):', e)
        }
      }

      // 登出时清理远程待办数据并回退到本地视图
      const { useTodoStore } = await import('@/features/todo/stores/todo')
      const todoStore = useTodoStore()
      todoStore.clearRemoteOnLogout()
    }

    /**
     * 清除错误
     */
    function clearError(): void {
      error.value = null
      fieldErrors.value = {}
    }

    return {
      // 状态
      token,
      refreshToken,
      user,
      loading,
      error,
      fieldErrors,
      // 计算属性
      isAuthenticated,
      // 方法
      hydrateFromStorage,
      login,
      register,
      uploadAvatar,
      forgotPassword,
      resetPassword,
      logout,
      fetchCurrentUser,
      refreshAccessToken,
      clearError,
    }
  },
  {
    persist: {
      key: 'auth',
      storage: localStorage,
      pick: ['token', 'refreshToken', 'user'],
    },
  },
)
