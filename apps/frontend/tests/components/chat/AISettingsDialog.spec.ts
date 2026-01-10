import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import AISettingsDialog from '@/components/chat/AISettingsDialog.vue'
import { useAIConfig } from '@/composables/useAIConfig'

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

const mockPresets = ref<any[]>([])
const mockActivePresetId = ref<string | null>(null)

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
    presets: mockPresets,
    activePresetId: mockActivePresetId,
    switchPreset: vi.fn((id) => {
      mockActivePresetId.value = id
    }),
    addPreset: vi.fn((p) => {
      const newPreset = { ...p, id: 'test-id' }
      mockPresets.value.push(newPreset)
      return newPreset
    }),
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
    mockPresets.value = []
    mockActivePresetId.value = null
  })

  it('should render correct initial tab', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
        initialTab: 'settings',
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    expect(wrapper.find('button.text-\\[\\#6b5c4d\\]').text()).toContain('ai.basicSettings')
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
    // 通过 expose 的 activeTab 修改
    ;(wrapper.vm as any).activeTab = 'presets'
    await nextTick()

    expect(wrapper.emitted('update:initialTab')).toBeTruthy()
    expect(wrapper.emitted('update:initialTab')![0]).toEqual(['presets'])
  })

  it('should switch preset and update active state', async () => {
    const { addPreset } = useAIConfig()
    const preset = addPreset({
      name: 'Test Preset',
      baseUrl: 'https://api.test.com',
      apiKey: 'test-key',
      model: 'test-model',
      systemPrompt: 'Test prompt',
      temperature: 0.5,
      thinkingMode: 'enabled',
      todoAssistant: false,
    })

    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
        initialTab: 'presets',
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await nextTick()

    // 点击预设项进行激活
    const presetItem = wrapper.find('.cursor-pointer')
    await presetItem.trigger('click')

    expect(mockActivePresetId.value).toBe(preset.id)
    expect(wrapper.find('.bg-\\[\\#c9b896\\]\\/10').exists()).toBe(true) // 激活标签
  })

  it('should reset tab and state when modelValue becomes true', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: false,
        initialTab: 'presets',
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    // 设置一些中间状态
    ;(wrapper.vm as any).activeTab = 'settings'

    await wrapper.setProps({ modelValue: true })
    await nextTick()

    expect((wrapper.vm as any).activeTab).toBe('presets')
  })
})
