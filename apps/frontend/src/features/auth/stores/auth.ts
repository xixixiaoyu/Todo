import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '../api'
import { setToken } from '@/api'
import type { User, LoginInput, RegisterInput } from '@my-app/shared'
import { startRegistration, startAuthentication } from '@simplewebauthn/browser'

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
        token.value = response.data.accessToken
        refreshToken.value = response.data.refreshToken || null
        user.value = response.data.user

        // 立即同步到拦截器内存，确保后续请求能拿到最新的 Token
        setToken(token.value)

        // 立即手动触发一次持久化同步，确保跨页面或刷新后能恢复
        localStorage.setItem(
          'auth',
          JSON.stringify({
            token: token.value,
            refreshToken: refreshToken.value,
            user: user.value,
          }),
        )

        // 登录成功后触发数据合并同步
        const { useTodoStore } = await import('@/features/todo/stores/todo')
        const todoStore = useTodoStore()
        await todoStore.mergeOnLogin()

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
        token.value = response.data.accessToken
        refreshToken.value = response.data.refreshToken || null
        user.value = response.data.user

        setToken(token.value)

        // 注册成功后触发数据同步
        const { useTodoStore } = await import('@/features/todo/stores/todo')
        const todoStore = useTodoStore()
        await todoStore.mergeOnLogin()

        return true
      } catch (e: unknown) {
        handleApiError(e, 'register.failed')
        return false
      } finally {
        loading.value = false
      }
    }

    /**
     * 请求密码重置
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
     * 注册 Passkey
     */
    async function registerPasskey(name?: string): Promise<boolean> {
      loading.value = true
      error.value = null
      fieldErrors.value = {}

      try {
        const options = await authApi.getPasskeyRegistrationOptions()
        const attResp = await startRegistration({ optionsJSON: options })
        await authApi.verifyPasskeyRegistration(attResp, name)
        return true
      } catch (e: unknown) {
        console.error('Passkey registration error:', e)
        handleApiError(e, 'passkey.registrationFailed')
        return false
      } finally {
        loading.value = false
      }
    }

    /**
     * 使用 Passkey 登录
     */
    async function loginWithPasskey(email: string): Promise<boolean> {
      loading.value = true
      error.value = null
      fieldErrors.value = {}

      try {
        const options = await authApi.getPasskeyLoginOptions(email)
        const asseResp = await startAuthentication({ optionsJSON: options })
        const response = await authApi.verifyPasskeyLogin(email, asseResp)

        token.value = response.data.accessToken
        refreshToken.value = response.data.refreshToken || null
        user.value = response.data.user

        setToken(token.value)

        // 登录成功后触发数据同步
        const { useTodoStore } = await import('@/features/todo/stores/todo')
        const todoStore = useTodoStore()
        await todoStore.mergeOnLogin()

        return true
      } catch (e: unknown) {
        console.error('Passkey login error:', e)
        handleApiError(e, 'passkey.loginFailed')
        return false
      } finally {
        loading.value = false
      }
    }

    /**
     * Google 登录
     */
    function loginWithGoogle() {
      const apiUrl = import.meta.env.VITE_API_BASE_URL
      window.location.href = `${apiUrl}/auth/google`
    }

    /**
     * 处理 OAuth 登录（从 Cookie 获取令牌）
     */
    async function handleOAuthLogin(): Promise<boolean> {
      loading.value = true
      error.value = null
      fieldErrors.value = {}

      try {
        const response = await authApi.oauthLogin()
        token.value = response.data.accessToken
        refreshToken.value = response.data.refreshToken || null
        user.value = response.data.user

        setToken(token.value)

        // 登录成功后触发数据合并同步
        const { useTodoStore } = await import('@/features/todo/stores/todo')
        const todoStore = useTodoStore()
        await todoStore.mergeOnLogin()

        return true
      } catch (e: unknown) {
        console.error('OAuth login error:', e)
        handleApiError(e, 'auth.oauthFailed')
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
        user.value = response.data
      } catch {
        void logout()
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

      try {
        const response = await authApi.refreshToken(refreshToken.value)
        token.value = response.data.accessToken
        refreshToken.value = response.data.refreshToken
        user.value = response.data.user
        setToken(token.value)
        return true
      } catch {
        void logout()
        return false
      }
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

      // 通知后端注销令牌（仅当本地曾有令牌时）
      if (currentRefreshToken && currentToken) {
        try {
          await authApi.logout(currentRefreshToken)
        } catch (e) {
          // 如果是 401，说明令牌本身已失效，无需处理
          console.warn('Backend logout failed (likely token expired):', e)
        }
      }

      // 登出时重置同步状态
      const { useTodoStore } = await import('@/features/todo/stores/todo')
      const todoStore = useTodoStore()
      todoStore.resetSyncStatus()
    }

    /**
     * 清除错误
     */
    function clearError(): void {
      error.value = null
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
      forgotPassword,
      resetPassword,
      registerPasskey,
      loginWithPasskey,
      loginWithGoogle,
      handleOAuthLogin,
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
