export type ThinkingMode = 'enabled' | 'disabled'
export type AssistantMode = 'default' | 'teaching' | 'novel' | 'translation'
export type ReasoningEffort = 'high' | 'max'

export type NovelGenre =
  | 'fantasy'
  | 'sci_fi'
  | 'romance'
  | 'thriller'
  | 'wuxia'
  | 'literary'
  | 'horror'
  | 'cyberpunk'

export interface AIConfig {
  assistantMode: AssistantMode
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  systemPrompt: string
  thinkingMode: ThinkingMode
  thinkingEffort: ReasoningEffort
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
  novelGenre: NovelGenre | null
  novelTone: string
  novelProtagonistHint: string
}

export interface AIPreset {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt: string
  temperature: number
  thinkingEffort?: ReasoningEffort
  todoAssistant: boolean
  skillIds?: readonly string[]
  novelGenre?: NovelGenre | null
  novelTone?: string
  novelProtagonistHint?: string
  updatedAt?: string
}

export type ExternalSkillSourcePayload = {
  sourceUrl: string
  finalUrl: string
  contentType: string
  contentLength: number
  bodyBase64: string
}

export type SkillArchivePayload = {
  content: string
}

// Storage keys
export const STORAGE_KEY = 'ai-config'
export const PRESETS_STORAGE_KEY = 'ai-presets'
export const ACTIVE_PRESET_KEY = 'ai-active-preset'
export const AI_THINKING_MODE_STORAGE_KEY = 'ai_thinking_mode'
export const SKILLS_STORAGE_KEY = 'ai-skills'

// Size limits
export const MAX_SKILL_FILE_BYTES = 512 * 1024
export const MAX_SKILL_ARCHIVE_BYTES = 2 * 1024 * 1024

// External source
export const EXTERNAL_SOURCE_ACCEPT_HEADER =
  'application/json, text/markdown, text/plain, application/zip'
export const EXTERNAL_PROXY_TIMEOUT_MS = 30000

export const PROXY_FIRST_EXTERNAL_SOURCE_HOSTS = new Set([
  'lightmake.site',
  'skillhub-1388575217.cos.ap-guangzhou.myqcloud.com',
  'skillhub-1388575217.cos.accelerate.myqcloud.com',
  'skillhub.club',
  'www.skillhub.club',
  'clawhub.ai',
])
