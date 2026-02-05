import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import AISettingsDialog from '@/components/chat/AISettingsDialog.vue'
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
  Users: { template: '<span>Users</span>' },
  Star: { template: '<span>Star</span>' },
  Copy: { template: '<span>Copy</span>' },
  Edit3: { template: '<span>Edit3</span>' },
  Globe: { template: '<span>Globe</span>' },
  Key: { template: '<span>Key</span>' },
  Cpu: { template: '<span>Cpu</span>' },
  Thermometer: { template: '<span>Thermometer</span>' },
  MessageSquare: { template: '<span>MessageSquare</span>' },
  Info: { template: '<span>Info</span>' },
  Sparkles: { template: '<span>Sparkles</span>' },
  Download: { template: '<span>Download</span>' },
  Upload: { template: '<span>Upload</span>' },
  Search: { template: '<span>Search</span>' },
  Settings2: { template: '<span>Settings2</span>' },
}))

// Mock composables
const mockConfig = ref<AIConfig>({
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
  memoryModelId: null,
  enableImageGeneration: false,
})

const mockPresets = ref<AIPreset[]>([])
const mockActivePresetId = ref<string | null>(null)

const updateConfig = vi.fn((partial) => {
  mockConfig.value = { ...mockConfig.value, ...partial }
  mockActivePresetId.value = null
})

const switchPreset = vi.fn((id) => {
  const preset = mockPresets.value.find((p) => p.id === id)
  if (preset) {
    mockActivePresetId.value = id
    mockConfig.value = {
      discussionMode: false,
      discussionModelIds: [] as string[],
      discussionPrimaryModelId: null,
      memoryModelId: null,
      ...preset,
    } as unknown as AIConfig
  }
})

const addPreset = vi.fn((p) => {
  const newPreset: AIPreset = {
    discussionMode: false,
    discussionModelIds: [] as string[],
    discussionPrimaryModelId: null,
    memoryModelId: null,
    ...p,
    id: 'test-id',
  } as unknown as AIPreset
  mockPresets.value.push(newPreset)
  return newPreset
})

const updatePreset = vi.fn((id, updates) => {
  const index = mockPresets.value.findIndex((p) => p.id === id)
  if (index !== -1) {
    mockPresets.value[index] = { ...mockPresets.value[index], ...updates }
    if (mockActivePresetId.value === id) {
      mockConfig.value = {
        discussionMode: false,
        discussionModelIds: [] as string[],
        discussionPrimaryModelId: null,
        memoryModelId: null,
        ...mockPresets.value[index],
      } as unknown as AIConfig
    }
  }
})

const deletePreset = vi.fn((id) => {
  const index = mockPresets.value.findIndex((p) => p.id === id)
  if (index !== -1) {
    mockPresets.value.splice(index, 1)
    if (mockActivePresetId.value === id) {
      mockActivePresetId.value = null
    }
  }
})

const getPresetDefaults = vi.fn(() => ({
  baseUrl: 'https://api.example.com',
  apiKey: 'test-key',
  model: 'test-model',
  systemPrompt: 'test-prompt',
  temperature: 0.7,
  todoAssistant: false,
}))

vi.mock('@/composables/useAIConfig', () => ({
  useAIConfig: () => ({
    config: mockConfig,
    presets: mockPresets,
    activePresetId: mockActivePresetId,
    updateConfig,
    switchPreset,
    addPreset,
    updatePreset,
    deletePreset,
    getPresetDefaults,
    activePreset: { value: null },
  }),
}))

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
  createI18n: () => ({
    global: {
      t: (key: string) => key,
    },
    install: () => {},
  }),
}))

// Mock Sonner toast
vi.mock('vue-sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('AISettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockConfig.value = {
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
      memoryModelId: null,
      enableImageGeneration: false,
    }
    mockPresets.value = []
    mockActivePresetId.value = null
  })

  it('renders correctly when open', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          teleport: true,
          'transition-root': {
            template: '<div><slot /></div>',
          },
          'transition-child': {
            template: '<div><slot /></div>',
          },
        },
      },
    })

    expect(wrapper.find('.absolute').exists()).toBe(true)
    expect(wrapper.text()).toContain('ai.settings')
  })

  it('updates config when inputs change', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          teleport: true,
          'transition-root': {
            template: '<div><slot /></div>',
          },
          'transition-child': {
            template: '<div><slot /></div>',
          },
        },
      },
    })

    const modelInput = wrapper.find('input')
    await modelInput.setValue('new-model')
    await modelInput.trigger('blur')

    expect(updateConfig).toHaveBeenCalled()
  })

  it('does not close when backdrop is clicked', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          teleport: true,
          'transition-root': {
            template: '<div><slot /></div>',
          },
          'transition-child': {
            template: '<div><slot /></div>',
          },
        },
      },
    })

    await wrapper.find('.absolute.inset-0').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('switches tabs correctly', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
      },
      global: {
        stubs: {
          teleport: true,
          'transition-root': {
            template: '<div><slot /></div>',
          },
          'transition-child': {
            template: '<div><slot /></div>',
          },
        },
      },
    })

    const presetTab = wrapper
      .findAll('button')
      .find((b) => b.text().includes('ai.presetManagement'))
    await presetTab?.trigger('click')

    expect(wrapper.text()).toContain('ai.presetManagement')
    expect(wrapper.findComponent({ name: 'AIPresetManager' }).exists()).toBe(true)
  })

  it('auto-saves preset when closing in edit mode', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
        initialTab: 'presets',
      },
      global: {
        stubs: {
          teleport: true,
          'transition-root': {
            template: '<div><slot /></div>',
          },
          'transition-child': {
            template: '<div><slot /></div>',
          },
        },
      },
    })

    // 模拟进入编辑模式
    const presetManager = wrapper.findComponent({ ref: 'presetManagerRef' })
    const mockPreset: AIPreset = {
      id: '1',
      name: 'Test Preset',
      baseUrl: 'url',
      apiKey: 'key',
      model: 'model',
      systemPrompt: 'prompt',
      temperature: 0.7,
      todoAssistant: false,
    }

    // 手动调用子组件暴露的方法
    const vm = presetManager.vm as unknown as {
      startEditPreset: (p: AIPreset) => void
      editingPreset: AIPreset | null
    }
    await vm.startEditPreset(mockPreset)
    expect(vm.editingPreset).not.toBeNull()

    // 模拟关闭弹窗
    await (wrapper.vm as unknown as { handleClose: () => void }).handleClose()

    // 应该调用了 savePreset
    // 在我们的 Mock 中，savePreset 会调用 updatePreset
    expect(updatePreset).toHaveBeenCalled()
  })

  it('does not auto-save when closing in creation mode', async () => {
    const wrapper = mount(AISettingsDialog, {
      props: {
        modelValue: true,
        initialTab: 'presets',
      },
      global: {
        stubs: {
          teleport: true,
          'transition-root': {
            template: '<div><slot /></div>',
          },
          'transition-child': {
            template: '<div><slot /></div>',
          },
        },
      },
    })

    // 模拟进入创建模式
    const presetManager = wrapper.findComponent({ ref: 'presetManagerRef' })
    const vm = presetManager.vm as unknown as {
      startCreatePreset: () => void
      isCreatingPreset: boolean
    }
    await vm.startCreatePreset()
    expect(vm.isCreatingPreset).toBe(true)

    // 模拟关闭弹窗
    await (wrapper.vm as unknown as { handleClose: () => void }).handleClose()

    // 不应该调用 addPreset (即不自动保存)
    expect(addPreset).not.toHaveBeenCalled()
  })
})
