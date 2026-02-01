import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { I18nContext } from 'nestjs-i18n'

/**
 * 全局异常过滤器
 * 统一处理所有未捕获的异常，返回标准化的错误响应格式
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  private getPropertyName(path: string, i18n?: I18nContext): string {
    if (!i18n) return path
    const key = `common.fields.${path}`
    const translated = i18n.t(key)
    return translated !== key ? (translated as string) : path
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const i18n = I18nContext.current(host)

    // 获取 HTTP 状态码
    let status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    // 记录错误日志
    const url = request.originalUrl || request.url
    this.logger.error(
      `${request.method} ${url} - ${status} - ${
        exception instanceof Error ? exception.message : 'Unknown error'
      }`,
      exception instanceof Error ? exception.stack : undefined,
    )

    // 获取错误信息并进行国际化处理
    let message =
      exception instanceof HttpException ? exception.message : 'common.error.INTERNAL_SERVER_ERROR'
    let errors: Record<string, string> | undefined

    // 处理 Zod 验证错误
    const exceptionWithZod = exception as {
      name?: string
      getZodError?: () => { issues: Array<{ message: string; path: string[] }> }
    }
    if (exceptionWithZod.name === 'ZodValidationException' && exceptionWithZod.getZodError) {
      status = HttpStatus.BAD_REQUEST
      const zodError = exceptionWithZod.getZodError()
      errors = {}

      zodError.issues.forEach((issue) => {
        const path = issue.path.join('.')
        const key = issue.message

        // 提取所有可能的参数用于国际化
        const anyIssue = issue as Record<string, unknown>
        const args = {
          property: this.getPropertyName(path, i18n),
          ...anyIssue,
          min: anyIssue.minimum ?? anyIssue.min,
          max: anyIssue.maximum ?? anyIssue.max,
          limit: anyIssue.limit,
        }

        // 如果 message 本身就是翻译后的文本（包含空格），则直接使用
        if (key.includes(' ')) {
          errors![path] = key
        } else {
          // 否则尝试使用 i18n 翻译，如果翻译失败则返回原始 key
          const translated = i18n ? i18n.t(key, { args }) : key
          errors![path] = typeof translated === 'string' ? translated : key
        }
      })

      message = i18n ? (i18n.t('common.VALIDATION_ERROR') as string) : 'Validation failed'
    } else if (exception instanceof HttpException) {
      const responseBody = exception.getResponse()
      if (typeof responseBody === 'object' && responseBody !== null) {
        const body = responseBody as Record<string, unknown>
        // 处理 ConflictException 等业务异常中可能包含的字段映射
        if (body.errors && typeof body.errors === 'object') {
          errors = body.errors as Record<string, string>
        } else if (typeof body.message === 'string') {
          // 尝试根据消息内容推断字段
          const fieldMapping: Record<string, string> = {
            'auth.EMAIL_EXISTS': 'email',
            'auth.USER_NOT_FOUND': 'email',
            'auth.INVALID_CREDENTIALS': 'password',
          }

          const field = fieldMapping[body.message]
          if (field) {
            const translatedMessage = i18n ? (i18n.t(body.message) as string) : body.message
            errors = { [field]: translatedMessage }
            message = translatedMessage
          }
        }
      }

      if (i18n && typeof message === 'string' && message.includes('.')) {
        message = i18n.t(message)
      }
    } else if (i18n && typeof message === 'string' && message.includes('.')) {
      // 尝试翻译普通错误消息（如果看起来像一个键名）
      message = i18n.t(message)
    }

    // 默认翻译
    if (message === 'common.error.INTERNAL_SERVER_ERROR' && i18n) {
      message = i18n.t('common.error.INTERNAL_SERVER_ERROR', {
        defaultValue: 'Internal Server Error',
      })
    }

    // 返回标准化错误响应
    response.status(status).json({
      success: false,
      data: null,
      message,
      errors, // 新增：结构化错误对象
      statusCode: status,
      timestamp: new Date().toISOString(),
    })
  }
}
