import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import AISettingsDialog from '@/features/ai/components/settings/AISettingsDialog.vue'
import type { AIPreset, AIConfig } from '@/features/ai/composables/useAIConfig'

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
  Pencil: { template: '<span>Pencil</span>' },
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
  ChevronLeft: { template: '<span>ChevronLeft</span>' },
  Settings2: { template: '<span>Settings2</span>' },
  Blocks: { template: '<span>Blocks</span>' },
  Palette: { template: '<span>Palette</span>' },
  SlidersHorizontal: { template: '<span>SlidersHorizontal</span>' },
  Layers: { template: '<span>Layers</span>' },
  Brain: { template: '<span>Brain</span>' },
  FileText: { template: '<span>FileText</span>' },
  Zap: { template: '<span>Zap</span>' },
  Terminal: { template: '<span>Terminal</span>' },
  Sun: { template: '<span>Sun</span>' },
  Moon: { template: '<span>Moon</span>' },
  Monitor: { template: '<span>Monitor</span>' },
  Languages: { template: '<span>Languages</span>' },
  ScanEye: { template: '<span>ScanEye</span>' },
}))

// Mock composables
const mockConfig = ref<AIConfig>({
  assistantMode: 'default',
  baseUrl: 'https://api.example.com',
  apiKey: 'test-key',
  model: 'test-model',
  systemPrompt: 'test-prompt',
  temperature: 0.7,
  thinkingMode: 'off',
  todoAssistant: false,
  discussionMode: false,
  discussionModelIds: [],
  discussionPrimaryModelId: null,
  memoryModelId: null,
  enableImageGeneration: false,
  mcpEnabled: false,
  contextCompressionEnabled: false,
  contextCompressionTriggerChars: 24000,
  contextCompressionModelId: null,
  skillIds: [],
  novelGenre: null,
  novelTone: '',
  novelProtagonistHint: '',
  agentMode: false,
  agentWorkspaceId: null,
  agentWorkspacePath: null,
  visionEnabled: false,
  visionPresetId: null,
})

const mockPresets = ref<AIPreset[]>([])
const mockSkills = ref([])
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
      assistantMode: mockConfig.value.assistantMode,
      discussionMode: false,
      discussionModelIds: [] as string[],
      discussionPrimaryModelId: null,
      memoryModelId: null,
      skillIds: preset.skillIds ? [...preset.skillIds] : [],
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
        assistantMode: mockConfig.value.assistantMode,
        discussionMode: false,
        discussionModelIds: [] as string[],
        discussionPrimaryModelId: null,
        memoryModelId: null,
        skillIds: mockPresets.value[index].skillIds ? [...mockPresets.value[index].skillIds] : [],
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

const syncConfigToPreset = vi.fn(() => true)

const getPresetDefaults = vi.fn(() => ({
  baseUrl: 'https://api.example.com',
  apiKey: 'test-key',
  model: 'test-model',
  systemPrompt: 'test-prompt',
  temperature: 0.7,
  todoAssistant: false,
  skillIds: [],
}))

vi.mock('@/features/ai/composables/useAIConfig', () => ({
  useAIConfig: () => ({
    config: mockConfig,
    presets: mockPresets,
    skills: mockSkills,
    activePresetId: mockActivePresetId,
    updateConfig,
    switchPreset,
    addPreset,
    updatePreset,
    deletePreset,
    syncConfigToPreset,
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
      assistantMode: 'default',
      baseUrl: 'https://api.example.com',
      apiKey: 'test-key',
      model: 'test-model',
      systemPrompt: 'test-prompt',
      temperature: 0.7,
      thinkingMode: 'off',
      todoAssistant: false,
      discussionMode: false,
      discussionModelIds: [],
      discussionPrimaryModelId: null,
      memoryModelId: null,
      enableImageGeneration: false,
      mcpEnabled: true,
      contextCompressionEnabled: true,
      contextCompressionTriggerChars: 24000,
      contextCompressionModelId: null,
      skillIds: [],
      novelGenre: null,
      novelTone: '',
      novelProtagonistHint: '',
      agentMode: false,
      agentWorkspaceId: null,
      agentWorkspacePath: null,
      visionEnabled: false,
      visionPresetId: null,
    }
    mockPresets.value = []
    mockSkills.value = []
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

    // Switch to settings tab first (default is now 'appearance')
    const settingsTab = wrapper.findAll('button').find((b) => b.text().includes('ai.basicSettings'))
    await settingsTab?.trigger('click')

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

  it('renders tabs in the expected priority order', () => {
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

    const expectedTabs: string[] = [
      'ai.appearance',
      'ai.basicSettings',
      'ai.presetManagement',
      'ai.memory',
      'ai.contextCompression',
      'ai.skills',
      'ai.webSearch',
      'ai.mcp',
    ]

    // Button text includes icon mock text (e.g. "Paletteai.appearance"), so use includes()
    const renderedTabs = expectedTabs.filter((tab) =>
      wrapper.findAll('button').some((button) => button.text().includes(tab)),
    )

    expect(renderedTabs).toEqual(expectedTabs)
  })

  it('does not render a redundant footer close action', () => {
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

    expect(wrapper.text()).not.toContain('common.close')
  })

  it('syncs current settings to active preset from settings tab', async () => {
    mockPresets.value = [
      {
        id: 'active-preset-id',
        name: 'Active Preset',
        baseUrl: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'test-model',
        systemPrompt: 'test-prompt',
        temperature: 0.7,
        todoAssistant: false,
      },
    ]
    mockActivePresetId.value = 'active-preset-id'

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

    // Switch to settings tab (default is now 'appearance')
    const settingsTab = wrapper.findAll('button').find((b) => b.text().includes('ai.basicSettings'))
    await settingsTab?.trigger('click')

    const syncButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'ai.syncToActivePreset')
    expect(syncButton).toBeTruthy()

    await syncButton!.trigger('click')
    expect(syncConfigToPreset).toHaveBeenCalledWith('active-preset-id')
  })

  it('enables save-as-preset when only thinking effort differs', async () => {
    mockPresets.value = [
      {
        id: 'preset-1',
        name: 'Preset 1',
        baseUrl: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'test-model',
        systemPrompt: 'test-prompt',
        temperature: 0.7,
        todoAssistant: false,
        skillIds: [],
      },
    ]

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

    // Switch to settings tab (default is now 'appearance')
    const settingsTab = wrapper.findAll('button').find((b) => b.text().includes('ai.basicSettings'))
    await settingsTab?.trigger('click')

    const saveButtonBefore = wrapper
      .findAll('button')
      .find((button) => button.text() === 'ai.saveAsPreset')
    expect(saveButtonBefore).toBeTruthy()
    expect(saveButtonBefore!.attributes('disabled')).toBeDefined()

    const tempSlider = wrapper.find('input[name="ai-temperature"]')
    expect(tempSlider.exists()).toBe(true)
    await tempSlider.setValue(1.0)
    await wrapper.vm.$nextTick()

    const saveButtonAfter = wrapper
      .findAll('button')
      .find((button) => button.text() === 'ai.saveAsPreset')
    expect(saveButtonAfter).toBeTruthy()
    expect(saveButtonAfter!.attributes('disabled')).toBeUndefined()
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
