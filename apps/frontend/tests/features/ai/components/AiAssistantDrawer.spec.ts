import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import AiAssistantDrawer from '@/features/ai/components/assistant/AiAssistantDrawer.vue'
import type { ChatMessage } from '@/features/ai/services/aiService'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import AiAssistantToolbar from '@/features/ai/components/assistant/AiAssistantToolbar.vue'

// ============================================================================
// SHARED MOCK SETUP
// ============================================================================
// Notes:
// - AiAssistantToolbar, AiAssistantInput, AiAssistantHeader, LeftSessionSidebar
//   are NOT mocked here — their real implementations handle conditional
//   rendering (previousSession/stop buttons, textarea) that tests depend on.
// - learn more at AGENTS.md §3.3 and AGENTS.md §10.

// --- Mock Lucide icons ---
vi.mock('lucide-vue-next', () => {
  const icons = [
    'AlertCircle',
    'Snowflake',
    'Clover',
    'Plus',
    'X',
    'Maximize2',
    'Minimize2',
    'Send',
    'Lightbulb',
    'GraduationCap',
    'Settings2',
    'ChevronDown',
    'ChevronLeft',
    'Square',
    'RefreshCw',
    'Trash2',
    'History',
    'Check',
    'CheckSquare',
    'Users',
    'MessageSquare',
    'Sparkles',
    'ArrowLeft',
    'ArrowRight',
    'Paperclip',
    'FolderTree',
    'ListTodo',
    'Bot',
    'ClipboardPaste',
    'User',
    'Image',
    'Blocks',
    'LayoutGrid',
    'Presentation',
    'BookOpen',
    'Languages',
    'PanelLeftClose',
    'PanelLeftOpen',
    'PanelRightClose',
    'PanelRightOpen',
    'Pin',
    'PinOff',
    'Pencil',
    'FileDown',
    'Search',
  ]
  const mockIcons: Record<string, { template: string }> = {}
  icons.forEach((icon) => {
    mockIcons[icon] = { template: `<span>${icon}</span>` }
  })
  return mockIcons
})

// --- Mock child components (non-toolbar/input) ---
vi.mock('@/components/ResizableDrawer.vue', () => ({
  default: {
    template: '<div><slot /></div>',
    props: ['modelValue'],
  },
}))

// ChatMessageList: includes teaching-submit emit used by Teaching Answer tests
vi.mock('@/features/ai/components/chat/ChatMessageList.vue', () => ({
  default: {
    template:
      "<div>ChatMessageList<button data-test=\"teaching-submit\" @click=\"$emit('teaching-submit', { quizId: 'q1', kind: 'single_choice', answer: 'A' })\">teach</button></div>",
    emits: ['teaching-submit'],
  },
}))

vi.mock('@/features/ai/components/settings/AISettingsDialog.vue', () => ({
  default: {
    name: 'AISettingsDialog',
    template: '<div>AISettingsDialog</div>',
    props: ['modelValue', 'initialTab'],
  },
}))

vi.mock('@/features/ai/components/RightWorkspacePanel.vue', () => ({
  default: {
    template: '<div>RightWorkspacePanel</div>',
    props: ['workspacePath', 'sidecarPort', 'sidecarToken', 'collapsed', 'showAgentTabs'],
  },
}))

vi.mock('@/features/todo/components/TodoPanelDialog.vue', () => ({
  default: { template: '<div>TodoPanelDialog</div>' },
}))

// --- Shared refs for composable mocks ---
const mockSessions = ref<ChatSession[]>([])
const mockCurrentSessionId = ref<string | null>(null)
const mockLastActiveSession = ref<ChatSession | null>(null)
const mockMessages = ref<ChatMessage[]>([])
const mockIsGenerating = ref(false)
const mockSendMessage = vi.fn()
const mockUpdateTeachingQuizAnswer = vi.fn()
const mockGetTeachingQuizSnapshot = vi.fn()

vi.mock('@/features/ai/composables/useChatHistory', () => ({
  useChatHistory: () => ({
    sessions: mockSessions,
    currentSessionId: mockCurrentSessionId,
    lastActiveSession: mockLastActiveSession,
    switchSession: vi.fn((id) => {
      mockCurrentSessionId.value = id
    }),
    createSession: vi.fn(),
  }),
}))

vi.mock('@/features/ai/composables/useChat', () => ({
  useChat: () => ({
    messages: mockMessages,
    isGenerating: mockIsGenerating,
    error: ref(null),
    sendMessage: mockSendMessage,
    stopGenerating: vi.fn(),
    clearHistory: vi.fn(),
    regenerateLastResponse: vi.fn(),
    regenerateMessage: vi.fn(),
    deleteMessage: vi.fn(),
    editAndResendMessage: vi.fn(),
    updateTeachingQuizAnswer: mockUpdateTeachingQuizAnswer,
    getTeachingQuizSnapshot: mockGetTeachingQuizSnapshot,
  }),
}))

const mockUpdateConfig = vi.fn()
const mockConfig = ref({
  assistantMode: 'default',
  baseUrl: '',
  apiKey: '',
  model: '',
  systemPrompt: '',
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
  aiThinkingLevel: ref('off'),
  saveAIThinkingLevel: vi.fn(),
}))

// --- Other shared mocks ---
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

// --- Mock FileReader (needed by Paste tests) ---
class MockFileReader {
  onload: ((e: { target: { result: string } }) => void) | null = null
  readAsDataURL(_file: File) {
    setTimeout(() => {
      if (this.onload) {
        this.onload({
          target: {
            result: 'data:image/png;base64,mock-data',
          },
        })
      }
    }, 0)
  }
}
vi.stubGlobal('FileReader', MockFileReader)

// ============================================================================
// NAVIGATION AND BUTTON STATES
// ============================================================================

describe('AiAssistantDrawer - Navigation and Button States', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockSessions.value = []
    mockCurrentSessionId.value = null
    mockMessages.value = []
    mockIsGenerating.value = false
    mockConfig.value.todoAssistant = false
    mockConfig.value.discussionMode = false
    vi.clearAllMocks()
  })

  it('should not auto-focus input when drawer is opened', async () => {
    const focusSpy = vi
      .spyOn(HTMLTextAreaElement.prototype, 'focus')
      .mockImplementation(() => undefined)

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: false },
    })

    await wrapper.setProps({ modelValue: true })
    await nextTick()

    expect(focusSpy).not.toHaveBeenCalled()
    focusSpy.mockRestore()
  })

  it('should always keep "New Chat" button enabled', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const newChatBtn = wrapper.findAll('button').find((b) => b.text().includes('ai.newChat'))
    expect(newChatBtn?.attributes('disabled')).toBeUndefined()
  })

  it('should enable "New Chat" button when there is chat history', async () => {
    mockMessages.value = [{ id: '1', role: 'user', content: 'test' }]

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const newChatBtn = wrapper.findAll('button').find((b) => b.text().includes('ai.newChat'))
    expect(newChatBtn?.attributes('disabled')).toBeUndefined()
  })

  it('should NOT disable "New Chat" button when generating', async () => {
    mockMessages.value = [{ id: '1', role: 'user', content: 'test' }]
    mockIsGenerating.value = true

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const newChatBtn = wrapper.findAll('button').find((b) => b.text().includes('ai.newChat'))
    expect(newChatBtn?.attributes('disabled')).toBeUndefined()
  })

  it('should show "Previous Session" button regardless of session count but disabled if no last active session', async () => {
    mockSessions.value = [
      { id: '1', title: 'Session 1', messages: [], createdAt: new Date(), updatedAt: new Date() },
    ]
    mockCurrentSessionId.value = '1'
    mockLastActiveSession.value = null

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const prevBtn = wrapper.find('button[title="ai.previousSession"]')
    expect(prevBtn.exists()).toBe(true)
    expect(prevBtn.attributes('disabled')).toBeDefined()
  })

  it('should enable "Previous Session" button when there is a last active session', async () => {
    mockSessions.value = [
      { id: '2', title: 'Session 2', messages: [], createdAt: new Date(), updatedAt: new Date() },
      { id: '1', title: 'Session 1', messages: [], createdAt: new Date(), updatedAt: new Date() },
    ]
    mockCurrentSessionId.value = '2'
    mockLastActiveSession.value = mockSessions.value[1] // Session 1

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const prevBtn = wrapper.find('button[title="ai.previousSession"]')
    expect(prevBtn.exists()).toBe(true)
    expect(prevBtn.attributes('disabled')).toBeUndefined()
  })

  it('should not render "Previous Session" button when generating', async () => {
    mockSessions.value = [
      { id: '2', title: 'Session 2', messages: [], createdAt: new Date(), updatedAt: new Date() },
      { id: '1', title: 'Session 1', messages: [], createdAt: new Date(), updatedAt: new Date() },
    ]
    mockCurrentSessionId.value = '2'
    mockLastActiveSession.value = mockSessions.value[1]
    mockIsGenerating.value = true

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const prevBtn = wrapper.find('button[title="ai.previousSession"]')
    expect(prevBtn.exists()).toBe(false)

    const stopBtn = wrapper.find('button[title="ai.stop"]')
    expect(stopBtn.exists()).toBe(true)
  })

  it('should reset todo assistant when "New Chat" button is clicked', async () => {
    mockMessages.value = [{ id: '1', role: 'user', content: 'test' }]
    mockConfig.value.todoAssistant = true
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const newChatBtn = wrapper.findAll('button').find((b) => b.text().includes('ai.newChat'))
    await newChatBtn?.trigger('click')

    expect(mockUpdateConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        todoAssistant: false,
      }),
    )
  })
})

// ============================================================================
// TEACHING ANSWER
// ============================================================================

describe('AiAssistantDrawer - Teaching Answer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockMessages.value = []
    mockIsGenerating.value = false
    vi.clearAllMocks()
  })

  it('should include quiz snapshot in teaching answer message', async () => {
    mockMessages.value = [
      {
        id: 'a1',
        role: 'assistant',
        content: 'x',
        teachingQuizzes: [
          {
            id: 'q1',
            kind: 'single_choice',
            stem: 'Q1?',
            options: [
              { id: 'A', text: 'Option A' },
              { id: 'B', text: 'Option B' },
            ],
            answerHint: 'Pick one',
          },
        ],
      },
    ]

    mockGetTeachingQuizSnapshot.mockReturnValue({
      id: 'q1',
      kind: 'single_choice',
      stem: 'Q1?',
      options: [
        { id: 'A', text: 'Option A' },
        { id: 'B', text: 'Option B' },
      ],
      answerHint: 'Pick one',
    })

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    await wrapper.find('[data-test="teaching-submit"]').trigger('click')

    expect(mockUpdateTeachingQuizAnswer).toHaveBeenCalledWith('q1', 'A')
    expect(mockSendMessage).toHaveBeenCalledTimes(1)
    const arg = mockSendMessage.mock.calls[0][0] as string
    expect(arg.startsWith('[TEACHING_ANSWER]\n')).toBe(true)
    const jsonStr = arg.split('\n')[1]
    const parsed = JSON.parse(jsonStr) as { quiz?: { stem: string } }
    expect(parsed.quiz?.stem).toBe('Q1?')
  })
})

// ============================================================================
// HOVER INTERACTIONS
// ============================================================================

describe('AiAssistantDrawer - Hover Interactions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockMessages.value = []
    mockIsGenerating.value = false
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should handle hover events for preset dropdown', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const presetContainer = wrapper.findAll('div.relative').find((div) => {
      return div.text().includes('ai.custom')
    })

    expect(presetContainer).toBeDefined()

    await presetContainer?.trigger('mouseenter')
    await nextTick()
  })
})

// ============================================================================
// CLIPBOARD PASTE
// ============================================================================

describe('AiAssistantDrawer - Paste', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should add image when pasting from clipboard', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const textarea = wrapper.find('textarea')

    // Create a mock ClipboardEvent
    const mockFile = new File([''], 'test.png', { type: 'image/png' })
    const mockClipboardData = {
      items: [
        {
          kind: 'file',
          type: 'image/png',
          getAsFile: () => mockFile,
        },
      ],
    }

    // Trigger paste event
    await textarea.trigger('paste', {
      clipboardData: mockClipboardData,
    })

    // Wait for FileReader and nextTick
    await new Promise((resolve) => setTimeout(resolve, 50))
    await nextTick()

    // Check if image preview is rendered
    const images = wrapper.findAll('img')
    expect(images.length).toBe(1)
    expect(images[0].attributes('src')).toBe('data:image/png;base64,mock-data')
  })

  it('should not add more than 10 images', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const textarea = wrapper.find('textarea')
    const mockFile = new File([''], 'test.png', { type: 'image/png' })
    const mockClipboardData = {
      items: Array(12).fill({
        kind: 'file',
        type: 'image/png',
        getAsFile: () => mockFile,
      }),
    }

    await textarea.trigger('paste', {
      clipboardData: mockClipboardData,
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
    await nextTick()

    const images = wrapper.findAll('img')
    expect(images.length).toBe(10)
  })
})

// ============================================================================
// MODE EXCLUSIVITY
// ============================================================================

describe('AiAssistantDrawer - Mode Exclusivity', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockMessages.value = []
    mockIsGenerating.value = false
    mockConfig.value = {
      assistantMode: 'default',
      baseUrl: '',
      apiKey: '',
      model: '',
      temperature: 0.7,
      systemPrompt: '',
      thinkingMode: 'off',
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
    mockConfig.value.assistantMode = 'default'
    mockConfig.value.todoAssistant = true
    mockConfig.value.discussionMode = true
    mockConfig.value.enableImageGeneration = true

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

    mockConfig.value.assistantMode = 'teaching'
    mockConfig.value.todoAssistant = false

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

    mockConfig.value.assistantMode = 'teaching'
    mockConfig.value.discussionMode = false

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

    mockConfig.value.assistantMode = 'teaching'
    mockConfig.value.enableImageGeneration = false

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
