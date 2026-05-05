import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AIPresetEditorForm from '@/features/ai/components/AIPresetEditorForm.vue'
import type { AIPreset } from '@/features/ai/composables/useAIConfig'

vi.mock('lucide-vue-next', () => ({
  Eye: { template: '<span>Eye</span>' },
  EyeOff: { template: '<span>EyeOff</span>' },
  ChevronLeft: { template: '<span>ChevronLeft</span>' },
  Info: { template: '<span>Info</span>' },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe('AIPresetEditorForm', () => {
  it('should update thinking effort when switching reasoning effort option', async () => {
    const form: Omit<AIPreset, 'id'> = {
      name: 'Preset A',
      baseUrl: 'https://api.deepseek.com',
      apiKey: 'test-key',
      model: 'deepseek-v4-pro',
      systemPrompt: 'system',
      temperature: 0.6,
      thinkingEffort: 'high' as const,
      todoAssistant: false,
      skillIds: [],
    }

    const wrapper = mount(AIPresetEditorForm, {
      props: {
        modelValue: form,
        showApiKey: false,
        isCreating: true,
        isEditing: false,
        nameError: '',
        skills: [],
        'onUpdate:modelValue': (value: typeof form) => Object.assign(form, value),
        'onUpdate:showApiKey': () => undefined,
      },
    })

    const maxButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('ai.reasoningEffortMax'))
    expect(maxButton).toBeDefined()
    await maxButton!.trigger('click')
    expect(form.thinkingEffort).toBe('max')

    const highButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('ai.reasoningEffortHigh'))
    expect(highButton).toBeDefined()
    await highButton!.trigger('click')
    expect(form.thinkingEffort).toBe('high')
  })
})
