import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useAIConfig, _resetAIConfig, aiThinkingMode } from '@/features/ai/composables/useAIConfig'

describe('useAIConfig - Presets', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetAIConfig()
    vi.clearAllMocks()
  })

  describe('preset management', () => {
    it('should add a new preset', () => {
      const { presets, addPreset } = useAIConfig()
      const initialLength = presets.value.length

      const newPreset = addPreset({
        name: 'Test Preset',
        baseUrl: 'https://api.test.com',
        apiKey: 'preset-key',
        model: 'preset-model',
        systemPrompt: 'Test prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      expect(presets.value).toHaveLength(initialLength + 1)
      expect(presets.value[presets.value.length - 1]).toEqual(newPreset)
      expect(newPreset.id).toBeDefined()
      expect(newPreset.name).toBe('Test Preset')
    })

    it('should persist presets to localStorage', async () => {
      const { presets, addPreset } = useAIConfig()
      const initialLength = presets.value.length

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
      expect(parsed).toHaveLength(initialLength + 1)
      expect(parsed[parsed.length - 1]).toHaveProperty('name', 'Persistent Preset')
    })

    it('should update a preset', () => {
      const { presets, addPreset, updatePreset } = useAIConfig()
      const initialLength = presets.value.length

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

      expect(presets.value).toHaveLength(initialLength + 1)
      const updatedPreset = presets.value.find((p) => p.id === preset.id)
      expect(updatedPreset?.name).toBe('Updated Preset')
      expect(updatedPreset?.model).toBe('updated-model')
      expect(updatedPreset?.baseUrl).toBe('https://api.test.com') // Should remain unchanged
    })

    it('should delete a preset', () => {
      const { presets, addPreset, deletePreset } = useAIConfig()
      const initialLength = presets.value.length

      const preset = addPreset({
        name: 'To Delete Preset',
        baseUrl: 'https://api.test.com',
        apiKey: 'preset-key',
        model: 'preset-model',
        systemPrompt: 'Test prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      expect(presets.value).toHaveLength(initialLength + 1)
      deletePreset(preset.id)
      expect(presets.value).toHaveLength(initialLength)
    })

    it('should duplicate a preset', () => {
      const { presets, addPreset, duplicatePreset } = useAIConfig()
      const initialLength = presets.value.length

      const preset = addPreset({
        name: 'To Duplicate',
        baseUrl: 'https://api.test.com',
        apiKey: 'key',
        model: 'model',
        systemPrompt: 'prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      const duplicated = duplicatePreset(preset.id)

      expect(presets.value).toHaveLength(initialLength + 2)
      expect(duplicated).toBeTruthy()
      expect(duplicated!.id).not.toBe(preset.id)
      expect(duplicated!.name).toContain('To Duplicate') // It uses "name (copy)" or similar
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

    it('should sync current config to active preset', async () => {
      const { addPreset, switchPreset, updateConfig, syncConfigToPreset, presets, activePresetId } =
        useAIConfig()

      const preset = addPreset({
        name: 'Sync Target',
        baseUrl: 'https://sync-api.com',
        apiKey: 'sync-key',
        model: 'sync-model',
        systemPrompt: 'Sync prompt',
        temperature: 0.5,
        todoAssistant: false,
      })

      switchPreset(preset.id)
      updateConfig({
        model: 'sync-model-v2',
        systemPrompt: 'Sync prompt v2',
        temperature: 0.7,
      })
      await nextTick()
      expect(activePresetId.value).toBeNull()

      const synced = syncConfigToPreset(preset.id)
      await nextTick()

      expect(synced).toBe(true)
      const updatedPreset = presets.value.find((item) => item.id === preset.id)
      expect(updatedPreset?.model).toBe('sync-model-v2')
      expect(updatedPreset?.systemPrompt).toBe('Sync prompt v2')
      expect(updatedPreset?.temperature).toBe(0.7)
      expect(activePresetId.value).toBe(preset.id)
    })

    it('should return false when syncing without available preset target', () => {
      const { syncConfigToPreset } = useAIConfig()

      expect(syncConfigToPreset()).toBe(false)
      expect(syncConfigToPreset('not-exists')).toBe(false)
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

    it('should include skillIds when matching preset activation', async () => {
      const { updateConfig, addPreset, addSkill, activePresetId } = useAIConfig()
      const skill = addSkill({
        name: 'code-review',
        prompt: 'Find risks first',
      })

      const preset = addPreset({
        name: 'Matching Skill Preset',
        baseUrl: 'https://match-api.com',
        apiKey: 'match-key',
        model: 'match-model',
        systemPrompt: 'Match prompt',
        temperature: 0.5,
        todoAssistant: false,
        skillIds: [skill.id],
      })

      updateConfig({
        baseUrl: 'https://match-api.com',
        apiKey: 'match-key',
        model: 'match-model',
        systemPrompt: 'Match prompt',
        temperature: 0.5,
        skillIds: [skill.id],
      })

      await nextTick()
      expect(activePresetId.value).toBe(preset.id)

      updateConfig({ skillIds: [] })
      await nextTick()
      expect(activePresetId.value).toBeNull()
    })

    it('should treat skillIds as an unordered set when matching preset', async () => {
      const { updateConfig, addPreset, addSkill, activePresetId } = useAIConfig()
      const skillA = addSkill({
        name: 'code-review',
        prompt: 'Find risks first',
      })
      const skillB = addSkill({
        name: 'architect',
        prompt: 'Focus on trade-offs',
      })

      const preset = addPreset({
        name: 'Order-insensitive Skill Preset',
        baseUrl: 'https://match-api.com',
        apiKey: 'match-key',
        model: 'match-model',
        systemPrompt: 'Match prompt',
        temperature: 0.5,
        todoAssistant: false,
        skillIds: [skillA.id, skillB.id],
      })

      updateConfig({
        baseUrl: 'https://match-api.com',
        apiKey: 'match-key',
        model: 'match-model',
        systemPrompt: 'Match prompt',
        temperature: 0.5,
        skillIds: [skillB.id, skillA.id],
      })

      await nextTick()
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
        thinkingEffort: 'max',
        todoAssistant: true,
        skillIds: [],
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

    it('should allow switching between two identical presets', async () => {
      const { addPreset, switchPreset, activePresetId } = useAIConfig()

      const preset1 = addPreset({
        name: 'Preset 1',
        baseUrl: 'https://same.com',
        apiKey: 'same',
        model: 'same',
        systemPrompt: 'same',
        temperature: 0.5,
        todoAssistant: false,
      })

      const preset2 = addPreset({
        name: 'Preset 2',
        baseUrl: 'https://same.com',
        apiKey: 'same',
        model: 'same',
        systemPrompt: 'same',
        temperature: 0.5,
        todoAssistant: false,
      })

      switchPreset(preset1.id)
      await nextTick()
      expect(activePresetId.value).toBe(preset1.id)

      switchPreset(preset2.id)
      await nextTick()
      expect(activePresetId.value).toBe(preset2.id)
    })
  })
})
