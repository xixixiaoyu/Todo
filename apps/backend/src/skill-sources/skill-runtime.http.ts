import { BadGatewayException, BadRequestException } from '@nestjs/common'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const MAX_HTTP_REDIRECTS = 5

function isPrivateOrLoopbackIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4 || !parts.every((part) => /^\d+$/.test(part))) return false

  const [a, b] = parts.map((part) => Number(part))
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function isPrivateOrLoopbackIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('fe80:')) return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  return false
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local')
  ) {
    return true
  }

  const ipType = isIP(normalized)
  if (ipType === 4) return isPrivateOrLoopbackIpv4(normalized)
  if (ipType === 6) return isPrivateOrLoopbackIpv6(normalized)
  return false
}

function isBlockedIpAddress(address: string): boolean {
  const ipType = isIP(address)
  if (ipType === 4) return isPrivateOrLoopbackIpv4(address)
  if (ipType === 6) return isPrivateOrLoopbackIpv6(address)
  return false
}

export async function assertHttpEndpointSafe(url: string): Promise<void> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new BadRequestException(`Unsupported skill runtime HTTP protocol: ${parsed.protocol}`)
  }

  const hostname = parsed.hostname.toLowerCase()
  if (isBlockedHostname(hostname)) {
    throw new BadRequestException(`Blocked skill runtime host: ${hostname}`)
  }

  const resolved = await lookup(hostname, { all: true, verbatim: true })
  if (resolved.length === 0) {
    throw new BadRequestException(`Unable to resolve skill runtime host: ${hostname}`)
  }

  if (resolved.some((record) => isBlockedIpAddress(record.address))) {
    throw new BadRequestException(`Blocked skill runtime host resolution: ${hostname}`)
  }
}

function isRedirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status)
}

export async function fetchWithValidatedRedirects(params: {
  url: URL
  method: 'GET' | 'POST'
  headers: Record<string, string>
  body?: string
  signal: AbortSignal
}): Promise<Response> {
  let currentUrl = new URL(params.url.toString())
  let method = params.method
  let body = params.body

  for (let redirectCount = 0; redirectCount <= MAX_HTTP_REDIRECTS; redirectCount++) {
    await assertHttpEndpointSafe(currentUrl.toString())

    const response = await fetch(currentUrl.toString(), {
      method,
      headers: params.headers,
      ...(body !== undefined ? { body } : {}),
      redirect: 'manual',
      signal: params.signal,
    })

    if (!isRedirectStatus(response.status)) {
      return response
    }

    if (redirectCount === MAX_HTTP_REDIRECTS) {
      throw new BadGatewayException('Skill runtime request failed: too many redirects')
    }

    const location = response.headers.get('location')
    if (!location) {
      throw new BadGatewayException('Skill runtime request failed: redirect location is missing')
    }

    currentUrl = new URL(location, currentUrl)

    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) && method === 'POST')
    ) {
      method = 'GET'
      body = undefined
    }
  }

  throw new BadGatewayException('Skill runtime request failed: too many redirects')
}
