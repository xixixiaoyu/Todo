import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

type ProxyAwareRequest = {
  ips?: string[]
  ip?: string
}

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: ProxyAwareRequest): Promise<string> {
    const forwardedIp = Array.isArray(req.ips)
      ? req.ips.find((value) => typeof value === 'string' && value.length > 0)
      : undefined

    return forwardedIp ?? req.ip ?? 'unknown'
  }
}
