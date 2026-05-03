import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import AiAssistantDrawer from '@/features/ai/components/AiAssistantDrawer.vue'
import AiAssistantToolbar from '@/features/ai/components/AiAssistantToolbar.vue'

// Mock Lucide icons
vi.mock('lucide-vue-next', () => {
  return {
    X: { template: '<span>X</span>' },
    Maximize2: { template: '<span>Maximize2</span>' },
    Minimize2: { template: '<span>Minimize2</span>' },
    GraduationCap: { template: '<span>GraduationCap</span>' },
  }
})

// Mock components
vi.mock('@/components/ResizableDrawer.vue', () => ({
  default: {
    template: '<div><slot /></div>',
    props: ['modelValue'],
  },
}))
vi.mock('@/features/ai/components/ChatMessageList.vue', () => ({
  default: { template: '<div>ChatMessageList</div>' },
}))
vi.mock('@/features/ai/components/AISettingsDialog.vue', () => ({
  default: { template: '<div>AISettingsDialog</div>' },
}))
vi.mock('@/features/ai/components/ChatHistoryPanel.vue', () => ({
  default: { template: '<div>ChatHistoryPanel</div>' },
}))
vi.mock('@/features/ai/components/AiAssistantHeader.vue', () => ({
  default: { template: '<div>AiAssistantHeader</div>' },
}))
// 重要：我们需要找到这个组件来触发事件
vi.mock('@/features/ai/components/AiAssistantToolbar.vue', () => ({
  default: {
    template: '<div>AiAssistantToolbar</div>',
    emits: ['toggle-teaching', 'toggle-todo', 'toggle-discussion', 'toggle-image-gen'],
  },
}))
vi.mock('@/features/ai/components/AiAssistantInput.vue', () => ({
  default: {
    template: '<div>AiAssistantInput</div>',
    methods: {
      adjustHeight: vi.fn(),
    },
  },
}))

// Mock composables
const mockMessages = ref([])
const mockIsGenerating = ref(false)

vi.mock('@/features/ai/composables/useChatHistory', () => ({
  useChatHistory: () => ({
    sessions: ref([]),
    currentSessionId: ref(null),
    lastActiveSession: ref(null),
    switchSession: vi.fn(),
    createSession: vi.fn(),
  }),
}))

vi.mock('@/features/ai/composables/useChat', () => ({
  useChat: () => ({
    messages: mockMessages,
    isGenerating: mockIsGenerating,
    error: ref(null),
    sendMessage: vi.fn(),
    stopGenerating: vi.fn(),
    clearHistory: vi.fn(),
    regenerateLastResponse: vi.fn(),
    editAndResendMessage: vi.fn(),
    updateTeachingQuizAnswer: vi.fn(),
    getTeachingQuizSnapshot: vi.fn(),
  }),
}))

const mockUpdateConfig = vi.fn()
const mockConfig = ref({
  assistantMode: 'default',
  baseUrl: '',
  apiKey: '',
  model: '',
  temperature: 0.7,
  systemPrompt: '',
  thinkingMode: 'disabled',
  thinkingEffort: 'high',
  todoAssistant: false,
  discussionMode: false,
  enableImageGeneration: false,
  discussionModelIds: [],
  discussionPrimaryModelId: null,
  memoryModelId: null,
  mcpEnabled: false,
  contextCompressionEnabled: false,
  contextCompressionTriggerChars: 24000,
  contextCompressionModelId: null,
  skillIds: [],
})

vi.mock('@/features/ai/composables/useAIConfig', () => ({
  useAIConfig: () => ({
    presets: ref([]),
    skills: ref([]),
    activePreset: ref(null),
    switchPreset: vi.fn(),
    config: mockConfig,
    updateConfig: mockUpdateConfig,
  }),
  aiThinkingMode: ref('disabled'),
  saveAIThinkingMode: vi.fn(),
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

vi.mock('@/composables/useFileParsing', () => ({
  useFileParsing: () => ({
    parsedFiles: ref([]),
    parseFile: vi.fn(),
    removeFile: vi.fn(),
    clearFiles: vi.fn(),
  }),
}))

vi.mock('@/features/todo/stores/todo', () => ({
  useTodoStore: () => ({
    isMaximized: false,
    setMaximized: vi.fn(),
  }),
}))

describe('AiAssistantDrawer Mode Exclusivity', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockMessages.value = []
    mockIsGenerating.value = false
    // Reset config
    mockConfig.value = {
      assistantMode: 'default',
      baseUrl: '',
      apiKey: '',
      model: '',
      temperature: 0.7,
      systemPrompt: '',
      thinkingMode: 'disabled',
      thinkingEffort: 'high',
      todoAssistant: false,
      discussionMode: false,
      enableImageGeneration: false,
      discussionModelIds: [],
      discussionPrimaryModelId: null,
      memoryModelId: null,
      mcpEnabled: false,
      contextCompressionEnabled: false,
      contextCompressionTriggerChars: 24000,
      contextCompressionModelId: null,
      skillIds: [],
    }
    vi.clearAllMocks()
  })

  it('should disable other modes when Teaching Mode is enabled', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const toolbarComponent = wrapper.findComponent(AiAssistantToolbar)
    expect(toolbarComponent.exists()).toBe(true)

    // Pre-condition: set other modes to true to verify they get turned off
    mockConfig.value.assistantMode = 'default' // Initially default
    mockConfig.value.todoAssistant = true
    mockConfig.value.discussionMode = true
    mockConfig.value.enableImageGeneration = true

    // Trigger toggle-teaching
    await toolbarComponent.vm.$emit('toggle-teaching')

    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        assistantMode: 'teaching',
        todoAssistant: false,
        discussionMode: false,
        enableImageGeneration: false,
      }),
    )
  })

  it('should disable Teaching Mode when Todo Assistant is enabled', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })
    const toolbarComponent = wrapper.findComponent(AiAssistantToolbar)

    // Pre-condition: Teaching mode is enabled
    mockConfig.value.assistantMode = 'teaching'
    mockConfig.value.todoAssistant = false

    // Trigger toggle-todo
    await toolbarComponent.vm.$emit('toggle-todo')

    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        todoAssistant: true,
        assistantMode: 'default',
        discussionMode: false,
        enableImageGeneration: false,
      }),
    )
  })

  it('should disable Teaching Mode when Discussion Mode is enabled', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })
    const toolbarComponent = wrapper.findComponent(AiAssistantToolbar)

    // Pre-condition: Teaching mode is enabled
    mockConfig.value.assistantMode = 'teaching'
    mockConfig.value.discussionMode = false

    // Trigger toggle-discussion
    await toolbarComponent.vm.$emit('toggle-discussion')

    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        discussionMode: true,
        assistantMode: 'default',
        todoAssistant: false,
        enableImageGeneration: false,
      }),
    )
  })

  it('should disable Teaching Mode when Image Generation is enabled', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })
    const toolbarComponent = wrapper.findComponent(AiAssistantToolbar)

    // Pre-condition: Teaching mode is enabled
    mockConfig.value.assistantMode = 'teaching'
    mockConfig.value.enableImageGeneration = false

    // Trigger toggle-image-gen
    await toolbarComponent.vm.$emit('toggle-image-gen')

    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        enableImageGeneration: true,
        assistantMode: 'default',
        todoAssistant: false,
        discussionMode: false,
      }),
    )
  })
})
