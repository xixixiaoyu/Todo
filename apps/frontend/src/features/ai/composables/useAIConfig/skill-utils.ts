import { strFromU8, unzipSync } from 'fflate'
import {
  generateId,
  parseSkillManifest,
  migrateLegacySkillRuntime,
  isTrustedSkillSourceUrl,
} from '@/features/ai/services/aiService'
import type { AISkill } from '@/features/ai/services/types'
import type { AIConfig, AIPreset, SkillArchivePayload } from './types'
import { MAX_SKILL_FILE_BYTES, MAX_SKILL_ARCHIVE_BYTES } from './types'

// ─── Encoding Utilities ────────────────────────────────────────────

const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder()

export function encodeUtf8(content: string): Uint8Array {
  return utf8Encoder.encode(content)
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
  const value = base64.trim()
  if (!value) return new Uint8Array()

  if (typeof atob === 'function') {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }

  throw new Error('Base64 decoder is not available in current runtime.')
}

export function toUint8ArrayChunk(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (typeof value === 'string') return encodeUtf8(value)

  throw new Error('Unsupported response chunk type.')
}

export function mergeUint8ArrayChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const merged = new Uint8Array(totalBytes)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return merged
}

export function decodeUtf8(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes)
}

// ─── Crypto ────────────────────────────────────────────────────────

export async function computeSha256(content: string): Promise<string> {
  const bytes = encodeUtf8(content)
  const digestInput = new Uint8Array(bytes).buffer
  const digest = await crypto.subtle.digest('SHA-256', digestInput)
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Error Helpers ──────────────────────────────────────────────────

export function createTooLargeError(label: 'File' | 'Archive', size: number): Error {
  return new Error(`${label} too large: ${size} bytes`)
}

// ─── Content Type Detection ────────────────────────────────────────

export function isZipContentType(contentType: string): boolean {
  return (
    contentType.includes('application/zip') ||
    contentType.includes('application/x-zip-compressed') ||
    contentType.includes('application/x-zip')
  )
}

export function isSkillMarkdownEntryPath(entryPath: string): boolean {
  const normalizedPath = entryPath.trim().toLowerCase()
  return normalizedPath === 'skill.md' || normalizedPath.endsWith('/skill.md')
}

export function isSkillRuntimeEntryPath(entryPath: string): boolean {
  const normalizedPath = entryPath.trim().toLowerCase()
  return normalizedPath === 'skill.runtime.json' || normalizedPath.endsWith('/skill.runtime.json')
}

// ─── ZIP Archive Handling ──────────────────────────────────────────

export function extractSkillArchivePayloadFromZipArchive(
  archiveBytes: Uint8Array,
): SkillArchivePayload {
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(archiveBytes, {
      filter(file) {
        if (!isSkillMarkdownEntryPath(file.name) && !isSkillRuntimeEntryPath(file.name))
          return false
        if (file.originalSize > MAX_SKILL_FILE_BYTES) {
          throw createTooLargeError('File', file.originalSize)
        }
        return true
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('File too large:')) {
      throw error
    }
    throw new Error('Invalid ZIP archive. Expected a skill package zip file.')
  }

  const skillEntry = Object.entries(entries).find(([entryPath]) => {
    return isSkillMarkdownEntryPath(entryPath)
  })

  if (!skillEntry) {
    throw new Error('SKILL.md not found in ZIP archive.')
  }

  const skillBytes = skillEntry[1]
  if (skillBytes.byteLength > MAX_SKILL_FILE_BYTES) {
    throw new Error(`File too large: ${skillBytes.byteLength} bytes`)
  }

  const skillMarkdown = strFromU8(skillBytes)
  const runtimeEntry = Object.entries(entries).find(([entryPath]) =>
    isSkillRuntimeEntryPath(entryPath),
  )

  if (!runtimeEntry) {
    return {
      content: skillMarkdown,
    }
  }

  const runtimeBytes = runtimeEntry[1]
  if (runtimeBytes.byteLength > MAX_SKILL_FILE_BYTES) {
    throw new Error(`File too large: ${runtimeBytes.byteLength} bytes`)
  }

  let parsedRuntime: unknown
  try {
    parsedRuntime = JSON.parse(strFromU8(runtimeBytes))
  } catch {
    throw new Error('Invalid skill.runtime.json. Expected valid JSON.')
  }

  return {
    content: JSON.stringify({
      skill_md: skillMarkdown,
      runtime: parsedRuntime,
    }),
  }
}

// ─── Stream Reading with Limit ─────────────────────────────────────

export async function readResponseBytesWithLimit(
  response: Response,
  maxBytes: number,
  label: 'File' | 'Archive',
): Promise<Uint8Array> {
  const contentLength = Number(response.headers.get('content-length') || '')
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw createTooLargeError(label, contentLength)
  }

  if (!response.body) {
    const fallbackBytes =
      typeof response.arrayBuffer === 'function'
        ? new Uint8Array(await response.arrayBuffer())
        : encodeUtf8(await response.text())

    if (fallbackBytes.byteLength > maxBytes) {
      throw createTooLargeError(label, fallbackBytes.byteLength)
    }

    return fallbackBytes
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = toUint8ArrayChunk(value)
      totalBytes += chunk.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw createTooLargeError(label, totalBytes)
      }

      chunks.push(chunk)
    }
  } finally {
    reader.releaseLock()
  }

  return mergeUint8ArrayChunks(chunks, totalBytes)
}

// ─── Content Decoding ──────────────────────────────────────────────

export function decodeExternalSourceContentFromBytes(params: {
  contentType: string
  contentBytes: Uint8Array
  finalUrl: string
}): string {
  const contentType = params.contentType.toLowerCase()
  const isZip = isZipContentType(contentType) || params.finalUrl.toLowerCase().endsWith('.zip')

  if (isZip) {
    if (params.contentBytes.byteLength > MAX_SKILL_ARCHIVE_BYTES) {
      throw new Error(`Archive too large: ${params.contentBytes.byteLength} bytes`)
    }

    return extractSkillArchivePayloadFromZipArchive(params.contentBytes).content
  }

  if (contentType.includes('text/html')) {
    throw new Error('Received HTML content. Expected SKILL.md or JSON.')
  }

  if (params.contentBytes.byteLength > MAX_SKILL_FILE_BYTES) {
    throw new Error(`File too large: ${params.contentBytes.byteLength} bytes`)
  }

  const content = utf8Decoder.decode(params.contentBytes)
  const contentByteLength = encodeUtf8(content).byteLength
  if (contentByteLength > MAX_SKILL_FILE_BYTES) {
    throw new Error(`File too large: ${contentByteLength} bytes`)
  }

  return content
}

// ─── URL Trust Validation ──────────────────────────────────────────

export function assertTrustedResolvedSourceUrl(
  url: string,
  errorLabel = 'Untrusted source host',
): string {
  const normalized = url.trim()
  if (!normalized || !isTrustedSkillSourceUrl(normalized)) {
    throw new Error(`${errorLabel}: ${normalized || url}`)
  }
  return normalized
}

// ─── ID & List Normalization ───────────────────────────────────────

export function normalizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const result: string[] = []
  const seen = new Set<string>()

  for (const item of value) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }

  return result
}

export function normalizeExpectedSha256(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null
}

// ─── Skill Normalization ───────────────────────────────────────────

export function normalizeSkillAliases(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const aliases: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const alias = item.trim()
    if (!alias) continue
    const normalized = alias.toLowerCase()
    if (seen.has(normalized)) continue
    seen.add(normalized)
    aliases.push(alias)
  }
  return aliases
}

export function normalizeSkillResources(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const resources: string[] = []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const resource = item.trim()
    if (!resource || seen.has(resource)) continue
    seen.add(resource)
    resources.push(resource)
  }

  return resources
}

export function normalizeSkill(raw: unknown): AISkill | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>

  const id = typeof item.id === 'string' ? item.id.trim() : ''
  const name = typeof item.name === 'string' ? item.name.trim() : ''
  const prompt = typeof item.prompt === 'string' ? item.prompt.trim() : ''
  if (!id || !name || !prompt) return null

  const description =
    typeof item.description === 'string' && item.description.trim().length > 0
      ? item.description.trim()
      : undefined

  const aliases = normalizeSkillAliases(item.aliases)
  const resources = normalizeSkillResources(item.resources)
  const path = typeof item.path === 'string' && item.path.trim().length > 0 ? item.path.trim() : ''
  const allowImplicitInvocation =
    typeof item.allowImplicitInvocation === 'boolean' ? item.allowImplicitInvocation : undefined
  const runtime = migrateLegacySkillRuntime({
    name,
    aliases,
    runtime: item.runtime,
  })

  return {
    id,
    name,
    prompt,
    ...(description ? { description } : {}),
    ...(aliases.length > 0 ? { aliases } : {}),
    ...(resources.length > 0 ? { resources } : {}),
    ...(path ? { path } : {}),
    ...(typeof allowImplicitInvocation === 'boolean' ? { allowImplicitInvocation } : {}),
    ...(runtime ? { runtime } : {}),
  }
}

export function normalizeImportedSkill(raw: unknown): Omit<AISkill, 'id'> | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>

  const skillMarkdown =
    typeof item.skill_md === 'string'
      ? item.skill_md
      : typeof item.skillMd === 'string'
        ? item.skillMd
        : typeof item.SKILL_MD === 'string'
          ? item.SKILL_MD
          : ''

  const parsedManifest = skillMarkdown ? parseSkillManifest(skillMarkdown) : null

  const name =
    typeof item.name === 'string' && item.name.trim().length > 0
      ? item.name.trim()
      : parsedManifest?.name || ''

  const description =
    typeof item.description === 'string' && item.description.trim().length > 0
      ? item.description.trim()
      : parsedManifest?.description || ''

  const prompt =
    typeof item.prompt === 'string' && item.prompt.trim().length > 0
      ? item.prompt.trim()
      : typeof item.instruction === 'string' && item.instruction.trim().length > 0
        ? item.instruction.trim()
        : parsedManifest?.prompt || ''

  if (!name || !description || !prompt) return null

  const aliases = normalizeSkillAliases(item.aliases)
  const resources = normalizeSkillResources(item.resources)
  const path =
    typeof item.path === 'string' && item.path.trim().length > 0 ? item.path.trim() : undefined
  const allowImplicitInvocation =
    typeof item.allowImplicitInvocation === 'boolean' ? item.allowImplicitInvocation : undefined
  const runtime = migrateLegacySkillRuntime({
    name,
    aliases,
    runtime: item.runtime,
  })

  return {
    name,
    description,
    prompt,
    ...(aliases.length > 0 ? { aliases } : {}),
    ...(resources.length > 0 ? { resources } : {}),
    ...(path ? { path } : {}),
    ...(typeof allowImplicitInvocation === 'boolean' ? { allowImplicitInvocation } : {}),
    ...(runtime ? { runtime } : {}),
  }
}

export function createStoredSkill(skill: Omit<AISkill, 'id'>): AISkill {
  return {
    ...skill,
    source: skill.source || 'imported',
    id: generateId(),
    updatedAt: skill.updatedAt ?? new Date().toISOString(),
  }
}

// ─── Preset Normalization ──────────────────────────────────────────

export function normalizePreset(raw: unknown): AIPreset | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>

  const id = typeof item.id === 'string' ? item.id.trim() : ''
  const name = typeof item.name === 'string' ? item.name.trim() : ''
  const baseUrl = typeof item.baseUrl === 'string' ? item.baseUrl : ''
  const apiKey = typeof item.apiKey === 'string' ? item.apiKey : ''
  const model = typeof item.model === 'string' ? item.model : ''
  const systemPrompt = typeof item.systemPrompt === 'string' ? item.systemPrompt : ''
  const temperature = typeof item.temperature === 'number' ? item.temperature : 0.6
  const todoAssistant = !!item.todoAssistant

  if (!id || !name || !baseUrl || !model) return null

  return {
    id,
    name,
    baseUrl,
    apiKey,
    model,
    systemPrompt,
    temperature,
    todoAssistant,
    skillIds: normalizeIdList(item.skillIds),
    ...(typeof item.updatedAt === 'string' ? { updatedAt: item.updatedAt } : {}),
  }
}

// ─── Config/Preset Matching ────────────────────────────────────────

export function isConfigMatchPreset(cfg: AIConfig, preset: AIPreset): boolean {
  const presetSkillIds = normalizeIdList(preset.skillIds).slice().sort()
  const configSkillIds = normalizeIdList(cfg.skillIds).slice().sort()
  const isSkillSetMatched =
    presetSkillIds.length === configSkillIds.length &&
    presetSkillIds.every((id, index) => id === configSkillIds[index])

  return (
    preset.baseUrl === cfg.baseUrl &&
    preset.apiKey === cfg.apiKey &&
    preset.model === cfg.model &&
    preset.systemPrompt === cfg.systemPrompt &&
    Math.abs(preset.temperature - cfg.temperature) < 0.001 &&
    isSkillSetMatched
  )
}

export function findMatchingPreset(cfg: AIConfig, presetList: AIPreset[]): string | null {
  const match = presetList.find((p) => isConfigMatchPreset(cfg, p))
  return match ? match.id : null
}
