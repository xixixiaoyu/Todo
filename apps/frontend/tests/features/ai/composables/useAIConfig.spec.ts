import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import {
  useAIConfig,
  _resetAIConfig,
  aiThinkingMode,
  getAIThinkingMode,
} from '@/features/ai/composables/useAIConfig'

describe('useAIConfig - Core', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetAIConfig()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initial state', () => {
    it('should initialize with default config', () => {
      const { config, DEFAULT_CONFIG } = useAIConfig()

      expect(config.value).toEqual(DEFAULT_CONFIG)
      expect(config.value.baseUrl).toBe('https://api.deepseek.com')
      expect(config.value.apiKey).toBe('')
      expect(config.value.model).toBe('deepseek-chat')
      expect(config.value.temperature).toBe(0.6)
    })

    it('should load saved config from localStorage', () => {
      const savedConfig = {
        baseUrl: 'https://api.test.com',
        apiKey: 'test-key',
        model: 'test-model',
        temperature: 0.7,
        systemPrompt: 'Test prompt',
        thinkingMode: 'enabled' as const,
        todoAssistant: true,
        discussionMode: true,
        discussionModelIds: ['1', '2'],
        discussionPrimaryModelId: null,
        memoryModelId: null,
        enableImageGeneration: false,
      }

      localStorage.setItem('ai-config', JSON.stringify(savedConfig))

      _resetAIConfig() // 手动触发重置以从 localStorage 加载
      const { config, DEFAULT_CONFIG } = useAIConfig()

      expect(config.value).toEqual({
        ...DEFAULT_CONFIG,
        ...savedConfig,
      })
    })

    it('should merge saved config with defaults', () => {
      const savedConfig = {
        baseUrl: 'https://api.test.com',
        apiKey: 'test-key',
      }

      localStorage.setItem('ai-config', JSON.stringify(savedConfig))

      _resetAIConfig() // 手动触发重置以从 localStorage 加载
      const { config, DEFAULT_CONFIG } = useAIConfig()

      expect(config.value).toEqual({
        ...DEFAULT_CONFIG,
        baseUrl: 'https://api.test.com',
        apiKey: 'test-key',
      })
    })
  })

  describe('AI Thinking Mode', () => {
    it('should initialize with default value (enabled)', () => {
      expect(aiThinkingMode.value).toBe('enabled')
      expect(getAIThinkingMode()).toBe('enabled')
    })

    it('should load saved value from localStorage', () => {
      localStorage.setItem('ai_thinking_mode', 'disabled')
      _resetAIConfig()
      expect(aiThinkingMode.value).toBe('disabled')
    })

    it('should persist value to localStorage when changed', async () => {
      aiThinkingMode.value = 'disabled'
      await nextTick()
      expect(localStorage.getItem('ai_thinking_mode')).toBe('disabled')
    })

    it('should sync with config.thinkingMode', async () => {
      const { config, updateConfig } = useAIConfig()

      // aiThinkingMode -> config
      aiThinkingMode.value = 'disabled'
      await nextTick()
      expect(config.value.thinkingMode).toBe('disabled')

      // config -> aiThinkingMode
      updateConfig({ thinkingMode: 'enabled' })
      await nextTick()
      expect(aiThinkingMode.value).toBe('enabled')
    })
  })

  describe('updateConfig', () => {
    it('should update config with partial values', () => {
      const { config, updateConfig } = useAIConfig()

      const initialConfig = { ...config.value }
      updateConfig({ apiKey: 'new-key', model: 'new-model' })

      expect(config.value.apiKey).toBe('new-key')
      expect(config.value.model).toBe('new-model')
      expect(config.value.baseUrl).toBe(initialConfig.baseUrl) // Should remain unchanged
    })

    it('should persist updated config to localStorage', async () => {
      const { updateConfig } = useAIConfig()

      updateConfig({ apiKey: 'persisted-key' })
      await nextTick()

      const saved = localStorage.getItem('ai-config')
      expect(saved).toBeTruthy()
      expect(JSON.parse(saved!)).toHaveProperty('apiKey', 'persisted-key')
    })
  })

  describe('resetConfig', () => {
    it('should reset to default config', () => {
      const { config, updateConfig, resetConfig, DEFAULT_CONFIG } = useAIConfig()

      updateConfig({ apiKey: 'modified-key', model: 'modified-model' })
      expect(config.value.apiKey).toBe('modified-key')

      resetConfig()

      expect(config.value).toEqual(DEFAULT_CONFIG)
    })

    it('should update localStorage after reset', () => {
      const { updateConfig, resetConfig } = useAIConfig()

      updateConfig({ apiKey: 'modified-key' })
      resetConfig()

      const saved = localStorage.getItem('ai-config')
      expect(JSON.parse(saved!)).toHaveProperty('apiKey', '')
    })
  })

  describe('isConfigValid', () => {
    it('should return true when all required fields are present', () => {
      const { updateConfig, isConfigValid } = useAIConfig()

      updateConfig({
        baseUrl: 'https://api.test.com',
        apiKey: 'valid-key',
        model: 'valid-model',
      })

      expect(isConfigValid()).toBe(true)
    })

    it('should return false when baseUrl is missing', () => {
      const { updateConfig, isConfigValid } = useAIConfig()

      updateConfig({
        baseUrl: '',
        apiKey: 'valid-key',
        model: 'valid-model',
      })

      expect(isConfigValid()).toBe(false)
    })

    it('should return false when apiKey is missing', () => {
      const { updateConfig, isConfigValid } = useAIConfig()

      updateConfig({
        baseUrl: 'https://api.test.com',
        apiKey: '',
        model: 'valid-model',
      })

      expect(isConfigValid()).toBe(false)
    })

    it('should return false when model is missing', () => {
      const { updateConfig, isConfigValid } = useAIConfig()

      updateConfig({
        baseUrl: 'https://api.test.com',
        apiKey: 'valid-key',
        model: '',
      })

      expect(isConfigValid()).toBe(false)
    })
  })

  describe('readonly properties', () => {
    it('should make config readonly', () => {
      const { config } = useAIConfig()
      const originalValue = { ...config.value }

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // @ts-expect-error - testing readonly property
      config.value = { ...config.value, apiKey: 'modified' }

      expect(config.value).toEqual(originalValue)

      warnSpy.mockRestore()
    })

    it('should make activePresetId readonly', () => {
      const { activePresetId } = useAIConfig()
      const originalValue = activePresetId.value

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // @ts-expect-error - testing readonly property
      activePresetId.value = 'modified-id'

      expect(activePresetId.value).toBe(originalValue)

      warnSpy.mockRestore()
    })
  })

  describe('Import/Export', () => {
    it('should export all presets as JSON string', () => {
      const { addPreset, exportPresets } = useAIConfig()
      const preset1 = {
        name: 'Preset 1',
        baseUrl: 'https://api1.com',
        apiKey: 'key1',
        model: 'model1',
        systemPrompt: 'prompt1',
        temperature: 0.5,
        todoAssistant: false,
      }
      const preset2 = {
        name: 'Preset 2',
        baseUrl: 'https://api2.com',
        apiKey: 'key2',
        model: 'model2',
        systemPrompt: 'prompt2',
        temperature: 0.8,
        todoAssistant: true,
      }

      addPreset(preset1)
      addPreset(preset2)

      const exported = exportPresets()
      const parsed = JSON.parse(exported)

      expect(parsed).toHaveLength(2)
      expect(parsed[0]).toMatchObject(preset1)
      expect(parsed[1]).toMatchObject(preset2)
      expect(parsed[0]).toHaveProperty('id')
      expect(parsed[1]).toHaveProperty('id')
    })

    it('should import presets in merge mode', () => {
      const { presets, addPreset, importPresets } = useAIConfig()
      const existingPreset = {
        name: 'Existing',
        baseUrl: 'https://existing.com',
        apiKey: 'key',
        model: 'model',
        systemPrompt: 'prompt',
        temperature: 0.5,
        todoAssistant: false,
      }
      addPreset(existingPreset)

      const importData = [
        {
          name: 'Imported',
          baseUrl: 'https://imported.com',
          apiKey: 'newkey',
          model: 'newmodel',
          systemPrompt: 'newprompt',
          temperature: 0.7,
          todoAssistant: true,
        },
      ]

      importPresets(JSON.stringify(importData))

      expect(presets.value).toHaveLength(2)
      expect(presets.value[0].name).toBe('Existing')
      expect(presets.value[1].name).toBe('Imported')
      expect(presets.value[1]).toHaveProperty('id')
      expect(presets.value[1].id).not.toBe(presets.value[0].id)
    })

    it('should import presets in replace mode', () => {
      const { presets, addPreset, importPresets } = useAIConfig()
      addPreset({
        name: 'Existing',
        baseUrl: 'https://existing.com',
        apiKey: 'key',
        model: 'model',
        systemPrompt: 'prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      const importData = [
        {
          name: 'Imported',
          baseUrl: 'https://imported.com',
          apiKey: 'newkey',
          model: 'newmodel',
          systemPrompt: 'newprompt',
          temperature: 0.7,
          todoAssistant: true,
        },
      ]

      importPresets(JSON.stringify(importData), 'replace')

      expect(presets.value).toHaveLength(1)
      expect(presets.value[0].name).toBe('Imported')
    })

    it('should throw error for invalid JSON', () => {
      const { importPresets } = useAIConfig()

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => importPresets('invalid-json')).toThrow(SyntaxError)
      expect(errorSpy).toHaveBeenCalledWith('导入预设失败:', expect.any(SyntaxError))

      errorSpy.mockRestore()
    })

    it('should throw error for invalid data structure', () => {
      const { importPresets } = useAIConfig()

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => importPresets(JSON.stringify({ not: 'an array' }))).toThrow(
        'Invalid presets format',
      )
      expect(errorSpy).toHaveBeenCalledWith(
        '导入预设失败:',
        expect.objectContaining({ message: 'Invalid presets format: expected an array' }),
      )

      errorSpy.mockRestore()
    })

    it('should filter out invalid preset items during import', () => {
      const { presets, importPresets } = useAIConfig()
      const importData = [
        { name: 'Valid', baseUrl: 'https://v.com', model: 'm' },
        { name: 'Invalid' }, // missing baseUrl and model
      ]

      importPresets(JSON.stringify(importData))

      expect(presets.value).toHaveLength(1)
      expect(presets.value[0].name).toBe('Valid')
    })
  })

  describe('skills', () => {
    it('should add and toggle skills into config', () => {
      const { skills, config, addSkill, toggleSkill } = useAIConfig()

      const created = addSkill({
        name: 'code-review',
        description: 'review mode',
        aliases: ['review'],
        prompt: 'focus on bugs first',
      })

      expect(skills.value).toHaveLength(1)
      expect(config.value.skillIds).toEqual([])

      toggleSkill(created.id)
      expect(config.value.skillIds).toEqual([created.id])

      toggleSkill(created.id)
      expect(config.value.skillIds).toEqual([])
    })

    it('should delete selected skill and clean config references', () => {
      const { config, addSkill, setSkillIds, deleteSkill } = useAIConfig()

      const skill = addSkill({
        name: 'architect',
        prompt: 'provide architecture tradeoffs',
      })
      setSkillIds([skill.id])
      expect(config.value.skillIds).toEqual([skill.id])

      deleteSkill(skill.id)
      expect(config.value.skillIds).toEqual([])
    })

    it('should import skills from JSON and skip duplicate names in merge mode', () => {
      const { skills, importSkills } = useAIConfig()

      const first = importSkills(
        JSON.stringify([
          {
            name: 'code-review',
            description: 'Review code changes',
            prompt: 'Find bugs first',
          },
        ]),
      )
      expect(first).toBe(1)
      expect(skills.value).toHaveLength(1)

      const second = importSkills(
        JSON.stringify([
          {
            name: 'code-review',
            description: 'duplicate',
            prompt: 'duplicate',
          },
          {
            name: 'architecture',
            description: 'System design analysis',
            prompt: 'Provide trade-offs',
          },
        ]),
      )

      expect(second).toBe(1)
      expect(skills.value.map((item) => item.name)).toEqual(['code-review', 'architecture'])
    })

    it('should import a single SKILL.md document', () => {
      const { skills, importSkills } = useAIConfig()

      const markdown = [
        '---',
        'name: skill-md-demo',
        'description: Use this when demoing markdown skill import',
        '---',
        '',
        'Always provide concise steps.',
      ].join('\n')

      const count = importSkills(markdown)
      expect(count).toBe(1)
      expect(skills.value[0]).toMatchObject({
        name: 'skill-md-demo',
        description: 'Use this when demoing markdown skill import',
        prompt: 'Always provide concise steps.',
      })
    })

    it('should install skill from external url', async () => {
      const { skills, importSkillsFromExternalSource } = useAIConfig()
      const markdown = [
        '---',
        'name: remote-skill',
        'description: Installed from remote source',
        '---',
        '',
        'Follow remote skill workflow.',
      ].join('\n')

      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => markdown,
      }))
      vi.stubGlobal('fetch', fetchMock)

      const result = await importSkillsFromExternalSource(
        'https://example.com/skills/remote/SKILL.md',
      )
      expect(result.importedCount).toBe(1)
      expect(result.sourceUrl).toBe('https://example.com/skills/remote/SKILL.md')
      expect(skills.value.map((item) => item.name)).toContain('remote-skill')
    })

    it('should fallback to next external candidate when first one fails', async () => {
      const { importSkillsFromExternalSource } = useAIConfig()
      const markdown = [
        '---',
        'name: github-installed-skill',
        'description: Installed from GitHub raw fallback',
        '---',
        '',
        'Use GitHub fallback flow.',
      ].join('\n')

      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/.curated/github/')) {
          return {
            ok: false,
            status: 404,
            text: async () => '',
          }
        }

        return {
          ok: true,
          status: 200,
          text: async () => markdown,
        }
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await importSkillsFromExternalSource('skillhub install github')

      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(result.importedCount).toBe(1)
      expect(result.sourceUrl).toContain('/gh-address-comments/')
    })
  })
})
