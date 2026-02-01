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
  mockPresets.value = mockPresets.value.filter((p) => p.id !== id)
  if (mockActivePresetId.value === id) {
    mockActivePresetId.value = null
  }
})

const duplicatePreset = vi.fn((id) => {
  const preset = mockPresets.value.find((p) => p.id === id)
  if (preset) {
    const duplicated = { ...preset, id: 'duplicated-id', name: `${preset.name} - 副本` }
    mockPresets.value.push(duplicated)
    return duplicated
  }
  return null
})

const getPresetDefaults = vi.fn(() => ({
  baseUrl: '',
  apiKey: '',
  model: '',
  systemPrompt: '',
  temperature: 0.7,
  thinkingMode: 'disabled',
  todoAssistant: false,
}))

vi.mock('@/composables/useAIConfig', () => ({
  useAIConfig: () => ({
    config: mockConfig,
    updateConfig,
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
      memoryModelId: null,
      enableImageGeneration: false,
    },
    presets: mockPresets,
    activePresetId: mockActivePresetId,
    switchPreset,
    addPreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
    getPresetDefaults,
  }),
}))

vi.mock('@/composables/useMemory', () => ({
  useMemory: () => ({
    memories: ref([]),
    isMemoryEnabled: ref(false),
    autoCompressThreshold: ref(30),
    isCompressing: ref(false),
    lastError: ref(null),
    addMemory: vi.fn(),
    addMemories: vi.fn(),
    removeMemory: vi.fn(),
    updateMemory: vi.fn(),
    clearMemories: vi.fn(),
    toggleMemory: vi.fn(),
    compressMemories: vi.fn(),
    updateAutoCompressThreshold: vi.fn(),
    getMemoryModelOptions: vi.fn(),
  }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('@/composables/useGsap', () => ({
  useGsap: () => ({
    gsap: {
      from: vi.fn(),
      to: vi.fn(),
      set: vi.fn(),
      utils: {
        toArray: vi.fn(() => []),
      },
      timeline: vi.fn(() => ({
        from: vi.fn().mockReturnThis(),
        to: vi.fn().mockReturnThis(),
      })),
    },
    ctx: {
      add: (fn: () => void) => fn(),
      revert: vi.fn(),
    },
  }),
}))

describe('AISettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPresets.value = []
    mockActivePresetId.value = null
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

    expect(wrapper.find('button.group.relative').text()).toContain('ai.basicSettings')
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
    expect(wrapper.find('.bg-primary\\/5').exists()).toBe(true) // 激活标签
  })

  it('should toggle discussion mode and show model selection', async () => {
    const { addPreset } = useAIConfig()
    addPreset({
      name: 'Model 1',
      baseUrl: 'https://api.test.com',
      apiKey: 'test-key',
      model: 'm1',
      systemPrompt: 'p1',
      temperature: 0.5,
      todoAssistant: false,
    })

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

    // 初始状态：未开启讨论模式
    expect(wrapper.find('input[type="range"]').exists()).toBe(true) // 温度选择器（基础设置）

    // 开启讨论模式
    const toggleBtn = wrapper.find('.inline-flex.h-6.w-11')
    await toggleBtn.trigger('click')
    await nextTick()

    expect((wrapper.vm as unknown as { formData: AIConfig }).formData.discussionMode).toBe(true)
    expect(wrapper.find('input[type="range"]').exists()).toBe(false) // 基础设置被隐藏

    // 验证预设列表显示
    const presetButtons = wrapper.findAll('.rounded-full.border')
    // 每个预设会显示在主模型和副模型两个列表中
    expect(presetButtons.length).toBe(2)
    expect(presetButtons[0].text()).toContain('Model 1')

    // 选择主模型
    await presetButtons[0].trigger('click')
    expect(
      (wrapper.vm as unknown as { formData: AIConfig }).formData.discussionPrimaryModelId,
    ).toBe('test-id')

    // 选择副模型
    await presetButtons[1].trigger('click')
    expect((wrapper.vm as unknown as { formData: AIConfig }).formData.discussionModelIds).toContain(
      'test-id',
    )
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

  it('should auto-save config when form changes', async () => {
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

    // 修改基础设置中的模型
    const modelInput = wrapper.find('input[name="ai-model"]')
    await modelInput.setValue('auto-save-model')

    // 等待异步 watcher 触发
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(updateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'auto-save-model',
      }),
    )
  })

  it('should clear activePresetId when settings deviate from preset', async () => {
    mockActivePresetId.value = 'test-id'
    mockPresets.value = [
      {
        id: 'test-id',
        name: 'Test Preset',
        baseUrl: 'https://api.example.com',
        apiKey: 'test-key',
        model: 'test-model',
        systemPrompt: 'test-prompt',
        temperature: 0.7,
        todoAssistant: false,
      },
    ]

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

    // 修改模型，触发自动保存并导致预设不匹配
    const modelInput = wrapper.find('input[name="ai-model"]')
    await modelInput.setValue('new-model')

    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // 验证 activePresetId 被清除 (由 useAIConfig 的 watcher 处理)
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
      todoAssistant: false,
    })

    mockActivePresetId.value = preset.id
    mockConfig.value = {
      baseUrl: preset.baseUrl,
      apiKey: preset.apiKey,
      model: preset.model,
      systemPrompt: preset.systemPrompt,
      temperature: preset.temperature,
      thinkingMode: 'disabled',
      todoAssistant: preset.todoAssistant,
      discussionMode: false,
      discussionModelIds: [],
      discussionPrimaryModelId: null,
      memoryModelId: null,
      enableImageGeneration: false,
    }
  })

  it('should update a preset when edit is saved', async () => {
    mockPresets.value = [
      {
        id: '1',
        name: 'Original',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-123',
        model: 'gpt-4',
        systemPrompt: 'You are helpful',
        temperature: 0.5,
        todoAssistant: false,
      },
    ]
    mockActivePresetId.value = '1'

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

    // 点击保存预设 (AIPresetManager 内部的保存按钮)
    await wrapper.find('button.bg-primary').trigger('click')
    await nextTick()

    expect(mockPresets.value[0].model).toBe('new-model')
    // 验证 config 也被同步更新了 (由于 mockConfig 是 ref，且 useAIConfig 的 updatePreset 会修改它)
    expect(mockConfig.value.model).toBe('new-model')
  })

  it('should duplicate a preset when duplicate button is clicked', async () => {
    mockPresets.value = [
      {
        id: '1',
        name: 'Preset 1',
        baseUrl: 'url',
        apiKey: 'key',
        model: 'model',
        systemPrompt: 'prompt',
        temperature: 0.7,
        todoAssistant: false,
      },
    ]

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

    const { duplicatePreset } = useAIConfig()
    const duplicateBtn = wrapper.find('button[title="ai.copyPreset"]')
    await duplicateBtn.trigger('click')

    expect(duplicatePreset).toHaveBeenCalledWith('1')
  })

  it('should show name prompt and add preset when "Save as Preset" is confirmed', async () => {
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

    // 修改基础设置中的模型
    const modelInput = wrapper.find('input[placeholder="ai.modelPlaceholder"]')
    await modelInput.setValue('special-model')

    // 查找并点击 "保存为预设" 按钮
    const saveAsPresetBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('ai.saveAsPreset'))
    expect(saveAsPresetBtn).toBeTruthy()
    await saveAsPresetBtn?.trigger('click')
    await nextTick()

    // 验证显示了名称输入弹窗 (通过内部状态验证，因为 AlertDialog 可能比较难在单元测试中直接查找组件)
    expect(
      (wrapper.vm as unknown as { showSaveAsPresetConfirm: boolean }).showSaveAsPresetConfirm,
    ).toBe(true)

    // 输入预设名称
    ;(wrapper.vm as unknown as { saveAsPresetName: string }).saveAsPresetName = 'My New Preset'

    // 确认保存
    await (
      wrapper.vm as unknown as { confirmSaveAsPreset: () => Promise<void> }
    ).confirmSaveAsPreset()
    await nextTick()

    // 验证 Tab 切换到了预设管理
    expect((wrapper.vm as unknown as { activeTab: string }).activeTab).toBe('presets')
    // 验证 addPreset 被调用
    expect(addPreset).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My New Preset',
        model: 'special-model',
      }),
    )
  })

  it('should disable "Save as Preset" button when configuration matches an existing preset', async () => {
    // 设置基础配置
    mockConfig.value = {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-123',
      model: 'gpt-4',
      systemPrompt: 'You are helpful',
      temperature: 0.5,
      thinkingMode: 'disabled',
      todoAssistant: false,
      discussionMode: false,
      discussionModelIds: [],
      discussionPrimaryModelId: null,
      memoryModelId: null,
      enableImageGeneration: false,
    }

    // 模拟已存在一个预设，配置与当前配置相同
    mockPresets.value = [
      {
        id: '1',
        name: 'My Preset',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-123',
        model: 'gpt-4',
        systemPrompt: 'You are helpful',
        temperature: 0.5,
        todoAssistant: false,
      },
    ]

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

    // 检查按钮是否被禁用
    const saveAsPresetBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('ai.saveAsPreset'))
    expect(saveAsPresetBtn?.element.disabled).toBe(true)

    // 修改模型名称，按钮应该变为可用
    const modelInput = wrapper.find('input[placeholder="ai.modelPlaceholder"]')
    await modelInput.setValue('gpt-4o')
    await nextTick()

    expect(saveAsPresetBtn?.element.disabled).toBe(false)
  })
})
