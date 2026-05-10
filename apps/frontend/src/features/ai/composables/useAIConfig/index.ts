import { ref, watch, readonly, computed, shallowRef } from 'vue'
import i18n from '@/i18n'
import {
  generateId,
  parseSkillManifest,
  migrateLegacySkillRuntime,
} from '@/features/ai/services/aiService'
import type { AISkill } from '@/features/ai/services/types'
import type { AIConfig, AIPreset, AssistantMode, ThinkingMode } from './types'
import { STORAGE_KEY } from './types'
import {
  normalizeIdList,
  normalizeSkillAliases,
  normalizeSkillResources,
  normalizePreset,
  normalizeImportedSkill,
  createStoredSkill,
  isConfigMatchPreset,
  findMatchingPreset,
} from './skill-utils'
import { fetchSkillContentFromExternalSource } from './external-source'
import {
  saveConfig,
  savePresets,
  saveSkills,
  saveActivePresetId,
  loadPresets,
  loadSkills,
  loadActivePresetId,
} from './storage'
import {
  fetchSkills as fetchSkillsFromServer,
  pushSkills as pushSkillsToServer,
  fetchPresets as fetchPresetsFromServer,
  pushPresets as pushPresetsToServer,
} from '@/features/ai/services/aiSyncService'
import type { AISkillSync, AIPresetSync } from '@lumina/shared'

// ─── Thinking Mode ─────────────────────────────────────────────────

/**
 * AI 思考级别状态（从 AI config 中派生，保持独立 ref 便于工具栏绑定）
 */
export const aiThinkingLevel = ref<ThinkingMode>('auto')

/**
 * 获取 AI 思考级别
 */
export function getAIThinkingLevel(): ThinkingMode {
  return aiThinkingLevel.value
}

/**
 * 保存 AI 思考级别
 */
export function saveAIThinkingLevel(level: ThinkingMode): void {
  aiThinkingLevel.value = level
}

// ─── Default Config ────────────────────────────────────────────────

const DEFAULT_CONFIG: AIConfig = {
  assistantMode: 'default',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  temperature: 0.6,
  systemPrompt: i18n.global.t('ai.defaultSystemPrompt'),
  thinkingMode: 'auto' as ThinkingMode,
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
  novelGenre: null,
  novelTone: '',
  novelProtagonistHint: '',
  agentMode: false,
  agentWorkspaceId: null,
  agentWorkspacePath: null,
}

const VALID_THINKING_LEVELS: Set<ThinkingMode> = new Set(['off', 'auto', 'high', 'xhigh'])

function normalizeThinkingLevel(value: unknown): ThinkingMode {
  const s = typeof value === 'string' ? value.toLowerCase() : ''
  return VALID_THINKING_LEVELS.has(s as ThinkingMode) ? (s as ThinkingMode) : 'auto'
}

// ─── Load Config ───────────────────────────────────────────────────

function loadConfig(): AIConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, unknown>
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        thinkingMode: normalizeThinkingLevel(parsed.thinkingMode ?? parsed.thinking_mode ?? 'auto'),
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

// ─── Global Reactive State ─────────────────────────────────────────

const config = ref<AIConfig>(loadConfig())
const presets = ref<AIPreset[]>(loadPresets())
const skills = shallowRef<AISkill[]>(loadSkills())
const activePresetId = ref<string | null>(loadActivePresetId())

// 从已加载的配置中同步思考级别
aiThinkingLevel.value = config.value.thinkingMode

// ─── Watchers ──────────────────────────────────────────────────────

// 监听思考级别变化并同步 thinkingMode 到配置
watch(aiThinkingLevel, (val) => {
  if (config.value.thinkingMode !== val) {
    config.value.thinkingMode = val
  }
})

watch(
  () => config.value.thinkingMode,
  (val) => {
    if (aiThinkingLevel.value !== val) {
      aiThinkingLevel.value = val
    }
  },
)

// 监听配置变化自动保存
watch(config, (newConfig) => saveConfig(newConfig), { deep: true })
watch(
  presets,
  (newPresets) => {
    savePresets(newPresets)
    void pushPresetsToServer(newPresets)
  },
  { deep: true },
)
watch(
  () => JSON.stringify(skills.value),
  (serializedSkills) => {
    const nextSkills = JSON.parse(serializedSkills) as AISkill[]
    saveSkills(nextSkills)
    void pushSkillsToServer(nextSkills)

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
    // 如果当前激活的预设仍然匹配，保持不变
    if (activePresetId.value) {
      const currentPreset = newPresets.find((p) => p.id === activePresetId.value)
      if (currentPreset && isConfigMatchPreset(newConfig, currentPreset)) {
        return
      }
    }

    const matchingId = findMatchingPreset(newConfig, newPresets)
    if (activePresetId.value !== matchingId) {
      activePresetId.value = matchingId
    }
  },
  { deep: true },
)

// ─── Reset ─────────────────────────────────────────────────────────

/**
 * 导出重置函数用于测试
 */
export function _resetAIConfig() {
  config.value = loadConfig()
  aiThinkingLevel.value = config.value.thinkingMode
  presets.value = loadPresets()
  skills.value = loadSkills()
  activePresetId.value = loadActivePresetId()
}

// ─── Composable ────────────────────────────────────────────────────

/**
 * AI 配置管理 composable
 */
export function useAIConfig() {
  // 当前激活的预设
  const activePreset = computed(
    () => presets.value.find((p) => p.id === activePresetId.value) ?? null,
  )

  /**
   * 强制切换 AI 助手到指定模式，同时关闭其他互斥模式标志。
   * 比 toggle 更安全——不会因重复点击而意外关闭已激活的模式。
   */
  function switchToMode(mode: AssistantMode): void {
    config.value = {
      ...config.value,
      assistantMode: mode,
      todoAssistant: false,
      discussionMode: false,
      enableImageGeneration: false,
    }
  }

  /**
   * 更新配置
   */
  function updateConfig(partial: Partial<AIConfig>): void {
    // Normalize skillIds before applying
    const normalized = { ...partial }
    if ('skillIds' in partial) {
      normalized.skillIds = normalizeIdList(partial.skillIds)
    }
    // Direct property mutation — avoids full-object replacement and
    // keeps toggle feedback instant by touching only changed keys.
    Object.assign(config.value, normalized)
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
      todoAssistant: preset.todoAssistant,
      skillIds: presetSkillIds,
      novelGenre: preset.novelGenre ?? null,
      novelTone: preset.novelTone ?? '',
      novelProtagonistHint: preset.novelProtagonistHint ?? '',
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
      novelGenre: preset.novelGenre ?? null,
      novelTone: preset.novelTone ?? '',
      novelProtagonistHint: preset.novelProtagonistHint ?? '',
      updatedAt: preset.updatedAt ?? new Date().toISOString(),
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
          todoAssistant: updatedPreset.todoAssistant,
          skillIds: presetSkillIds,
          novelGenre: updatedPreset.novelGenre ?? null,
          novelTone: updatedPreset.novelTone ?? '',
          novelProtagonistHint: updatedPreset.novelProtagonistHint ?? '',
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
      todoAssistant: config.value.todoAssistant,
      skillIds: config.value.skillIds,
      novelGenre: config.value.novelGenre,
      novelTone: config.value.novelTone,
      novelProtagonistHint: config.value.novelProtagonistHint,
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
      updatedAt: new Date().toISOString(),
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
      todoAssistant: config.value.todoAssistant,
      skillIds: config.value.skillIds,
      novelGenre: config.value.novelGenre,
      novelTone: config.value.novelTone,
      novelProtagonistHint: config.value.novelProtagonistHint,
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
          return {
            id: generateId(),
            name,
            baseUrl,
            apiKey,
            model,
            systemPrompt,
            temperature,
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
        id: generateId(),
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

    const { content, sourceUrl, sha256 } = await fetchSkillContentFromExternalSource(source, {
      expectedSha256: options?.expectedSha256,
    })

    const importedCount = importSkills(content, mode)
    return { importedCount, sourceUrl, sha256 }
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

  /**
   * 添加工作区发现的技能（去重：同 source + name 不重复）
   */
  function addDiscoveredWorkspaceSkills(newSkills: AISkill[]): void {
    const existingNames = new Set(skills.value.map((s) => s.name))
    const toAdd = newSkills.filter((s) => s.source === 'workspace' && !existingNames.has(s.name))
    if (toAdd.length > 0) {
      skills.value = [...skills.value, ...toAdd]
    }
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
    switchToMode,
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
    addDiscoveredWorkspaceSkills,
    updateSkill,
    deleteSkill,
    duplicateSkill,
    toggleSkill,
    setSkillIds,
  }
}

// ─── Module-level Getters ──────────────────────────────────────────

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

// ─── Server Sync Helpers ───────────────────────────────────────────

/**
 * 合并服务端与本地 Skills：以 id 为键并集合并，同 id 保留 updatedAt 较新者，runtime 始终以本地为准
 */
function mergeSkills(remote: AISkillSync[], local: AISkill[]): AISkill[] {
  const mergedMap = new Map<string, AISkill>()

  // 先放入所有本地 skill
  for (const s of local) {
    mergedMap.set(s.id, { ...s })
  }

  // 合并远端 skill
  for (const r of remote) {
    const existing = mergedMap.get(r.id)
    const remoteTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0
    const localTime = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0

    if (!existing || remoteTime > localTime) {
      // 远端无此项，或远端版本更新：采用远端数据，但保留本地 runtime
      mergedMap.set(r.id, {
        ...r,
        runtime: existing?.runtime,
      })
    }
    // 否则保留本地版本（含 runtime）
  }

  return Array.from(mergedMap.values())
}

/**
 * 合并服务端与本地 Presets：以 id 为键并集合并，同 id 保留 updatedAt 较新者，apiKey 始终以本地为准
 */
function mergePresets(remote: AIPresetSync[], local: AIPreset[]): AIPreset[] {
  const mergedMap = new Map<string, AIPreset>()

  // 先放入所有本地 preset
  for (const p of local) {
    mergedMap.set(p.id, { ...p })
  }

  // 合并远端 preset
  for (const r of remote) {
    const existing = mergedMap.get(r.id)
    const remoteTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0
    const localTime = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0

    if (!existing || remoteTime > localTime) {
      // 远端无此项，或远端版本更新：采用远端数据，但保留本地 apiKey
      mergedMap.set(r.id, {
        ...r,
        apiKey: existing?.apiKey ?? '',
      })
    }
    // 否则保留本地版本（含 apiKey）
  }

  return Array.from(mergedMap.values())
}

/**
 * 从服务端同步 Skills（登录时调用）
 * 合并策略：以 id 为键并集合并，同 id 保留 updatedAt 较新者，runtime 始终以本地为准
 * 合并后写回 localStorage 并推送服务端
 */
export async function syncSkillsFromServer(): Promise<void> {
  const remote = await fetchSkillsFromServer()
  if (!remote) return

  const merged = mergeSkills(remote, skills.value)
  skills.value = merged // watcher 自动触发 saveSkills + pushSkillsToServer
}

/**
 * 从服务端同步 Presets（登录时调用）
 * 合并策略：以 id 为键并集合并，同 id 保留 updatedAt 较新者，apiKey 始终以本地为准
 * 合并后写回 localStorage 并推送服务端
 */
export async function syncPresetsFromServer(): Promise<void> {
  const remote = await fetchPresetsFromServer()
  if (!remote) return

  const merged = mergePresets(remote, presets.value)
  presets.value = merged // watcher 自动触发 savePresets + pushPresetsToServer
}

// ─── Re-export Types ───────────────────────────────────────────────

export type { ThinkingMode, AssistantMode, AIConfig, AIPreset } from './types'
