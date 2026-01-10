import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import AISettingsDialog from '@/components/chat/AISettingsDialog.vue'
import { useAIConfig } from '@/composables/useAIConfig'
import type { AIPreset, AIConfig } from '@/composables/useAIConfig'

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
  Users: { template: '<span>Users</span>' },
  Star: { template: '<span>Star</span>' },
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
  discussionMode: false,
  discussionModelIds: [],
  discussionPrimaryModelId: null,
})

const mockPresets = ref<AIPreset[]>([])
const mockActivePresetId = ref<string | null>(null)

vi.mock('@/composables/useAIConfig', () => ({
  useAIConfig: () => ({
    config: mockConfig,
    updateConfig: vi.fn((partial) => {
      mockConfig.value = { ...mockConfig.value, ...partial }
      mockActivePresetId.value = null
    }),
    DEFAULT_CONFIG: {
      baseUrl: '',
      apiKey: '',
      model: '',
      systemPrompt: '',
      temperature: 0.7,
      thinkingMode: 'disabled',
      todoAssistant: false,
      discussionMode: false,
      discussionModelIds: [],
      discussionPrimaryModelId: null,
    },
    presets: mockPresets,
    activePresetId: mockActivePresetId,
    switchPreset: vi.fn((id) => {
      const preset = mockPresets.value.find((p) => p.id === id)
      if (preset) {
        mockActivePresetId.value = id
        mockConfig.value = {
          discussionMode: false,
          discussionModelIds: [] as string[],
          discussionPrimaryModelId: null,
          ...preset,
        } as unknown as AIConfig
      }
    }),
    addPreset: vi.fn((p) => {
      const newPreset: AIPreset = {
        discussionMode: false,
        discussionModelIds: [] as string[],
        discussionPrimaryModelId: null,
        ...p,
        id: 'test-id',
      } as unknown as AIPreset
      mockPresets.value.push(newPreset)
      return newPreset
    }),
    updatePreset: vi.fn((id, updates) => {
      const index = mockPresets.value.findIndex((p) => p.id === id)
      if (index !== -1) {
        mockPresets.value[index] = { ...mockPresets.value[index], ...updates }
        if (mockActivePresetId.value === id) {
          mockConfig.value = {
            discussionMode: false,
            discussionModelIds: [] as string[],
            discussionPrimaryModelId: null,
            ...mockPresets.value[index],
          } as unknown as AIConfig
        }
      }
    }),
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

    expect(wrapper.find('button.relative').text()).toContain('ai.basicSettings')
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
    ;(wrapper.vm as unknown as { activeTab: string }).activeTab = 'presets'
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
    expect(wrapper.find('.bg-primary\\/10').exists()).toBe(true) // 激活标签
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
    ;(wrapper.vm as unknown as { activeTab: string }).activeTab = 'settings'

    await wrapper.setProps({ modelValue: true })
    await nextTick()

    expect((wrapper.vm as unknown as { activeTab: string }).activeTab).toBe('presets')
  })

  it('should clear activePresetId when saving custom settings', async () => {
    mockActivePresetId.value = 'test-id'

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

    await nextTick()
    await wrapper.find('button.bg-primary').trigger('click') // 点击保存

    expect(mockActivePresetId.value).toBe(null)
  })

  it('should update config when updating the active preset', async () => {
    const { addPreset } = useAIConfig()
    const preset = addPreset({
      name: 'Old Name',
      baseUrl: 'https://old.com',
      apiKey: 'old-key',
      model: 'old-model',
      systemPrompt: 'Old prompt',
      temperature: 0.1,
      thinkingMode: 'disabled',
      todoAssistant: false,
    })

    mockActivePresetId.value = preset.id
    mockConfig.value = {
      baseUrl: preset.baseUrl,
      apiKey: preset.apiKey,
      model: preset.model,
      systemPrompt: preset.systemPrompt,
      temperature: preset.temperature,
      thinkingMode: preset.thinkingMode,
      todoAssistant: preset.todoAssistant,
      discussionMode: false,
      discussionModelIds: [],
      discussionPrimaryModelId: null,
    }

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

    // 进入编辑模式
    await wrapper.find('button[title="ai.edit"]').trigger('click')
    await nextTick()

    // 修改表单
    const nameInput = wrapper.find('input[placeholder="ai.presetNamePlaceholder"]')
    await nameInput.setValue('New Name')
    const modelInput = wrapper.find('input[placeholder="ai.modelPlaceholder"]')
    await modelInput.setValue('new-model')

    // 点击保存预设
    await wrapper.find('button.bg-primary').trigger('click')
    await nextTick()

    expect(mockPresets.value[0].model).toBe('new-model')
    // 验证 config 也被同步更新了 (由于 mockConfig 是 ref，且 useAIConfig 的 updatePreset 会修改它)
    expect(mockConfig.value.model).toBe('new-model')
  })
})
