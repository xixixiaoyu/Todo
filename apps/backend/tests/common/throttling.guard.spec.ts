import { describe, expect, it } from 'vitest'
import { AppThrottlerGuard } from '@/common'

describe('AppThrottlerGuard', () => {
  it('prefers Fastify request.ip when trustProxy is enabled', async () => {
    const tracker = await (
      AppThrottlerGuard.prototype as AppThrottlerGuard & {
        getTracker: (req: { ip?: string; ips?: string[] }) => Promise<string>
      }
    ).getTracker({
      ip: '203.0.113.10',
      ips: ['127.0.0.1', '198.51.100.8', '203.0.113.10'],
    })

    expect(tracker).toBe('203.0.113.10')
  })

  it('falls back to the last forwarded IP when request.ip is unavailable', async () => {
    const tracker = await (
      AppThrottlerGuard.prototype as AppThrottlerGuard & {
        getTracker: (req: { ip?: string; ips?: string[] }) => Promise<string>
      }
    ).getTracker({
      ips: ['127.0.0.1', '198.51.100.8', '203.0.113.10'],
    })

    expect(tracker).toBe('203.0.113.10')
  })

  it('ignores empty request.ip values and still resolves the client IP from the proxy chain', async () => {
    const tracker = await (
      AppThrottlerGuard.prototype as AppThrottlerGuard & {
        getTracker: (req: { ip?: string; ips?: string[] }) => Promise<string>
      }
    ).getTracker({
      ip: '',
      ips: ['127.0.0.1', '198.51.100.8', '203.0.113.10'],
    })

    expect(tracker).toBe('203.0.113.10')
  })
})
