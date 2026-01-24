import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import sanitizeHtml from 'sanitize-html'

/**
 * XSS 清理拦截器
 * 自动清理请求体中的 HTML/XSS 内容
 */
@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  private sanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: [], // 不允许任何 HTML 标签
    allowedAttributes: {},
    disallowedTagsMode: 'recursiveEscape',
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest()

    // 清理请求体
    if (request.body && typeof request.body === 'object') {
      this.sanitizeInPlace(request.body)
    }

    // 清理查询参数
    if (request.query && typeof request.query === 'object') {
      this.sanitizeInPlace(request.query)
    }

    // 清理路径参数
    if (request.params && typeof request.params === 'object') {
      this.sanitizeInPlace(request.params)
    }

    return next.handle()
  }

  /**
   * 原地递归清理对象中的字符串值
   */
  private sanitizeInPlace(obj: Record<string, unknown> | unknown[]): void {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const val = obj[i]
        if (typeof val === 'string') {
          ;(obj as string[])[i] = sanitizeHtml(val, this.sanitizeOptions)
        } else if (val && typeof val === 'object') {
          this.sanitizeInPlace(val as Record<string, unknown> | unknown[])
        }
      }
    } else if (obj && typeof obj === 'object') {
      const record = obj as Record<string, unknown>
      for (const key of Object.keys(record)) {
        const val = record[key]
        if (typeof val === 'string') {
          record[key] = sanitizeHtml(val, this.sanitizeOptions)
        } else if (val && typeof val === 'object') {
          this.sanitizeInPlace(val as Record<string, unknown> | unknown[])
        }
      }
    }
  }
}
