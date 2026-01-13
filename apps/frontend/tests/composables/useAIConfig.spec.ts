import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import {
  useAIConfig,
  _resetAIConfig,
  aiThinkingMode,
  getAIThinkingMode,
} from '@/composables/useAIConfig'

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
      }

      localStorage.setItem('ai-config', JSON.stringify(savedConfig))

      _resetAIConfig() // 手动触发重置以从 localStorage 加载
      const { config } = useAIConfig()

      expect(config.value).toEqual(savedConfig)
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
        todoAssistant: false,
      })

      expect(presets.value).toHaveLength(1)
      expect(presets.value[0]).toEqual(newPreset)
      expect(newPreset.id).toBeDefined()
      expect(newPreset.name).toBe('Test Preset')
    })

    it('should persist presets to localStorage', async () => {
      const { addPreset } = useAIConfig()

      addPreset({
        name: 'Persistent Preset',
        baseUrl: 'https://api.test.com',
        apiKey: 'preset-key',
        model: 'preset-model',
        systemPrompt: 'Test prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      await nextTick()

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
        todoAssistant: false,
      })

      expect(presets.value).toHaveLength(1)
      deletePreset(preset.id)
      expect(presets.value).toHaveLength(0)
    })

    it('should duplicate a preset', () => {
      const { presets, addPreset, duplicatePreset } = useAIConfig()

      const preset = addPreset({
        name: 'Original',
        baseUrl: 'https://api.test.com',
        apiKey: 'key',
        model: 'model',
        systemPrompt: 'prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      const duplicated = duplicatePreset(preset.id)

      expect(presets.value).toHaveLength(2)
      expect(duplicated).toBeTruthy()
      expect(duplicated!.id).not.toBe(preset.id)
      expect(duplicated!.name).toContain('Original')
      expect(duplicated!.model).toBe(preset.model)
      expect(duplicated!.temperature).toBe(preset.temperature)
    })

    it('should switch presets', () => {
      const { config, activePreset, activePresetId, addPreset, switchPreset } = useAIConfig()

      const preset = addPreset({
        name: 'Switch Preset',
        baseUrl: 'https://switch-api.com',
        apiKey: 'switch-key',
        model: 'switch-model',
        systemPrompt: 'Switch prompt',
        temperature: 0.8,
        todoAssistant: true,
      })

      switchPreset(preset.id)

      expect(config.value.baseUrl).toBe('https://switch-api.com')
      expect(config.value.apiKey).toBe('switch-key')
      expect(config.value.model).toBe('switch-model')
      expect(activePreset.value).toEqual(preset)
      expect(activePresetId.value).toBe(preset.id)
    })

    it('should automatically switch to a matching preset when config is updated', async () => {
      const { updateConfig, addPreset, activePresetId } = useAIConfig()

      const preset = addPreset({
        name: 'Matching Preset',
        baseUrl: 'https://match-api.com',
        apiKey: 'match-key',
        model: 'match-model',
        systemPrompt: 'Match prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      // Update config to match the preset
      updateConfig({
        baseUrl: 'https://match-api.com',
        apiKey: 'match-key',
        model: 'match-model',
        systemPrompt: 'Match prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      await nextTick() // Wait for watcher

      expect(activePresetId.value).toBe(preset.id)
    })

    it('should automatically switch to null when config no longer matches any preset', async () => {
      const { updateConfig, addPreset, activePresetId, switchPreset } = useAIConfig()

      const preset = addPreset({
        name: 'Matching Preset',
        baseUrl: 'https://match-api.com',
        apiKey: 'match-key',
        model: 'match-model',
        systemPrompt: 'Match prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      switchPreset(preset.id)
      await nextTick()
      expect(activePresetId.value).toBe(preset.id)

      // Update config to something else
      updateConfig({ model: 'different-model' })
      await nextTick()

      expect(activePresetId.value).toBeNull()
    })

    it('should automatically switch when a preset is updated to match current config', async () => {
      const { updateConfig, addPreset, updatePreset, activePresetId } = useAIConfig()

      // Current config is something custom
      updateConfig({
        baseUrl: 'https://custom-api.com',
        apiKey: 'custom-key',
        model: 'custom-model',
      })
      await nextTick()
      expect(activePresetId.value).toBeNull()

      // Create a preset that doesn't match
      const preset = addPreset({
        name: 'Non-matching Preset',
        baseUrl: 'https://other-api.com',
        apiKey: 'other-key',
        model: 'other-model',
        systemPrompt: 'Other prompt',
        temperature: 0.3,
        todoAssistant: false,
      })

      // Update the preset to match the current custom config
      updatePreset(preset.id, {
        baseUrl: 'https://custom-api.com',
        apiKey: 'custom-key',
        model: 'custom-model',
        systemPrompt: 'Other prompt', // Keep this or update it too
        temperature: 0.3,
      })

      // Update config systemPrompt to match preset's systemPrompt for full match
      updateConfig({ systemPrompt: 'Other prompt', temperature: 0.3 })

      await nextTick()

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
        todoAssistant: true,
      })

      const defaults = getPresetDefaults()

      expect(defaults).toEqual({
        baseUrl: 'https://defaults-api.com',
        apiKey: 'defaults-key',
        model: 'defaults-model',
        temperature: 0.9,
        systemPrompt: 'Defaults prompt',
        todoAssistant: true,
      })
    })

    it('should NOT change active preset when thinking mode is toggled (repro)', async () => {
      const { addPreset, switchPreset, activePresetId } = useAIConfig()

      const preset = addPreset({
        name: 'Fixed Preset',
        baseUrl: 'https://fixed-api.com',
        apiKey: 'fixed-key',
        model: 'fixed-model',
        systemPrompt: 'Fixed prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      switchPreset(preset.id)
      await nextTick()
      expect(activePresetId.value).toBe(preset.id)

      // Toggle thinking mode via aiThinkingMode ref (similar to toggleThinkingMode in Drawer)
      aiThinkingMode.value = aiThinkingMode.value === 'enabled' ? 'disabled' : 'enabled'
      await nextTick()
      await nextTick() // Second tick for the config watcher

      // Active preset should still be the same
      expect(activePresetId.value).toBe(preset.id)
    })

    it('should NOT change active preset when todo assistant is toggled', async () => {
      const { addPreset, switchPreset, activePresetId, updateConfig } = useAIConfig()

      const preset = addPreset({
        name: 'Fixed Preset',
        baseUrl: 'https://fixed-api.com',
        apiKey: 'fixed-key',
        model: 'fixed-model',
        systemPrompt: 'Fixed prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      switchPreset(preset.id)
      await nextTick()
      expect(activePresetId.value).toBe(preset.id)

      // Toggle todo assistant
      updateConfig({ todoAssistant: true })
      await nextTick()
      await nextTick()

      // Active preset should still be the same
      expect(activePresetId.value).toBe(preset.id)
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
})
