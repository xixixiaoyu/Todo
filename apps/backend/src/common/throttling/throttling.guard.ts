import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

type ProxyAwareRequest = {
  ips?: string[]
  ip?: string
}

function isNonEmptyIp(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

function getLastForwardedIp(ips?: string[]): string | undefined {
  if (!Array.isArray(ips)) {
    return undefined
  }

  for (let index = ips.length - 1; index >= 0; index -= 1) {
    const value = ips[index]
    if (isNonEmptyIp(value)) {
      return value
    }
  }

  return undefined
}

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: ProxyAwareRequest): Promise<string> {
    return isNonEmptyIp(req.ip) ? req.ip : (getLastForwardedIp(req.ips) ?? 'unknown')
  }
}
