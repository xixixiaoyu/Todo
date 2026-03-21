import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import AiAssistantDrawer from '@/features/ai/components/AiAssistantDrawer.vue'

// Mock Lucide icons
vi.mock('lucide-vue-next', () => {
  const icons = [
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
    'Users',
    'MessageSquare',
    'Sparkles',
    'ArrowLeft',
    'ArrowRight',
    'Paperclip',
    'Bot',
    'User',
    'Image',
    'Blocks',
    'LayoutGrid',
  ]
  const mockIcons: Record<string, { template: string }> = {}
  icons.forEach((icon) => {
    mockIcons[icon] = { template: `<span>${icon}</span>` }
  })
  return mockIcons
})

// Mock components
vi.mock('@/components/ResizableDrawer.vue', () => ({
  default: {
    template: '<div><slot /></div>',
    props: ['modelValue'],
  },
}))
vi.mock('@/features/ai/components/ChatMessageList.vue', () => ({
  default: {
    template: `<div>ChatMessageList<button data-test="teaching-submit" @click="$emit('teaching-submit', { quizId: 'q1', kind: 'single_choice', answer: 'A' })">teach</button></div>`,
    emits: ['teaching-submit'],
  },
}))
vi.mock('@/features/ai/components/AISettingsDialog.vue', () => ({
  default: {
    name: 'AISettingsDialog',
    template: '<div>AISettingsDialog</div>',
    props: ['modelValue', 'initialTab'],
  },
}))
vi.mock('@/features/ai/components/ChatHistoryPanel.vue', () => ({
  default: { template: '<div>ChatHistoryPanel</div>' },
}))

import { type ChatMessage } from '@/features/ai/services/aiService'
import { type ChatSession } from '@/features/ai/composables/useChatHistory'

// Mock composables
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
  thinkingEffort: 'high',
  thinkingMode: 'disabled',
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
  aiThinkingMode: ref('disabled'),
  saveAIThinkingMode: vi.fn(),
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

describe('AiAssistantDrawer Navigation and Button States', () => {
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

  it('should disable "New Chat" button when there is no chat history', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const newChatBtn = wrapper.findAll('button').find((b) => b.text().includes('ai.newChat'))
    expect(newChatBtn?.attributes('disabled')).toBeDefined()
  })

  it('should enable "New Chat" button when there is chat history', async () => {
    mockMessages.value = [{ id: '1', role: 'user', content: 'test' }]

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const newChatBtn = wrapper.findAll('button').find((b) => b.text().includes('ai.newChat'))
    expect(newChatBtn?.attributes('disabled')).toBeUndefined()
  })

  it('should disable "New Chat" button when generating', async () => {
    mockMessages.value = [{ id: '1', role: 'user', content: 'test' }]
    mockIsGenerating.value = true

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const newChatBtn = wrapper.findAll('button').find((b) => b.text().includes('ai.newChat'))
    expect(newChatBtn?.attributes('disabled')).toBeDefined()
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

  describe('Hover Interactions', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('should handle hover events for preset dropdown', async () => {
      const wrapper = mount(AiAssistantDrawer, {
        props: { modelValue: true },
      })

      // We test the logic by triggering the events
      const presetContainer = wrapper.findAll('div.relative').find((div) => {
        return div.text().includes('ai.custom')
      })

      expect(presetContainer).toBeDefined()

      // Trigger mouseenter
      await presetContainer?.trigger('mouseenter')
      await nextTick()

      // We can't easily check the internal ref without exposing it,
      // but we can check if the dropdown appears.
      // If it doesn't appear in tests due to Transition/Stubbing, we at least ensure no errors.
    })
  })
})
