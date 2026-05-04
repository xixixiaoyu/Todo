import { httpClient } from '@/api'
import { unwrapApiResponse } from '@lumina/shared'
import type { ApiResponse } from '@lumina/shared'

/**
 * 后端统一由 TransformInterceptor 包装成 { success, data, timestamp }，
 * 这些 helper 集中解包 axios 响应，避免各 feature 自行处理包装体
 * （v-for 错遍历包装对象会渲染出虚假条目、undefined 字段等问题）。
 */

export function getJson<T>(url: string): Promise<T> {
  return httpClient.get(url).then((r) => unwrapApiResponse<T>(r.data as ApiResponse<T>))
}

export function postJson<T>(url: string, data?: unknown): Promise<T> {
  return httpClient.post(url, data).then((r) => unwrapApiResponse<T>(r.data as ApiResponse<T>))
}

export function putJson<T>(url: string, data?: unknown): Promise<T> {
  return httpClient.put(url, data).then((r) => unwrapApiResponse<T>(r.data as ApiResponse<T>))
}

export function patchJson<T>(url: string, data?: unknown): Promise<T> {
  return httpClient.patch(url, data).then((r) => unwrapApiResponse<T>(r.data as ApiResponse<T>))
}

export function deleteJson<T>(url: string): Promise<T> {
  return httpClient.delete(url).then((r) => unwrapApiResponse<T>(r.data as ApiResponse<T>))
}
