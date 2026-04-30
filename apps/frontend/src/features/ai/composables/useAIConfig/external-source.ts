import { httpClient } from '@/api'
import {
  buildExternalSkillSourceCandidates,
  isTrustedSkillSourceUrl,
} from '@/features/ai/services/aiService'
import type { ApiResponse } from '@lumina/shared'
import type { ExternalSkillSourcePayload } from './types'
import {
  EXTERNAL_SOURCE_ACCEPT_HEADER,
  EXTERNAL_PROXY_TIMEOUT_MS,
  PROXY_FIRST_EXTERNAL_SOURCE_HOSTS,
  MAX_SKILL_ARCHIVE_BYTES,
  MAX_SKILL_FILE_BYTES,
} from './types'
import {
  assertTrustedResolvedSourceUrl,
  computeSha256,
  decodeBase64ToBytes,
  decodeExternalSourceContentFromBytes,
  decodeUtf8,
  extractSkillArchivePayloadFromZipArchive,
  isZipContentType,
  normalizeExpectedSha256,
  readResponseBytesWithLimit,
} from './skill-utils'

// ─── Proxy & Error Helpers ─────────────────────────────────────────

export function shouldPreferProxyForExternalSource(url: string): boolean {
  try {
    const parsed = new URL(url)
    return PROXY_FIRST_EXTERNAL_SOURCE_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

export function isNetworkLikeFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('cors') ||
    message.includes('load failed')
  )
}

export function getHttpErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message

  if (error && typeof error === 'object') {
    const maybeResponse = (error as { response?: unknown }).response
    if (maybeResponse && typeof maybeResponse === 'object') {
      const maybeMessage = (maybeResponse as { data?: { message?: unknown } }).data?.message
      if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
        return maybeMessage
      }
    }
  }

  return String(error)
}

// ─── Proxy Fetch ───────────────────────────────────────────────────

async function fetchExternalSourceViaProxy(url: string): Promise<{
  contentType: string
  contentBytes: Uint8Array
  finalUrl: string
}> {
  const response = await httpClient.get<ApiResponse<ExternalSkillSourcePayload>>(
    '/skills/external-source',
    {
      params: { url },
      timeout: EXTERNAL_PROXY_TIMEOUT_MS,
    },
  )

  const payload = response.data?.success ? response.data.data : null
  if (!payload || typeof payload.bodyBase64 !== 'string') {
    throw new Error('Invalid proxy response payload.')
  }

  assertTrustedResolvedSourceUrl(payload.sourceUrl || url)
  assertTrustedResolvedSourceUrl(
    payload.finalUrl || payload.sourceUrl || url,
    'Untrusted redirect host',
  )

  return {
    contentType: (payload.contentType || '').toLowerCase(),
    contentBytes: decodeBase64ToBytes(payload.bodyBase64),
    finalUrl: payload.finalUrl || payload.sourceUrl || url,
  }
}

// ─── External Source Fetch ─────────────────────────────────────────

/**
 * 从外部源获取技能内容，支持代理回退与 SHA256 校验。
 * 遍历候选 URL，首个成功即返回；全部失败时抛出聚合错误。
 */
export async function fetchSkillContentFromExternalSource(
  source: string,
  options?: {
    expectedSha256?: string | null
  },
): Promise<{ content: string; sourceUrl: string; sha256: string }> {
  const expectedSha256 = normalizeExpectedSha256(options?.expectedSha256)
  if (options?.expectedSha256 && !expectedSha256) {
    throw new Error('Invalid SHA256 format. Expected 64 hex characters.')
  }

  const candidates = buildExternalSkillSourceCandidates(source)
  if (candidates.length === 0) {
    throw new Error(
      'Invalid external source. Use a URL, GitHub path (owner/repo/path), or skillhub install command.',
    )
  }

  const untrusted = candidates.filter((url) => !isTrustedSkillSourceUrl(url))
  if (untrusted.length > 0) {
    throw new Error(`Untrusted source host: ${untrusted.join(', ')}`)
  }

  const errors: string[] = []

  for (const url of candidates) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)
    const preferProxy = shouldPreferProxyForExternalSource(url)

    try {
      if (preferProxy) {
        const proxied = await fetchExternalSourceViaProxy(url)
        const content = decodeExternalSourceContentFromBytes({
          contentType: proxied.contentType,
          contentBytes: proxied.contentBytes,
          finalUrl: proxied.finalUrl,
        })

        const sha256 = await computeSha256(content)
        if (expectedSha256 && sha256 !== expectedSha256) {
          throw new Error(`SHA256 mismatch. expected=${expectedSha256} actual=${sha256}`)
        }

        return { content, sourceUrl: url, sha256 }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: EXTERNAL_SOURCE_ACCEPT_HEADER,
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const finalUrl = assertTrustedResolvedSourceUrl(
        response.url || url,
        'Untrusted redirect host',
      )
      const contentType = (response.headers.get('content-type') || '').toLowerCase()
      const isZip = isZipContentType(contentType) || finalUrl.toLowerCase().endsWith('.zip')

      let content = ''
      if (isZip) {
        const archiveBytes = await readResponseBytesWithLimit(
          response,
          MAX_SKILL_ARCHIVE_BYTES,
          'Archive',
        )
        content = extractSkillArchivePayloadFromZipArchive(archiveBytes).content
      } else {
        if (contentType.includes('text/html')) {
          throw new Error('Received HTML content. Expected SKILL.md or JSON.')
        }

        const textBytes = await readResponseBytesWithLimit(response, MAX_SKILL_FILE_BYTES, 'File')
        content = decodeUtf8(textBytes)
      }

      const sha256 = await computeSha256(content)
      if (expectedSha256 && sha256 !== expectedSha256) {
        throw new Error(`SHA256 mismatch. expected=${expectedSha256} actual=${sha256}`)
      }

      return { content, sourceUrl: url, sha256 }
    } catch (error) {
      if (!preferProxy && isNetworkLikeFetchError(error)) {
        try {
          const proxied = await fetchExternalSourceViaProxy(url)
          const content = decodeExternalSourceContentFromBytes({
            contentType: proxied.contentType,
            contentBytes: proxied.contentBytes,
            finalUrl: proxied.finalUrl,
          })

          const sha256 = await computeSha256(content)
          if (expectedSha256 && sha256 !== expectedSha256) {
            throw new Error(`SHA256 mismatch. expected=${expectedSha256} actual=${sha256}`)
          }

          return { content, sourceUrl: url, sha256 }
        } catch (proxyError) {
          const reason = getHttpErrorMessage(proxyError)
          errors.push(`${url}: ${reason}`)
          continue
        }
      }

      const reason = getHttpErrorMessage(error)
      errors.push(`${url}: ${reason}`)
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error(`Failed to install from external source. ${errors.join(' | ')}`)
}
