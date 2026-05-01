import type { Context } from 'hono'
import { logger } from '../utils/logger'

/**
 * 统一错误响应，复用 ApiResponse 格式
 */
export function errorHandler(err: Error, c: Context) {
  logger.error(`Unhandled error: ${err.message}`, err.stack)

  const status = (err as unknown as { status?: number }).status || 500
  const message = err.message || 'Internal Server Error'

  return c.json(
    {
      success: false,
      data: null,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
    },
    status as 500,
  )
}

/**
 * 业务逻辑异常基类
 */
export class SidecarError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
  ) {
    super(message)
    this.name = 'SidecarError'
  }
}

export class NotFoundError extends SidecarError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 404)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends SidecarError {
  constructor(message: string) {
    super(message, 400)
    this.name = 'ValidationError'
  }
}
