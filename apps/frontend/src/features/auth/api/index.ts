import { httpClient } from '@/api'
import type { User, ApiResponse, AuthResponse, RegisterInput, LoginInput } from '@lumina/shared'

/**
 * 认证相关 API
 */
export const authApi = {
  /**
   * 获取当前用户信息
   */
  async getMe(): Promise<ApiResponse<User>> {
    const { data } = await httpClient.get<ApiResponse<User>>('/auth/me')
    return data
  },

  /**
   * 用户登录
   */
  async login(credentials: LoginInput): Promise<ApiResponse<AuthResponse>> {
    const { data } = await httpClient.post<ApiResponse<AuthResponse>>('/auth/login', credentials)
    return data
  },

  /**
   * 用户注册
   */
  async register(userData: RegisterInput): Promise<ApiResponse<AuthResponse>> {
    const { data } = await httpClient.post<ApiResponse<AuthResponse>>('/auth/register', userData)
    return data
  },

  /**
   * 请求密码重置
   */
  async forgotPassword(email: string): Promise<ApiResponse<{ message: string }>> {
    const { data } = await httpClient.post<ApiResponse<{ message: string }>>(
      '/auth/forgot-password',
      {
        email,
      },
    )
    return data
  },

  /**
   * 重置密码
   */
  async resetPassword(token: string, password: string): Promise<ApiResponse<{ message: string }>> {
    const { data } = await httpClient.post<ApiResponse<{ message: string }>>(
      '/auth/reset-password',
      {
        token,
        password,
      },
    )
    return data
  },

  /**
   * 刷新访问令牌
   */
  async refreshToken(refreshToken: string): Promise<ApiResponse<AuthResponse>> {
    const { data } = await httpClient.post<ApiResponse<AuthResponse>>('/auth/refresh', {
      refreshToken,
    })
    return data
  },

  /**
   * 用户登出
   */
  async logout(refreshToken: string): Promise<ApiResponse<{ message: string }>> {
    const { data } = await httpClient.post<ApiResponse<{ message: string }>>('/auth/logout', {
      refreshToken,
    })
    return data
  },

  /**
   * 上传用户头像
   */
  async uploadAvatar(file: File): Promise<ApiResponse<User>> {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await httpClient.post<ApiResponse<User>>('/users/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return data
  },
}
