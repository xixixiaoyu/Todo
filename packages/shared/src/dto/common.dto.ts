/**
 * API 成功响应
 */
export interface ApiSuccessResponse<T> {
  /** 是否成功 */
  success: true
  /** 响应数据 */
  data: T
  /** 时间戳 */
  timestamp: string
}

/**
 * API 错误响应
 */
export interface ApiErrorResponse {
  /** 是否成功 */
  success: false
  /** 响应数据（错误时固定为 null） */
  data: null
  /** 错误消息 */
  message: string
  /** 字段级错误 */
  errors?: Record<string, string>
  /** HTTP 状态码 */
  statusCode: number
  /** 时间戳 */
  timestamp: string
}

/**
 * 通用 API 响应格式（严格判别联合）
 */
export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse

/**
 * 类型守卫：判断是否为成功响应
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success
}

/**
 * 解包响应；若为错误响应则抛出带 message 的 Error
 */
export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (typeof (response as { success?: unknown }).success !== 'boolean') {
    return (response as { data: T }).data
  }
  if (response.success) {
    return response.data
  }
  throw new Error(response.message)
}

/**
 * 分页响应格式
 */
export interface PaginatedResponse<T> {
  /** 数据列表 */
  items: T[]
  /** 总数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页数量 */
  pageSize: number
  /** 总页数 */
  totalPages: number
}

/**
 * 分页查询参数
 */
export interface PaginationQuery {
  /** 页码 */
  page?: number
  /** 每页数量 */
  pageSize?: number
}
