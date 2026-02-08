import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import {
  useAIConfig,
  _resetAIConfig,
  aiThinkingMode,
  getAIThinkingMode,
} from '@/features/ai/composables/useAIConfig'

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}

  return {
    getItem(key: string): string | null {
      return store[key] || null
    },
    setItem(key: string, value: string): void {
      store[key] = value.toString()
    },
    removeItem(key: string): void {
      delete store[key]
    },
    clear(): void {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('useAIConfig - Core', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetAIConfig()
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should initialize with default config', () => {
      const { config, DEFAULT_CONFIG } = useAIConfig()

      expect(config.value).toEqual(DEFAULT_CONFIG)
      expect(config.value.baseUrl).toBe(
        import.meta.env.VITE_AI_API_URL || 'https://api.deepseek.com',
      )
      expect(config.value.apiKey).toBe(import.meta.env.VITE_AI_API_KEY || '')
      expect(config.value.model).toBe(import.meta.env.VITE_AI_MODEL || 'deepseek-chat')
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

      // @ts-expect-error - testing readonly property
      config.value = { ...config.value, apiKey: 'modified' }

      expect(config.value).toEqual(originalValue)
    })

    it('should make activePresetId readonly', () => {
      const { activePresetId } = useAIConfig()
      const originalValue = activePresetId.value

      // @ts-expect-error - testing readonly property
      activePresetId.value = 'modified-id'

      expect(activePresetId.value).toBe(originalValue)
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
      expect(() => importPresets('invalid-json')).toThrow()
    })

    it('should throw error for invalid data structure', () => {
      const { importPresets } = useAIConfig()
      expect(() => importPresets(JSON.stringify({ not: 'an array' }))).toThrow()
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
})
