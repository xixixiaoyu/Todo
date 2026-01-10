import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'
import { I18nContext } from 'nestjs-i18n'

/**
 * 全局异常过滤器
 * 统一处理所有未捕获的异常，返回标准化的错误响应格式
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const i18n = I18nContext.current(host)

    // 获取 HTTP 状态码
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    // 获取错误信息并进行国际化处理
    let message =
      exception instanceof HttpException ? exception.message : 'common.error.INTERNAL_SERVER_ERROR'

    // 处理 Zod 验证错误
    if (exception.name === 'ZodValidationException' && exception.getZodError) {
      const zodError = exception.getZodError()
      const firstIssue = zodError.issues[0]
      if (firstIssue) {
        // 如果错误消息是一个 i18n 键名，则进行翻译
        const key = firstIssue.message
        message = i18n
          ? i18n.t(key, { args: { property: firstIssue.path.join('.'), ...firstIssue } })
          : key
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
      statusCode: status,
      timestamp: new Date().toISOString(),
    })
  }
}
