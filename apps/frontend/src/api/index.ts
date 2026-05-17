import axios from 'axios'
import i18n from '@/i18n'
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

// 请求拦截器
httpClient.interceptors.request.use(
  (config) => {
    // 添加语言标识
    const currentLocale =
      (i18n.global.locale as { value?: string }).value || i18n.global.locale || 'zh-CN'
    config.headers['x-lang'] = currentLocale
    config.headers['Accept-Language'] = currentLocale

    return config
  },
  (error) => Promise.reject(error),
)

// 响应拦截器
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error

    if (response && response.status === 401) {
      return Promise.reject(error)
    }

    return Promise.reject(error)
  },
)
