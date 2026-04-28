import { ref, watch, readonly, computed, shallowRef } from 'vue'
import { strFromU8, unzipSync } from 'fflate'
import i18n from '@/i18n'
import { httpClient } from '@/api'
import {
  generateId,
  parseSkillManifest,
  buildExternalSkillSourceCandidates,
  isTrustedSkillSourceUrl,
  migrateLegacySkillRuntime,
} from '@/features/ai/services/aiService'
import type { AISkill } from '@/features/ai/services/types'
import type { ApiResponse } from '@lumina/shared'

export type ThinkingMode = 'enabled' | 'disabled'
export type AssistantMode = 'default' | 'teaching'

export interface AIConfig {
  assistantMode: AssistantMode
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  systemPrompt: string
  thinkingMode: ThinkingMode
  thinkingEffort: 'low' | 'medium' | 'high' | 'max'
  todoAssistant: boolean
  discussionMode: boolean
  discussionModelIds: readonly string[]
  discussionPrimaryModelId: string | null
  memoryModelId: string | null
  enableImageGeneration: boolean
  mcpEnabled: boolean
  contextCompressionEnabled: boolean
  contextCompressionTriggerChars: number
  contextCompressionModelId: string | null
  skillIds: readonly string[]
}

export interface AIPreset {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt: string
  temperature: number
  thinkingEffort?: 'low' | 'medium' | 'high' | 'max'
  todoAssistant: boolean
  skillIds?: readonly string[]
}

const STORAGE_KEY = 'ai-config'
const PRESETS_STORAGE_KEY = 'ai-presets'
const ACTIVE_PRESET_KEY = 'ai-active-preset'
const AI_THINKING_MODE_STORAGE_KEY = 'ai_thinking_mode'
const SKILLS_STORAGE_KEY = 'ai-skills'

/**
 * AI 思考模式状态
 */
export const aiThinkingMode = ref<'enabled' | 'disabled'>(
  (localStorage.getItem(AI_THINKING_MODE_STORAGE_KEY) as 'enabled' | 'disabled') || 'enabled',
)

/**
 * 获取 AI 思考模式
 */
export function getAIThinkingMode(): 'enabled' | 'disabled' {
  return aiThinkingMode.value
}

/**
 * 保存 AI 思考模式
 */
export function saveAIThinkingMode(mode: 'enabled' | 'disabled'): void {
  aiThinkingMode.value = mode
}

function normalizeIdList(value: unknown): string[] {
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

function normalizeExpectedSha256(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  return /^[a-f0-9]{64}$/.test(normalized) ? normalized : null
}

const utf8Encoder = new TextEncoder()
const utf8Decoder = new TextDecoder()
const MAX_SKILL_FILE_BYTES = 512 * 1024
const MAX_SKILL_ARCHIVE_BYTES = 2 * 1024 * 1024
const EXTERNAL_SOURCE_ACCEPT_HEADER = 'application/json, text/markdown, text/plain, application/zip'
const EXTERNAL_PROXY_TIMEOUT_MS = 30000
const PROXY_FIRST_EXTERNAL_SOURCE_HOSTS = new Set([
  'lightmake.site',
  'skillhub-1388575217.cos.ap-guangzhou.myqcloud.com',
  'skillhub-1388575217.cos.accelerate.myqcloud.com',
  'skillhub.club',
  'www.skillhub.club',
  'clawhub.ai',
])

type ExternalSkillSourcePayload = {
  sourceUrl: string
  finalUrl: string
  contentType: string
  contentLength: number
  bodyBase64: string
}

type SkillArchivePayload = {
  content: string
}

function encodeUtf8(content: string): Uint8Array {
  return utf8Encoder.encode(content)
}

function createTooLargeError(label: 'File' | 'Archive', size: number): Error {
  return new Error(`${label} too large: ${size} bytes`)
}

function assertTrustedResolvedSourceUrl(url: string, errorLabel = 'Untrusted source host'): string {
  const normalized = url.trim()
  if (!normalized || !isTrustedSkillSourceUrl(normalized)) {
    throw new Error(`${errorLabel}: ${normalized || url}`)
  }
  return normalized
}

async function computeSha256(content: string): Promise<string> {
  const bytes = encodeUtf8(content)
  const digestInput = new Uint8Array(bytes).buffer
  const digest = await crypto.subtle.digest('SHA-256', digestInput)
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function isZipContentType(contentType: string): boolean {
  return (
    contentType.includes('application/zip') ||
    contentType.includes('application/x-zip-compressed') ||
    contentType.includes('application/x-zip')
  )
}

function isSkillMarkdownEntryPath(entryPath: string): boolean {
  const normalizedPath = entryPath.trim().toLowerCase()
  return normalizedPath === 'skill.md' || normalizedPath.endsWith('/skill.md')
}

function isSkillRuntimeEntryPath(entryPath: string): boolean {
  const normalizedPath = entryPath.trim().toLowerCase()
  return normalizedPath === 'skill.runtime.json' || normalizedPath.endsWith('/skill.runtime.json')
}

function extractSkillArchivePayloadFromZipArchive(archiveBytes: Uint8Array): SkillArchivePayload {
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

function decodeBase64ToBytes(base64: string): Uint8Array {
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

function toUint8ArrayChunk(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }
  if (typeof value === 'string') return encodeUtf8(value)

  throw new Error('Unsupported response chunk type.')
}

function mergeUint8ArrayChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const merged = new Uint8Array(totalBytes)
  let offset = 0

  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return merged
}

async function readResponseBytesWithLimit(
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

function isNetworkLikeFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('cors') ||
    message.includes('load failed')
  )
}

function getHttpErrorMessage(error: unknown): string {
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

function shouldPreferProxyForExternalSource(url: string): boolean {
  try {
    const parsed = new URL(url)
    return PROXY_FIRST_EXTERNAL_SOURCE_HOSTS.has(parsed.hostname)
  } catch {
    return false
  }
}

function decodeExternalSourceContentFromBytes(params: {
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

function normalizeSkillAliases(value: unknown): string[] {
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

function normalizeSkillResources(value: unknown): string[] {
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

function normalizeSkill(raw: unknown): AISkill | null {
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

function normalizeImportedSkill(raw: unknown): Omit<AISkill, 'id'> | null {
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

function createStoredSkill(skill: Omit<AISkill, 'id'>): AISkill {
  return {
    id: generateId(),
    ...skill,
  }
}

function normalizePreset(raw: unknown): AIPreset | null {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as Record<string, unknown>

  const id = typeof item.id === 'string' ? item.id.trim() : ''
  const name = typeof item.name === 'string' ? item.name.trim() : ''
  const baseUrl = typeof item.baseUrl === 'string' ? item.baseUrl : ''
  const apiKey = typeof item.apiKey === 'string' ? item.apiKey : ''
  const model = typeof item.model === 'string' ? item.model : ''
  const systemPrompt = typeof item.systemPrompt === 'string' ? item.systemPrompt : ''
  const temperature = typeof item.temperature === 'number' ? item.temperature : 0.6
  const thinkingEffort =
    item.thinkingEffort === 'low' ||
    item.thinkingEffort === 'medium' ||
    item.thinkingEffort === 'high' ||
    item.thinkingEffort === 'max'
      ? item.thinkingEffort
      : undefined
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
    ...(thinkingEffort ? { thinkingEffort } : {}),
    todoAssistant,
    skillIds: normalizeIdList(item.skillIds),
  }
}

// 默认配置
const DEFAULT_CONFIG: AIConfig = {
  assistantMode: 'default',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.6,
  systemPrompt: i18n.global.t('ai.defaultSystemPrompt'),
  thinkingMode: aiThinkingMode.value, // 使用初始值
  thinkingEffort: 'max',
  todoAssistant: false,
  discussionMode: false,
  discussionModelIds: [],
  discussionPrimaryModelId: null,
  memoryModelId: null,
  enableImageGeneration: false,
  mcpEnabled: false,
  contextCompressionEnabled: false,
  contextCompressionTriggerChars: 24000,
  contextCompressionModelId: null,
  skillIds: [],
}

// 全局配置状态（单例）
const config = ref<AIConfig>(loadConfig())
const presets = ref<AIPreset[]>(loadPresets())
const skills = shallowRef<AISkill[]>(loadSkills())
const activePresetId = ref<string | null>(loadActivePresetId())

// 监听思考模式变化并同步
watch(aiThinkingMode, (val) => {
  localStorage.setItem(AI_THINKING_MODE_STORAGE_KEY, val)
  if (config.value.thinkingMode !== val) {
    config.value.thinkingMode = val
  }
})

watch(
  () => config.value.thinkingMode,
  (val) => {
    if (aiThinkingMode.value !== val) {
      aiThinkingMode.value = val
    }
  },
)

/**
 * 从 localStorage 加载配置
 */
function loadConfig(): AIConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, unknown>
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        discussionModelIds: normalizeIdList(parsed.discussionModelIds),
        discussionPrimaryModelId:
          typeof parsed.discussionPrimaryModelId === 'string' &&
          parsed.discussionPrimaryModelId.trim().length > 0
            ? parsed.discussionPrimaryModelId
            : null,
        memoryModelId:
          typeof parsed.memoryModelId === 'string' && parsed.memoryModelId.trim().length > 0
            ? parsed.memoryModelId
            : null,
        contextCompressionModelId:
          typeof parsed.contextCompressionModelId === 'string' &&
          parsed.contextCompressionModelId.trim().length > 0
            ? parsed.contextCompressionModelId
            : null,
        skillIds: normalizeIdList(parsed.skillIds),
      }
    }
  } catch {
    console.warn('加载 AI 配置失败')
  }
  return { ...DEFAULT_CONFIG }
}

/**
 * 加载预设
 */
function loadPresets(): AIPreset[] {
  try {
    const saved = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as unknown
      if (!Array.isArray(parsed)) return []
      return parsed.map((item) => normalizePreset(item)).filter((item): item is AIPreset => !!item)
    }
  } catch {
    console.warn('加载预设失败')
  }

  // 默认预设
  return []
}

function loadSkills(): AISkill[] {
  try {
    const saved = localStorage.getItem(SKILLS_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as unknown
      if (!Array.isArray(parsed)) return []
      const normalizedSkills = parsed
        .map((item) => normalizeSkill(item))
        .filter((item): item is AISkill => !!item)

      const normalizedSerialized = JSON.stringify(normalizedSkills)
      if (normalizedSerialized !== saved) {
        localStorage.setItem(SKILLS_STORAGE_KEY, normalizedSerialized)
      }

      return normalizedSkills
    }
  } catch {
    console.warn('加载技能失败')
  }

  return []
}

/**
 * 加载当前激活的预设 ID
 */
function loadActivePresetId(): string | null {
  return localStorage.getItem(ACTIVE_PRESET_KEY)
}

/**
 * 保存配置到 localStorage
 */
function saveConfig(cfg: AIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    console.warn('保存 AI 配置失败')
  }
}

/**
 * 保存预设
 */
function savePresets(data: AIPreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(data))
  } catch {
    console.warn('保存预设失败')
  }
}

function saveSkills(data: AISkill[]): void {
  try {
    localStorage.setItem(SKILLS_STORAGE_KEY, JSON.stringify(data))
  } catch {
    console.warn('保存技能失败')
  }
}

/**
 * 保存当前激活的预设 ID
 */
function saveActivePresetId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_PRESET_KEY, id)
  } else {
    localStorage.removeItem(ACTIVE_PRESET_KEY)
  }
}

/**
 * 检查配置是否匹配预设
 */
function isConfigMatchPreset(cfg: AIConfig, preset: AIPreset): boolean {
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
    (preset.thinkingEffort || 'max') === cfg.thinkingEffort &&
    isSkillSetMatched
  )
}

/**
 * 查找匹配的预设 ID
 */
function findMatchingPreset(cfg: AIConfig, presetList: AIPreset[]): string | null {
  const match = presetList.find((p) => isConfigMatchPreset(cfg, p))
  return match ? match.id : null
}

// 监听配置变化自动保存
watch(config, (newConfig) => saveConfig(newConfig), { deep: true })
watch(presets, (newPresets) => savePresets(newPresets), { deep: true })
watch(
  () => JSON.stringify(skills.value),
  (serializedSkills) => {
    const nextSkills = JSON.parse(serializedSkills) as AISkill[]
    saveSkills(nextSkills)

    const skillIds = nextSkills.map((item) => item.id)
    const validIds = new Set(skillIds)
    const nextSkillIds = config.value.skillIds.filter((id) => validIds.has(id))
    if (nextSkillIds.length !== config.value.skillIds.length) {
      config.value = {
        ...config.value,
        skillIds: nextSkillIds,
      }
    }
  },
)
watch(activePresetId, (id) => saveActivePresetId(id))

// 监听配置或预设变化，自动同步激活状态
watch(
  [config, presets],
  ([newConfig, newPresets]) => {
    // 如果当前激活的预设仍然匹配，保持不变（解决相同配置预设无法切换的问题）
    if (activePresetId.value) {
      const currentPreset = (newPresets as AIPreset[]).find((p) => p.id === activePresetId.value)
      if (currentPreset && isConfigMatchPreset(newConfig as AIConfig, currentPreset)) {
        return
      }
    }

    const matchingId = findMatchingPreset(newConfig as AIConfig, newPresets as AIPreset[])
    if (activePresetId.value !== matchingId) {
      activePresetId.value = matchingId
    }
  },
  { deep: true },
)

/**
 * 导出重置函数用于测试
 */
export function _resetAIConfig() {
  aiThinkingMode.value =
    (localStorage.getItem(AI_THINKING_MODE_STORAGE_KEY) as 'enabled' | 'disabled') || 'enabled'
  config.value = loadConfig()
  presets.value = loadPresets()
  skills.value = loadSkills()
  activePresetId.value = loadActivePresetId()
}

/**
 * AI 配置管理 composable
 */
export function useAIConfig() {
  // 当前激活的预设
  const activePreset = computed(
    () => presets.value.find((p) => p.id === activePresetId.value) ?? null,
  )

  /**
   * 更新配置
   */
  function updateConfig(partial: Partial<AIConfig>): void {
    const merged: AIConfig = { ...config.value, ...partial }
    if ('skillIds' in partial) {
      merged.skillIds = normalizeIdList(partial.skillIds)
    }
    config.value = merged
  }

  /**
   * 重置为默认配置
   */
  function resetConfig(): void {
    config.value = { ...DEFAULT_CONFIG }
  }

  /**
   * 验证配置是否有效
   */
  function isConfigValid(): boolean {
    return !!(config.value.baseUrl && config.value.apiKey && config.value.model)
  }

  /**
   * 切换预设
   */
  function switchPreset(presetId: string): void {
    const preset = presets.value.find((p) => p.id === presetId)
    if (!preset) return
    const presetSkillIds = normalizeIdList(preset.skillIds).filter((id) =>
      skills.value.some((skill) => skill.id === id),
    )

    activePresetId.value = presetId
    config.value = {
      ...config.value,
      baseUrl: preset.baseUrl,
      apiKey: preset.apiKey,
      model: preset.model,
      systemPrompt: preset.systemPrompt,
      temperature: preset.temperature,
      thinkingEffort: preset.thinkingEffort || 'max',
      todoAssistant: preset.todoAssistant,
      skillIds: presetSkillIds,
    }
  }

  /**
   * 添加预设
   */
  function addPreset(preset: Omit<AIPreset, 'id'>): AIPreset {
    const newPreset: AIPreset = {
      ...preset,
      id: generateId(),
      skillIds: normalizeIdList(preset.skillIds),
    }
    presets.value.push(newPreset)
    return newPreset
  }

  /**
   * 更新预设
   */
  function updatePreset(presetId: string, updates: Partial<Omit<AIPreset, 'id'>>): void {
    const index = presets.value.findIndex((p) => p.id === presetId)
    if (index !== -1) {
      const updatedPreset = {
        ...presets.value[index],
        ...updates,
        skillIds: normalizeIdList(updates.skillIds ?? presets.value[index].skillIds),
      }
      // 使用 splice 确保触发 Vue 3 的响应式更新
      presets.value.splice(index, 1, updatedPreset)

      // 如果更新的是当前激活的预设，同步更新配置
      if (activePresetId.value === presetId) {
        const presetSkillIds = normalizeIdList(updatedPreset.skillIds).filter((id) =>
          skills.value.some((skill) => skill.id === id),
        )
        config.value = {
          ...config.value,
          baseUrl: updatedPreset.baseUrl,
          apiKey: updatedPreset.apiKey,
          model: updatedPreset.model,
          systemPrompt: updatedPreset.systemPrompt,
          temperature: updatedPreset.temperature,
          thinkingEffort: updatedPreset.thinkingEffort || 'max',
          todoAssistant: updatedPreset.todoAssistant,
          skillIds: presetSkillIds,
        }
      }
    }
  }

  /**
   * 将当前配置同步到指定预设（默认同步到当前激活预设）
   */
  function syncConfigToPreset(presetId: string | null = activePresetId.value): boolean {
    if (!presetId) return false

    const preset = presets.value.find((p) => p.id === presetId)
    if (!preset) return false

    updatePreset(presetId, {
      baseUrl: config.value.baseUrl,
      apiKey: config.value.apiKey,
      model: config.value.model,
      systemPrompt: config.value.systemPrompt,
      temperature: config.value.temperature,
      thinkingEffort: config.value.thinkingEffort,
      todoAssistant: config.value.todoAssistant,
      skillIds: config.value.skillIds,
    })

    activePresetId.value = presetId
    return true
  }

  /**
   * 删除预设
   */
  function deletePreset(presetId: string): void {
    const index = presets.value.findIndex((p) => p.id === presetId)
    if (index !== -1) {
      presets.value.splice(index, 1)
      if (activePresetId.value === presetId) {
        activePresetId.value = null
      }
    }
  }

  /**
   * 复制预设
   */
  function duplicatePreset(presetId: string): AIPreset | null {
    const preset = presets.value.find((p) => p.id === presetId)
    if (!preset) return null

    const newPreset: AIPreset = {
      ...preset,
      id: generateId(),
      name: `${preset.name}${i18n.global.t('ai.copySuffix')}`,
    }
    presets.value.push(newPreset)
    return newPreset
  }

  /**
   * 从当前配置创建预设默认值
   */
  function getPresetDefaults(): Omit<AIPreset, 'id' | 'name'> {
    return {
      baseUrl: config.value.baseUrl,
      apiKey: config.value.apiKey,
      model: config.value.model,
      systemPrompt: config.value.systemPrompt,
      temperature: config.value.temperature,
      thinkingEffort: config.value.thinkingEffort,
      todoAssistant: config.value.todoAssistant,
      skillIds: config.value.skillIds,
    }
  }

  /**
   * 导出所有预设为 JSON 字符串
   */
  function exportPresets(): string {
    return JSON.stringify(presets.value, null, 2)
  }

  /**
   * 导出所有技能为 JSON 字符串
   */
  function exportSkills(): string {
    return JSON.stringify(skills.value, null, 2)
  }

  /**
   * 导入预设
   * @param jsonStr JSON 字符串
   * @param mode 导入模式：'merge' 合并（默认），'replace' 替换
   */
  function importPresets(jsonStr: string, mode: 'merge' | 'replace' = 'merge'): void {
    try {
      const imported = JSON.parse(jsonStr) as unknown
      if (!Array.isArray(imported)) {
        throw new Error('Invalid presets format: expected an array')
      }

      const validPresets = (imported as unknown[])
        .map((item) => {
          const normalized = normalizePreset(item)
          if (normalized) return normalized

          if (!item || typeof item !== 'object') return null
          const raw = item as Record<string, unknown>
          const name = typeof raw.name === 'string' ? raw.name.trim() : ''
          const baseUrl = typeof raw.baseUrl === 'string' ? raw.baseUrl : ''
          const model = typeof raw.model === 'string' ? raw.model : ''
          if (!name || !baseUrl || !model) return null

          const systemPrompt = typeof raw.systemPrompt === 'string' ? raw.systemPrompt : ''
          const apiKey = typeof raw.apiKey === 'string' ? raw.apiKey : ''
          const temperature = typeof raw.temperature === 'number' ? raw.temperature : 0.6
          const thinkingEffort =
            raw.thinkingEffort === 'low' ||
            raw.thinkingEffort === 'medium' ||
            raw.thinkingEffort === 'high' ||
            raw.thinkingEffort === 'max'
              ? raw.thinkingEffort
              : undefined
          return {
            id: generateId(),
            name,
            baseUrl,
            apiKey,
            model,
            systemPrompt,
            temperature,
            ...(thinkingEffort ? { thinkingEffort } : {}),
            todoAssistant: !!raw.todoAssistant,
            skillIds: normalizeIdList(raw.skillIds),
          } satisfies AIPreset
        })
        .filter((item): item is AIPreset => !!item)

      if (validPresets.length === 0 && (imported as unknown[]).length > 0) {
        throw new Error('No valid presets found in the imported data')
      }

      // 为导入的预设生成新 ID，避免冲突
      const processedPresets = validPresets.map((p) => ({
        ...p,
        id: generateId(), // 总是生成新 ID 确保唯一性
        skillIds: normalizeIdList(p.skillIds),
      }))

      if (mode === 'replace') {
        presets.value = processedPresets
        activePresetId.value = null
      } else {
        presets.value = [...presets.value, ...processedPresets]
      }
    } catch (error) {
      console.error('导入预设失败:', error)
      throw error
    }
  }

  /**
   * 导入技能（支持 JSON 与单个 SKILL.md 文本）
   * @returns 实际导入数量
   */
  function importSkills(content: string, mode: 'merge' | 'replace' = 'merge'): number {
    const text = content.trim()
    if (!text) throw new Error('Invalid skills format: empty content')

    const parsedFromMarkdown = parseSkillManifest(text)

    let importedItems: Omit<AISkill, 'id'>[] = []
    try {
      const parsedJson = JSON.parse(text) as unknown
      if (Array.isArray(parsedJson)) {
        importedItems = parsedJson
          .map((item) => normalizeImportedSkill(item))
          .filter((item): item is Omit<AISkill, 'id'> => !!item)
      } else if (parsedJson && typeof parsedJson === 'object') {
        const container = parsedJson as Record<string, unknown>
        if (Array.isArray(container.skills)) {
          importedItems = container.skills
            .map((item) => normalizeImportedSkill(item))
            .filter((item): item is Omit<AISkill, 'id'> => !!item)
        } else {
          const single = normalizeImportedSkill(parsedJson)
          if (single) importedItems = [single]
        }
      }
    } catch {
      if (parsedFromMarkdown) {
        const aliases: string[] = []
        const runtime = migrateLegacySkillRuntime({
          name: parsedFromMarkdown.name,
          aliases,
        })
        importedItems = [
          {
            name: parsedFromMarkdown.name,
            description: parsedFromMarkdown.description,
            prompt: parsedFromMarkdown.prompt,
            ...(runtime ? { runtime } : {}),
          },
        ]
      } else {
        throw new Error('Invalid skills format: expected JSON array/object or SKILL.md')
      }
    }

    if (importedItems.length === 0) {
      throw new Error('No valid skills found in the imported data')
    }

    const dedupedByName: Omit<AISkill, 'id'>[] = []
    const incomingNameSet = new Set<string>()
    for (const item of importedItems) {
      const key = item.name.trim().toLowerCase()
      if (!key || incomingNameSet.has(key)) continue
      incomingNameSet.add(key)
      dedupedByName.push(item)
    }

    if (mode === 'replace') {
      skills.value = dedupedByName.map((item) => createStoredSkill(item))

      const validIds = new Set(skills.value.map((skill) => skill.id))
      config.value = {
        ...config.value,
        skillIds: config.value.skillIds.filter((id) => validIds.has(id)),
      }

      presets.value = presets.value.map((preset) => ({
        ...preset,
        skillIds: normalizeIdList(preset.skillIds).filter((id) => validIds.has(id)),
      }))

      return skills.value.length
    }

    const existingNameSet = new Set(skills.value.map((skill) => skill.name.trim().toLowerCase()))
    const toAppend = dedupedByName
      .filter((item) => {
        const key = item.name.trim().toLowerCase()
        if (!key || existingNameSet.has(key)) return false
        existingNameSet.add(key)
        return true
      })
      .map((item) => createStoredSkill(item))

    if (toAppend.length > 0) {
      skills.value = [...skills.value, ...toAppend]
    }

    return toAppend.length
  }

  async function importSkillsFromExternalSource(
    source: string,
    options:
      | {
          mode?: 'merge' | 'replace'
          expectedSha256?: string | null
        }
      | undefined = undefined,
  ): Promise<{ importedCount: number; sourceUrl: string; sha256: string }> {
    const mode = options?.mode || 'merge'
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

          const importedCount = importSkills(content, mode)
          return { importedCount, sourceUrl: url, sha256 }
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
          content = utf8Decoder.decode(textBytes)
        }

        const sha256 = await computeSha256(content)
        if (expectedSha256 && sha256 !== expectedSha256) {
          throw new Error(`SHA256 mismatch. expected=${expectedSha256} actual=${sha256}`)
        }

        const importedCount = importSkills(content, mode)
        return { importedCount, sourceUrl: url, sha256 }
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

            const importedCount = importSkills(content, mode)
            return { importedCount, sourceUrl: url, sha256 }
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

  function setSkillIds(ids: readonly string[]): void {
    const normalized = normalizeIdList(ids).filter((id) =>
      skills.value.some((skill) => skill.id === id),
    )
    config.value = {
      ...config.value,
      skillIds: normalized,
    }
  }

  function toggleSkill(skillId: string): void {
    const id = skillId.trim()
    if (!id) return

    const selected = new Set(config.value.skillIds)
    if (selected.has(id)) {
      selected.delete(id)
    } else {
      const exists = skills.value.some((skill) => skill.id === id)
      if (!exists) return
      selected.add(id)
    }

    setSkillIds(Array.from(selected))
  }

  function addSkill(skill: Omit<AISkill, 'id'>): AISkill {
    const normalizedAliases = normalizeSkillAliases(skill.aliases)
    const normalizedResources = normalizeSkillResources(skill.resources)
    const runtime = migrateLegacySkillRuntime({
      name: skill.name.trim(),
      aliases: normalizedAliases,
      runtime: skill.runtime,
    })
    const newSkill: AISkill = {
      id: generateId(),
      name: skill.name.trim(),
      prompt: skill.prompt.trim(),
      ...(skill.description?.trim() ? { description: skill.description.trim() } : {}),
      ...(normalizedAliases.length > 0 ? { aliases: normalizedAliases } : {}),
      ...(normalizedResources.length > 0 ? { resources: normalizedResources } : {}),
      ...(skill.path?.trim() ? { path: skill.path.trim() } : {}),
      ...(typeof skill.allowImplicitInvocation === 'boolean'
        ? { allowImplicitInvocation: skill.allowImplicitInvocation }
        : {}),
      ...(runtime ? { runtime } : {}),
    }

    skills.value = [...skills.value, newSkill]
    return newSkill
  }

  function updateSkill(skillId: string, updates: Partial<Omit<AISkill, 'id'>>): void {
    const index = skills.value.findIndex((s) => s.id === skillId)
    if (index === -1) return

    const current = skills.value[index]
    const updatedSkill: AISkill = {
      ...current,
      ...updates,
      name: typeof updates.name === 'string' ? updates.name.trim() : current.name,
      prompt: typeof updates.prompt === 'string' ? updates.prompt.trim() : current.prompt,
      description:
        typeof updates.description === 'string'
          ? updates.description.trim() || undefined
          : current.description,
      aliases: updates.aliases ? normalizeSkillAliases(updates.aliases) : current.aliases,
      resources: updates.resources ? normalizeSkillResources(updates.resources) : current.resources,
      path: typeof updates.path === 'string' ? updates.path.trim() || undefined : current.path,
      runtime:
        updates.runtime !== undefined || updates.name !== undefined || updates.aliases !== undefined
          ? migrateLegacySkillRuntime({
              name: typeof updates.name === 'string' ? updates.name.trim() : current.name,
              aliases: updates.aliases ? normalizeSkillAliases(updates.aliases) : current.aliases,
              runtime: updates.runtime !== undefined ? updates.runtime : current.runtime,
            })
          : current.runtime,
      allowImplicitInvocation:
        typeof updates.allowImplicitInvocation === 'boolean'
          ? updates.allowImplicitInvocation
          : current.allowImplicitInvocation,
    }

    const nextSkills = [...skills.value]
    nextSkills.splice(index, 1, updatedSkill)
    skills.value = nextSkills
  }

  function deleteSkill(skillId: string): void {
    const index = skills.value.findIndex((s) => s.id === skillId)
    if (index === -1) return

    skills.value = skills.value.filter((skill) => skill.id !== skillId)
    if (config.value.skillIds.includes(skillId)) {
      setSkillIds(config.value.skillIds.filter((id) => id !== skillId))
    }

    const nextPresets = presets.value.map((preset) => {
      const nextSkillIds = normalizeIdList(preset.skillIds).filter((id) => id !== skillId)
      return {
        ...preset,
        skillIds: nextSkillIds,
      }
    })
    presets.value = nextPresets
  }

  function duplicateSkill(skillId: string): AISkill | null {
    const skill = skills.value.find((s) => s.id === skillId)
    if (!skill) return null

    const newSkill: AISkill = {
      ...skill,
      id: generateId(),
      name: `${skill.name}${i18n.global.t('ai.copySuffix')}`,
    }
    skills.value = [...skills.value, newSkill]
    return newSkill
  }

  return {
    config: readonly(config),
    updateConfig,
    resetConfig,
    isConfigValid,
    DEFAULT_CONFIG,
    // 预设相关
    presets,
    activePreset,
    activePresetId: readonly(activePresetId),
    switchPreset,
    addPreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
    syncConfigToPreset,
    getPresetDefaults,
    exportPresets,
    importPresets,
    exportSkills,
    importSkills,
    importSkillsFromExternalSource,
    skills,
    addSkill,
    updateSkill,
    deleteSkill,
    duplicateSkill,
    toggleSkill,
    setSkillIds,
  }
}

/**
 * 获取当前配置（供 aiService 使用）
 */
export function getAIConfig(): AIConfig {
  return config.value
}

/**
 * 获取当前所有预设（供 aiService 使用）
 */
export function getAIPresets(): AIPreset[] {
  return presets.value
}

export function getAISkills(): AISkill[] {
  return skills.value
}
