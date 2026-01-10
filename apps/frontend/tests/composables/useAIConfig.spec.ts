import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useAIConfig } from '@/composables/useAIConfig'

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

describe('useAIConfig', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    localStorage.clear()
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
      }

      localStorage.setItem('ai-config', JSON.stringify(savedConfig))

      const { config } = useAIConfig()

      expect(config.value).toEqual(savedConfig)
    })

    it('should merge saved config with defaults', () => {
      const savedConfig = {
        baseUrl: 'https://api.test.com',
        apiKey: 'test-key',
      }

      localStorage.setItem('ai-config', JSON.stringify(savedConfig))

      const { config, DEFAULT_CONFIG } = useAIConfig()

      expect(config.value).toEqual({
        ...DEFAULT_CONFIG,
        baseUrl: 'https://api.test.com',
        apiKey: 'test-key',
      })
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

    it('should persist updated config to localStorage', () => {
      const { updateConfig } = useAIConfig()

      updateConfig({ apiKey: 'persisted-key' })

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

  describe('preset management', () => {
    it('should add a new preset', () => {
      const { presets, addPreset } = useAIConfig()

      const newPreset = addPreset({
        name: 'Test Preset',
        baseUrl: 'https://api.test.com',
        apiKey: 'preset-key',
        model: 'preset-model',
        systemPrompt: 'Test prompt',
        temperature: 0.5,
        thinkingMode: 'enabled',
        todoAssistant: false,
      })

      expect(presets.value).toHaveLength(1)
      expect(presets.value[0]).toEqual(newPreset)
      expect(newPreset.id).toBeDefined()
      expect(newPreset.name).toBe('Test Preset')
    })

    it('should persist presets to localStorage', () => {
      const { addPreset } = useAIConfig()

      addPreset({
        name: 'Persistent Preset',
        baseUrl: 'https://api.test.com',
        apiKey: 'preset-key',
        model: 'preset-model',
        systemPrompt: 'Test prompt',
        temperature: 0.5,
        thinkingMode: 'enabled',
        todoAssistant: false,
      })

      const saved = localStorage.getItem('ai-presets')
      expect(saved).toBeTruthy()
      const parsed = JSON.parse(saved!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0]).toHaveProperty('name', 'Persistent Preset')
    })

    it('should update a preset', () => {
      const { presets, addPreset, updatePreset } = useAIConfig()

      const preset = addPreset({
        name: 'Original Preset',
        baseUrl: 'https://api.test.com',
        apiKey: 'preset-key',
        model: 'preset-model',
        systemPrompt: 'Test prompt',
        temperature: 0.5,
        thinkingMode: 'enabled',
        todoAssistant: false,
      })

      updatePreset(preset.id, { name: 'Updated Preset', model: 'updated-model' })

      expect(presets.value).toHaveLength(1)
      expect(presets.value[0].name).toBe('Updated Preset')
      expect(presets.value[0].model).toBe('updated-model')
      expect(presets.value[0].baseUrl).toBe('https://api.test.com') // Should remain unchanged
    })

    it('should delete a preset', () => {
      const { presets, addPreset, deletePreset } = useAIConfig()

      const preset = addPreset({
        name: 'To Delete Preset',
        baseUrl: 'https://api.test.com',
        apiKey: 'preset-key',
        model: 'preset-model',
        systemPrompt: 'Test prompt',
        temperature: 0.5,
        thinkingMode: 'enabled',
        todoAssistant: false,
      })

      expect(presets.value).toHaveLength(1)
      deletePreset(preset.id)
      expect(presets.value).toHaveLength(0)
    })

    it('should switch to a preset', () => {
      const { config, activePreset, activePresetId, addPreset, switchPreset } = useAIConfig()

      const preset = addPreset({
        name: 'Switch Preset',
        baseUrl: 'https://switch-api.com',
        apiKey: 'switch-key',
        model: 'switch-model',
        systemPrompt: 'Switch prompt',
        temperature: 0.8,
        thinkingMode: 'disabled',
        todoAssistant: true,
      })

      switchPreset(preset.id)

      expect(config.value.baseUrl).toBe('https://switch-api.com')
      expect(config.value.apiKey).toBe('switch-key')
      expect(config.value.model).toBe('switch-model')
      expect(activePreset.value).toEqual(preset)
      expect(activePresetId.value).toBe(preset.id)
    })

    it('should get preset defaults from current config', () => {
      const { updateConfig, getPresetDefaults } = useAIConfig()

      updateConfig({
        baseUrl: 'https://defaults-api.com',
        apiKey: 'defaults-key',
        model: 'defaults-model',
        temperature: 0.9,
        systemPrompt: 'Defaults prompt',
        thinkingMode: 'disabled',
        todoAssistant: true,
      })

      const defaults = getPresetDefaults()

      expect(defaults).toEqual({
        baseUrl: 'https://defaults-api.com',
        apiKey: 'defaults-key',
        model: 'defaults-model',
        temperature: 0.9,
        systemPrompt: 'Defaults prompt',
        thinkingMode: 'disabled',
        todoAssistant: true,
      })
    })
  })

  describe('readonly properties', () => {
    it('should make config readonly', () => {
      const { config } = useAIConfig()

      expect(() => {
        // @ts-expect-error - testing readonly property
        config.value = { ...config.value, apiKey: 'modified' }
      }).toThrow()
    })

    it('should make activePresetId readonly', () => {
      const { activePresetId } = useAIConfig()

      expect(() => {
        // @ts-expect-error - testing readonly property
        activePresetId.value = 'modified-id'
      }).toThrow()
    })
  })
})
