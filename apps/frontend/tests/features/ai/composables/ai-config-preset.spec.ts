import { describe, it, expect, beforeEach } from 'vitest'
import { useAIConfig, _resetAIConfig } from '@/features/ai/composables/useAIConfig'

describe('useAIConfig Presets', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetAIConfig()
  })

  it('should update preset name correctly', () => {
    const { addPreset, updatePreset, presets } = useAIConfig()

    const preset = addPreset({
      name: 'Initial Name',
      baseUrl: 'http://test.com',
      apiKey: 'test-key',
      model: 'test-model',
      systemPrompt: 'test-prompt',
      temperature: 0.5,
      todoAssistant: false,
    })

    expect(presets.value[0].name).toBe('Initial Name')

    updatePreset(preset.id, { name: 'Updated Name' })

    expect(presets.value[0].name).toBe('Updated Name')
  })

  it('should sync config if active preset is updated', () => {
    const { addPreset, updatePreset, switchPreset, config } = useAIConfig()

    const preset = addPreset({
      name: 'Preset 1',
      baseUrl: 'http://test.com',
      apiKey: 'test-key',
      model: 'test-model',
      systemPrompt: 'test-prompt',
      temperature: 0.5,
      todoAssistant: false,
    })

    switchPreset(preset.id)
    expect(config.value.model).toBe('test-model')

    updatePreset(preset.id, { model: 'new-model' })
    expect(config.value.model).toBe('new-model')
  })
})
