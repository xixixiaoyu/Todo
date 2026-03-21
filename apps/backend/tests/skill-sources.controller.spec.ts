import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { SkillSourcesController } from '@/skill-sources/skill-sources.controller'

function createByteStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

describe('SkillSourcesController', () => {
  let controller: SkillSourcesController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new SkillSourcesController()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('follows trusted redirects manually before downloading content', async () => {
    const sourceUrl = 'https://lightmake.site/api/v1/download?slug=tavily-search'
    const redirectedUrl =
      'https://skillhub-1388575217.cos.accelerate.myqcloud.com/skills/tavily-search/1.0.0.zip'
    const payload = Buffer.from('skill-package')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            location: redirectedUrl,
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(payload, {
          status: 200,
          headers: {
            'content-type': 'application/zip',
          },
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    const result = await controller.getExternalSource(sourceUrl)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      sourceUrl,
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      redirectedUrl,
      expect.objectContaining({
        method: 'GET',
        redirect: 'manual',
      }),
    )
    expect(result.sourceUrl).toBe(sourceUrl)
    expect(result.finalUrl).toBe(redirectedUrl)
    expect(Buffer.from(result.bodyBase64, 'base64')).toEqual(payload)
  })

  it('rejects untrusted redirect targets before following them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location: 'https://example.com/evil.zip',
        },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const result = controller.getExternalSource(
      'https://lightmake.site/api/v1/download?slug=tavily-search',
    )

    await expect(result).rejects.toBeInstanceOf(BadRequestException)
    await expect(result).rejects.toMatchObject({
      message: expect.stringContaining('skills_source.UNTRUSTED_REDIRECT_HOST'),
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects oversized streamed payloads without relying on content-length', async () => {
    const oversizedStream = createByteStream([
      new Uint8Array(1024 * 1024),
      new Uint8Array(1024 * 1024),
      new Uint8Array(128 * 1024),
    ])

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(oversizedStream, {
          status: 200,
          headers: {
            'content-type': 'application/zip',
          },
        }),
      ),
    )

    const result = controller.getExternalSource(
      'https://raw.githubusercontent.com/openai/skills/main/skills/.curated/gh-address-comments/SKILL.md',
    )

    await expect(result).rejects.toBeInstanceOf(BadRequestException)
    await expect(result).rejects.toMatchObject({
      message: expect.stringContaining('skills_source.FILE_TOO_LARGE'),
    })
  })
})
