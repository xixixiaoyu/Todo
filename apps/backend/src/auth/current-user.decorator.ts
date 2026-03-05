import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { User } from '@lumina/shared'

/**
 * 当前用户装饰器
 * 用于从请求中获取当前登录的用户信息
 */
export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest() as { user?: User; raw?: { user?: User } }
    const user = request.user ?? request.raw?.user

    if (data) {
      return user?.[data]
    }
    return user
  },
)
