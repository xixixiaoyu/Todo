import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BadGatewayException, BadRequestException } from '@nestjs/common'

const { lookupMock } = vi.hoisted(() => ({
  lookupMock: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  lookup: lookupMock,
}))

import { ExecuteHttpSkillRuntimeRequestSchema } from '@/skill-sources/skill-runtime.dto'
import { SkillRuntimeService } from '@/skill-sources/skill-runtime.service'

describe('SkillRuntimeService', () => {
  let service: SkillRuntimeService

  beforeEach(() => {
    service = new SkillRuntimeService()
    vi.clearAllMocks()
    vi.unstubAllGlobals()

    lookupMock.mockImplementation(async (hostname: string) => {
      if (hostname === 'api.tavily.com') {
        return [{ address: '104.26.15.87', family: 4 }]
      }

      if (hostname === 'api.example.com') {
        return [{ address: '93.184.216.34', family: 4 }]
      }

      if (hostname === 'safe.example.com') {
        return [{ address: '93.184.216.34', family: 4 }]
      }

      if (hostname === 'redirected.example.com') {
        return [{ address: '93.184.216.35', family: 4 }]
      }

      return [{ address: '93.184.216.34', family: 4 }]
    })
  })

  it('executes a generic HTTP runtime with bound args and client-provided secrets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          results: [
            {
              title: 'Headline A',
            },
          ],
        }),
      }),
    )

    const result = await service.executeHttpRuntime({
      skillName: 'tavily-search',
      runtime: {
        type: 'http',
        secrets: [
          {
            key: 'tavilyApiKey',
            required: true,
          },
        ],
        request: {
          url: 'https://api.tavily.com/search',
          method: 'POST',
          headers: {
            Authorization: {
              $source: 'secret',
              key: 'tavilyApiKey',
              prefix: 'Bearer ',
              required: true,
            },
          },
          body: {
            query: {
              $source: 'arg',
              key: 'query',
              required: true,
            },
            topic: {
              $source: 'arg',
              key: 'topic',
              default: 'finance',
            },
          },
          responseType: 'json',
        },
      },
      arguments: {
        query: 'latest finance news',
      },
      secrets: {
        tavilyApiKey: 'tvly-client-key',
      },
    })

    expect(fetch).toHaveBeenCalledWith(
      'https://api.tavily.com/search',
      expect.objectContaining({
        method: 'POST',
        redirect: 'manual',
        headers: expect.objectContaining({
          Authorization: 'Bearer tvly-client-key',
        }),
        body: JSON.stringify({
          query: 'latest finance news',
          topic: 'finance',
        }),
      }),
    )
    expect(result).toEqual({
      results: [
        {
          title: 'Headline A',
        },
      ],
    })
  })

  it('rejects envVar metadata from the request payload before execution', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(() =>
      ExecuteHttpSkillRuntimeRequestSchema.parse({
        skillName: 'finance-lookup',
        runtime: {
          type: 'http',
          secrets: [
            {
              key: 'financeApiKey',
              envVar: 'DATABASE_URL',
              required: true,
            },
          ],
          request: {
            url: 'https://api.example.com/finance',
            method: 'POST',
            body: {
              q: {
                $source: 'arg',
                key: 'query',
                required: true,
              },
            },
          },
        },
        arguments: {
          query: 'latest finance headlines',
        },
      }),
    ).toThrowError(/envVar/)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when a required runtime secret is missing', async () => {
    await expect(
      service.executeHttpRuntime({
        skillName: 'finance-lookup',
        runtime: {
          type: 'http',
          secrets: [
            {
              key: 'financeApiKey',
              required: true,
            },
          ],
          request: {
            url: 'https://api.example.com/finance',
            method: 'POST',
            headers: {
              Authorization: {
                $source: 'secret',
                key: 'financeApiKey',
                prefix: 'Bearer ',
                required: true,
              },
            },
          },
        },
        arguments: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('throws when a required runtime argument is missing', async () => {
    await expect(
      service.executeHttpRuntime({
        skillName: 'finance-lookup',
        runtime: {
          type: 'http',
          request: {
            url: 'https://api.example.com/finance',
            method: 'POST',
            body: {
              q: {
                $source: 'arg',
                key: 'query',
                required: true,
              },
            },
          },
        },
        arguments: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('blocks localhost skill runtime endpoints', async () => {
    await expect(
      service.executeHttpRuntime({
        skillName: 'unsafe-skill',
        runtime: {
          type: 'http',
          request: {
            url: 'http://127.0.0.1:3000/internal',
            method: 'GET',
          },
        },
        arguments: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('follows safe redirects manually and revalidates each hop', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: 'https://redirected.example.com/final',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    const result = await service.executeHttpRuntime({
      skillName: 'finance-lookup',
      runtime: {
        type: 'http',
        request: {
          url: 'https://safe.example.com/start',
          method: 'GET',
          responseType: 'json',
        },
      },
      arguments: {},
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://safe.example.com/start',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://redirected.example.com/final',
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
      }),
    )
    expect(result).toEqual({ ok: true })
  })

  it('blocks redirects to private or loopback destinations', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location: 'http://127.0.0.1:3000/internal',
        },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      service.executeHttpRuntime({
        skillName: 'unsafe-skill',
        runtime: {
          type: 'http',
          request: {
            url: 'https://safe.example.com/start',
            method: 'GET',
          },
        },
        arguments: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('wraps upstream HTTP failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      }),
    )

    await expect(
      service.executeHttpRuntime({
        skillName: 'finance-lookup',
        runtime: {
          type: 'http',
          request: {
            url: 'https://api.example.com/finance',
            method: 'GET',
            responseType: 'json',
          },
        },
        arguments: {},
      }),
    ).rejects.toBeInstanceOf(BadGatewayException)
  })
})
