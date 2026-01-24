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

    // 计算属性
    const isAuthenticated = computed(() => !!token.value || !!user.value)

    /**
     * 登录
     */
    async function login(credentials: LoginInput): Promise<boolean> {
      loading.value = true
      error.value = null

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
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || 'login.failed'
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
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || 'register.failed'
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

      try {
        await authApi.forgotPassword(email)
        return true
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || 'forgotPassword.failed'
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

      try {
        await authApi.resetPassword(tokenValue, password)
        return true
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || 'resetPassword.failed'
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

      try {
        const options = await authApi.getPasskeyRegistrationOptions()
        const attResp = await startRegistration({ optionsJSON: options })
        await authApi.verifyPasskeyRegistration(attResp, name)
        return true
      } catch (e: unknown) {
        console.error('Passkey registration error:', e)
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || 'passkey.registrationFailed'
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
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || 'passkey.loginFailed'
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
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || 'auth.oauthFailed'
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
        return false
      }

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
      // 计算属性
      isAuthenticated,
      // 方法
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
