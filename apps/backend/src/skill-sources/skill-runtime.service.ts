import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type {
  ExecuteHttpSkillRuntimeDto,
  HttpSkillRuntime,
  SkillRuntimeTemplateValue,
  SkillRuntimeValueBinding,
} from './skill-runtime.dto'

const DEFAULT_HTTP_TIMEOUT_MS = 15000
const MAX_HTTP_REDIRECTS = 5
const OMITTED_VALUE = Symbol('omitted-runtime-value')

type MaterializedRuntimeValue =
  | string
  | number
  | boolean
  | null
  | MaterializedRuntimeValue[]
  | { [key: string]: MaterializedRuntimeValue }
  | typeof OMITTED_VALUE

type ResolvedRuntimeValue = Exclude<MaterializedRuntimeValue, typeof OMITTED_VALUE>

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isRuntimeBinding(value: SkillRuntimeTemplateValue): value is SkillRuntimeValueBinding {
  return isRecord(value) && (value.$source === 'arg' || value.$source === 'secret')
}

function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)

  let current: unknown = source
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0) return undefined
      current = current[index]
      continue
    }

    if (!isRecord(current)) return undefined
    current = current[segment]
  }

  return current
}

function isMaterializedObject(
  value: MaterializedRuntimeValue,
): value is Record<string, ResolvedRuntimeValue> {
  return isRecord(value)
}

function isRedirectStatus(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status)
}

@Injectable()
export class SkillRuntimeService {
  private isPrivateOrLoopbackIpv4(ip: string): boolean {
    const parts = ip.split('.')
    if (parts.length !== 4 || !parts.every((part) => /^\d+$/.test(part))) return false

    const [a, b] = parts.map((part) => Number(part))
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }

  private isPrivateOrLoopbackIpv6(ip: string): boolean {
    const normalized = ip.toLowerCase()
    if (normalized === '::1') return true
    if (normalized.startsWith('fe80:')) return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
    return false
  }

  private isBlockedHostname(hostname: string): boolean {
    const normalized = hostname.toLowerCase()
    if (
      normalized === 'localhost' ||
      normalized.endsWith('.localhost') ||
      normalized.endsWith('.local')
    ) {
      return true
    }

    const ipType = isIP(normalized)
    if (ipType === 4) return this.isPrivateOrLoopbackIpv4(normalized)
    if (ipType === 6) return this.isPrivateOrLoopbackIpv6(normalized)
    return false
  }

  private isBlockedIpAddress(address: string): boolean {
    const ipType = isIP(address)
    if (ipType === 4) return this.isPrivateOrLoopbackIpv4(address)
    if (ipType === 6) return this.isPrivateOrLoopbackIpv6(address)
    return false
  }

  private async assertHttpEndpointSafe(url: string): Promise<void> {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException(`Unsupported skill runtime HTTP protocol: ${parsed.protocol}`)
    }

    const hostname = parsed.hostname.toLowerCase()
    if (this.isBlockedHostname(hostname)) {
      throw new BadRequestException(`Blocked skill runtime host: ${hostname}`)
    }

    const resolved = await lookup(hostname, { all: true, verbatim: true })
    if (resolved.length === 0) {
      throw new BadRequestException(`Unable to resolve skill runtime host: ${hostname}`)
    }

    if (resolved.some((record) => this.isBlockedIpAddress(record.address))) {
      throw new BadRequestException(`Blocked skill runtime host resolution: ${hostname}`)
    }
  }

  private resolveSecretValue(
    secretKey: string,
    providedSecrets: Record<string, string> | undefined,
  ): string | undefined {
    const providedValue = providedSecrets?.[secretKey]?.trim()
    if (providedValue) return providedValue
    return undefined
  }

  private resolveBindingValue(params: {
    binding: SkillRuntimeValueBinding
    runtime: HttpSkillRuntime
    argumentsMap: Record<string, unknown>
    providedSecrets?: Record<string, string>
    skillName: string
  }): MaterializedRuntimeValue {
    const { binding, runtime, argumentsMap, providedSecrets, skillName } = params

    let rawValue: unknown
    if (binding.$source === 'arg') {
      rawValue = getNestedValue(argumentsMap, binding.key)
    } else {
      rawValue = this.resolveSecretValue(binding.key, providedSecrets)
    }

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      if (binding.default !== undefined) {
        return this.materializeTemplateValue(binding.default, {
          runtime,
          argumentsMap,
          providedSecrets,
          skillName,
        })
      }

      const secretDefinition = runtime.secrets?.find((item) => item.key === binding.key)
      if (binding.required || secretDefinition?.required) {
        throw new BadRequestException(
          `Missing required runtime ${binding.$source} "${binding.key}" for skill "${skillName}"`,
        )
      }

      return OMITTED_VALUE
    }

    if (!binding.prefix && !binding.suffix) {
      return this.materializeResolvedValue(rawValue, {
        runtime,
        argumentsMap,
        providedSecrets,
        skillName,
      })
    }

    const materializedRaw = this.materializeResolvedValue(rawValue, {
      runtime,
      argumentsMap,
      providedSecrets,
      skillName,
    })

    if (materializedRaw === OMITTED_VALUE) return OMITTED_VALUE

    return `${binding.prefix || ''}${this.stringifyScalar(materializedRaw)}${binding.suffix || ''}`
  }

  private materializeResolvedValue(
    value: unknown,
    context: {
      runtime: HttpSkillRuntime
      argumentsMap: Record<string, unknown>
      providedSecrets?: Record<string, string>
      skillName: string
    },
  ): MaterializedRuntimeValue {
    if (value === null) return null
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value
    }

    if (Array.isArray(value)) {
      const items = value
        .map((item) => this.materializeResolvedValue(item, context))
        .filter((item) => item !== OMITTED_VALUE)

      return items
    }

    if (!isRecord(value)) return OMITTED_VALUE

    const objectEntries = Object.entries(value)
      .map(([key, entryValue]) => {
        const materialized = this.materializeResolvedValue(entryValue, context)
        return materialized === OMITTED_VALUE ? null : [key, materialized]
      })
      .filter((entry): entry is [string, ResolvedRuntimeValue] => !!entry)

    return Object.fromEntries(objectEntries)
  }

  private materializeTemplateValue(
    value: SkillRuntimeTemplateValue,
    context: {
      runtime: HttpSkillRuntime
      argumentsMap: Record<string, unknown>
      providedSecrets?: Record<string, string>
      skillName: string
    },
  ): MaterializedRuntimeValue {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return value
    }

    if (Array.isArray(value)) {
      const items = value
        .map((item) => this.materializeTemplateValue(item, context))
        .filter((item) => item !== OMITTED_VALUE)

      return items
    }

    if (isRuntimeBinding(value)) {
      return this.resolveBindingValue({
        binding: value,
        ...context,
      })
    }

    if (!isRecord(value)) return OMITTED_VALUE

    const objectEntries = Object.entries(value)
      .map(([key, entryValue]) => {
        const materialized = this.materializeTemplateValue(
          entryValue as SkillRuntimeTemplateValue,
          context,
        )
        return materialized === OMITTED_VALUE ? null : [key, materialized]
      })
      .filter((entry): entry is [string, ResolvedRuntimeValue] => !!entry)

    return Object.fromEntries(objectEntries)
  }

  private stringifyScalar(value: ResolvedRuntimeValue): string {
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (value === null) return 'null'
    return JSON.stringify(value)
  }

  private async fetchWithValidatedRedirects(params: {
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
      await this.assertHttpEndpointSafe(currentUrl.toString())

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

  async executeHttpRuntime(dto: ExecuteHttpSkillRuntimeDto): Promise<unknown> {
    const materializedHeaders = dto.runtime.request.headers
      ? this.materializeTemplateValue(dto.runtime.request.headers, {
          runtime: dto.runtime,
          argumentsMap: dto.arguments,
          providedSecrets: dto.secrets,
          skillName: dto.skillName,
        })
      : {}
    const materializedQuery = dto.runtime.request.query
      ? this.materializeTemplateValue(dto.runtime.request.query, {
          runtime: dto.runtime,
          argumentsMap: dto.arguments,
          providedSecrets: dto.secrets,
          skillName: dto.skillName,
        })
      : {}
    const materializedBody =
      dto.runtime.request.body !== undefined
        ? this.materializeTemplateValue(dto.runtime.request.body, {
            runtime: dto.runtime,
            argumentsMap: dto.arguments,
            providedSecrets: dto.secrets,
            skillName: dto.skillName,
          })
        : OMITTED_VALUE

    if (!isMaterializedObject(materializedHeaders)) {
      throw new BadRequestException('Skill runtime headers must resolve to an object')
    }
    if (!isMaterializedObject(materializedQuery)) {
      throw new BadRequestException('Skill runtime query must resolve to an object')
    }

    const targetUrl = new URL(dto.runtime.request.url)
    for (const [key, value] of Object.entries(materializedQuery)) {
      targetUrl.searchParams.set(key, this.stringifyScalar(value))
    }

    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(materializedHeaders)) {
      headers[key] = this.stringifyScalar(value)
    }

    const method = dto.runtime.request.method || 'POST'
    const responseType = dto.runtime.request.responseType || 'json'
    const requestBody =
      method === 'POST' && materializedBody !== OMITTED_VALUE
        ? typeof materializedBody === 'string'
          ? materializedBody
          : JSON.stringify(materializedBody)
        : undefined
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      dto.runtime.request.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS,
    )

    try {
      const response = await this.fetchWithValidatedRedirects({
        url: targetUrl,
        method,
        headers,
        ...(requestBody !== undefined ? { body: requestBody } : {}),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new BadGatewayException(
          `Skill runtime request failed: HTTP ${response.status} ${errorText.slice(0, 300)}`,
        )
      }

      if (responseType === 'text') {
        return response.text()
      }

      return response.json()
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error
      }

      const message = error instanceof Error ? error.message : String(error)
      throw new BadGatewayException(`Skill runtime request failed: ${message}`)
    } finally {
      clearTimeout(timeout)
    }
  }
}
