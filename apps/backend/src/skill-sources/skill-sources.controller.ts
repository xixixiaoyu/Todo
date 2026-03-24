import { BadGatewayException, BadRequestException, Controller, Get, Query } from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { EXTERNAL_SOURCE_THROTTLE } from '../common'

const TRUSTED_SKILL_SOURCE_HOSTS = new Set([
  'raw.githubusercontent.com',
  'github.com',
  'lightmake.site',
  'skillhub-1388575217.cos.ap-guangzhou.myqcloud.com',
  'skillhub-1388575217.cos.accelerate.myqcloud.com',
  'skillhub.club',
  'www.skillhub.club',
  'clawhub.ai',
])
const MAX_EXTERNAL_SOURCE_BYTES = 2 * 1024 * 1024
const EXTERNAL_FETCH_TIMEOUT_MS = 12000
const MAX_EXTERNAL_REDIRECTS = 5
const EXTERNAL_SOURCE_ACCEPT_HEADER = 'application/json, text/markdown, text/plain, application/zip'

type ExternalSkillSourcePayload = {
  sourceUrl: string
  finalUrl: string
  contentType: string
  contentLength: number
  bodyBase64: string
}

function parseHttpUrl(input: string): URL {
  const value = input.trim()
  if (!value) throw new BadRequestException('skills_source.URL_REQUIRED')

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new BadRequestException('skills_source.INVALID_URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException('skills_source.INVALID_PROTOCOL')
  }

  return parsed
}

function assertTrustedHost(url: URL, errorKey: string) {
  if (TRUSTED_SKILL_SOURCE_HOSTS.has(url.hostname)) return
  throw new BadRequestException(`${errorKey}: ${url.hostname}`)
}

function isRedirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status)
}

function createFileTooLargeException(size: number): BadRequestException {
  return new BadRequestException(`skills_source.FILE_TOO_LARGE: ${size}`)
}

function toBufferChunk(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (value instanceof ArrayBuffer) return Buffer.from(value)
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  }
  if (typeof value === 'string') return Buffer.from(value)

  throw new BadGatewayException('skills_source.UNSUPPORTED_RESPONSE_CHUNK')
}

async function readResponseBytesWithLimit(response: Response, maxBytes: number): Promise<Buffer> {
  const contentLength = Number(response.headers.get('content-length') || '')
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw createFileTooLargeException(contentLength)
  }

  if (!response.body) {
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.byteLength > maxBytes) {
      throw createFileTooLargeException(bytes.byteLength)
    }
    return bytes
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = toBufferChunk(value)
      totalBytes += chunk.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw createFileTooLargeException(totalBytes)
      }

      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock()
  }

  return Buffer.concat(chunks, totalBytes)
}

async function fetchExternalSourceWithTrustedRedirects(params: {
  sourceUrl: URL
  signal: AbortSignal
}): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = params.sourceUrl

  for (let redirectCount = 0; redirectCount <= MAX_EXTERNAL_REDIRECTS; redirectCount++) {
    assertTrustedHost(
      currentUrl,
      redirectCount === 0
        ? 'skills_source.UNTRUSTED_SOURCE_HOST'
        : 'skills_source.UNTRUSTED_REDIRECT_HOST',
    )

    const response = await fetch(currentUrl.toString(), {
      method: 'GET',
      headers: {
        Accept: EXTERNAL_SOURCE_ACCEPT_HEADER,
      },
      redirect: 'manual',
      signal: params.signal,
    })

    if (!isRedirectStatus(response.status)) {
      return {
        response,
        finalUrl: currentUrl.toString(),
      }
    }

    if (redirectCount === MAX_EXTERNAL_REDIRECTS) {
      throw new BadGatewayException('skills_source.TOO_MANY_REDIRECTS')
    }

    const location = response.headers.get('location')
    if (!location) {
      throw new BadGatewayException('skills_source.REDIRECT_LOCATION_REQUIRED')
    }

    const nextUrl = parseHttpUrl(new URL(location, currentUrl).toString())
    assertTrustedHost(nextUrl, 'skills_source.UNTRUSTED_REDIRECT_HOST')
    currentUrl = nextUrl
  }

  throw new BadGatewayException('skills_source.TOO_MANY_REDIRECTS')
}

@ApiTags('技能来源')
@Controller('skills')
export class SkillSourcesController {
  @Get('external-source')
  @Throttle(EXTERNAL_SOURCE_THROTTLE)
  @ApiOperation({ summary: '代理拉取外部技能来源（绕过浏览器 CORS）' })
  @ApiQuery({ name: 'url', required: true, description: '外部技能 URL' })
  async getExternalSource(@Query('url') url: string): Promise<ExternalSkillSourcePayload> {
    const sourceUrl = parseHttpUrl(url)
    assertTrustedHost(sourceUrl, 'skills_source.UNTRUSTED_SOURCE_HOST')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), EXTERNAL_FETCH_TIMEOUT_MS)

    try {
      const { response, finalUrl } = await fetchExternalSourceWithTrustedRedirects({
        sourceUrl,
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new BadGatewayException(`HTTP ${response.status}`)
      }

      const bytes = await readResponseBytesWithLimit(response, MAX_EXTERNAL_SOURCE_BYTES)

      return {
        sourceUrl: sourceUrl.toString(),
        finalUrl,
        contentType: response.headers.get('content-type') || '',
        contentLength: bytes.byteLength,
        bodyBase64: bytes.toString('base64'),
      }
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error
      }

      const message = error instanceof Error ? error.message : String(error)
      throw new BadGatewayException(`skills_source.FETCH_FAILED: ${message}`)
    } finally {
      clearTimeout(timeout)
    }
  }
}
