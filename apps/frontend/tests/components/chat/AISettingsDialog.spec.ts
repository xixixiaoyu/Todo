import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import AISettingsDialog from '@/components/chat/AISettingsDialog.vue'

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  X: { template: '<span>X</span>' },
  RotateCcw: { template: '<span>RotateCcw</span>' },
  Eye: { template: '<span>Eye</span>' },
  EyeOff: { template: '<span>EyeOff</span>' },
  Check: { template: '<span>Check</span>' },
  Plus: { template: '<span>Plus</span>' },
  Trash2: { template: '<span>Trash2</span>' },
  Edit3: { template: '<span>Edit3</span>' },
}))

// Mock composables
const mockConfig = ref({
  baseUrl: 'https://api.example.com',
  apiKey: 'test-key',
  model: 'test-model',
  systemPrompt: 'test-prompt',
  temperature: 0.7,
  thinkingMode: 'disabled',
  todoAssistant: false,
})

vi.mock('@/composables/useAIConfig', () => ({
  useAIConfig: () => ({
    config: mockConfig,
    updateConfig: vi.fn(),
    DEFAULT_CONFIG: {
      baseUrl: '',
      apiKey: '',
      model: '',
      systemPrompt: '',
      temperature: 0.7,
      thinkingMode: 'disabled',
      todoAssistant: false,
    },
    presets: ref([]),
    addPreset: vi.fn(),
    updatePreset: vi.fn(),
    deletePreset: vi.fn(),
    getPresetDefaults: vi.fn(() => ({
      baseUrl: '',
      apiKey: '',
      model: '',
      systemPrompt: '',
      temperature: 0.7,
      thinkingMode: 'disabled',
      todoAssistant: false,
    })),
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe('AISettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mountOptions = {
    global: {
      stubs: {
        Teleport: true,
      },
    },
  }

  it('should default to "settings" tab when no initialTab is provided', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
        'onUpdate:modelValue': (val: boolean) => wrapper.setProps({ modelValue: val }),
      },
      ...mountOptions,
    })

    // Check if basic settings content is visible
    expect(wrapper.text()).toContain('ai.basicSettings')
    const activeTabBtn = wrapper.find('button.text-\\[\\#6b5c4d\\]')
    expect(activeTabBtn.text()).toContain('ai.basicSettings')
  })

  it('should switch to "presets" tab when initialTab is "presets"', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
        initialTab: 'presets' as const,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await nextTick()
    expect((wrapper.vm as any).activeTab).toBe('presets')
  })

  it('should emit update:initialTab when activeTab changes', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
        initialTab: 'settings' as const,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await nextTick()
    ;(wrapper.vm as any).activeTab = 'presets'
    await nextTick()

    expect(wrapper.emitted('update:initialTab')).toBeTruthy()
    expect(wrapper.emitted('update:initialTab')![0]).toEqual(['presets'])
  })

  it('should reset to initialTab whenever dialog is reopened', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
        initialTab: 'presets' as const,
        'onUpdate:modelValue': (val: boolean) => wrapper.setProps({ modelValue: val }),
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await nextTick()
    expect((wrapper.vm as any).activeTab).toBe('presets')

    // Manually change tab to settings
    ;(wrapper.vm as any).activeTab = 'settings'
    expect((wrapper.vm as any).activeTab).toBe('settings')

    // Close and reopen with initialTab='presets'
    await wrapper.setProps({ modelValue: false })
    await nextTick()
    await wrapper.setProps({ modelValue: true })
    await nextTick()

    expect((wrapper.vm as any).activeTab).toBe('presets')
  })
})
