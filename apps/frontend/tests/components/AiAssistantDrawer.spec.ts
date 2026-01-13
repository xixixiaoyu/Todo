import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import AiAssistantDrawer from '@/components/AiAssistantDrawer.vue'

// Mock Lucide icons
vi.mock('lucide-vue-next', () => {
  const icons = [
    'Clover',
    'Plus',
    'X',
    'Maximize2',
    'Minimize2',
    'Send',
    'Lightbulb',
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
vi.mock('@/components/chat/ChatMessageList.vue', () => ({
  default: { template: '<div>ChatMessageList</div>' },
}))
vi.mock('@/components/chat/AISettingsDialog.vue', () => ({
  default: {
    name: 'AISettingsDialog',
    template: '<div>AISettingsDialog</div>',
    props: ['modelValue', 'initialTab'],
  },
}))
vi.mock('@/components/chat/ChatHistoryPanel.vue', () => ({
  default: { template: '<div>ChatHistoryPanel</div>' },
}))

import { type ChatMessage } from '@/services/aiService'
import { type ChatSession } from '@/composables/useChatHistory'

// Mock composables
const mockSessions = ref<ChatSession[]>([])
const mockCurrentSessionId = ref<string | null>(null)
const mockLastActiveSession = ref<ChatSession | null>(null)
const mockMessages = ref<ChatMessage[]>([])
const mockIsGenerating = ref(false)

vi.mock('@/composables/useChatHistory', () => ({
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

vi.mock('@/composables/useChat', () => ({
  useChat: () => ({
    messages: mockMessages,
    isGenerating: mockIsGenerating,
    error: ref(null),
    sendMessage: vi.fn(),
    stopGenerating: vi.fn(),
    clearHistory: vi.fn(),
    regenerateLastResponse: vi.fn(),
    editAndResendMessage: vi.fn(),
  }),
}))

const mockUpdateConfig = vi.fn()
const mockConfig = ref({
  thinkingMode: 'disabled',
  todoAssistant: false,
  discussionMode: false,
  discussionModelIds: [],
  discussionPrimaryModelId: null,
})

vi.mock('@/composables/useAIConfig', () => ({
  useAIConfig: () => ({
    presets: ref([]),
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
}))

describe('AiAssistantDrawer Navigation and Button States', () => {
  beforeEach(() => {
    mockSessions.value = []
    mockCurrentSessionId.value = null
    mockMessages.value = []
    mockIsGenerating.value = false
    mockConfig.value.todoAssistant = false
    mockConfig.value.discussionMode = false
    vi.clearAllMocks()
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

  it('should disable "Previous Session" button when generating even if last active session exists', async () => {
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
    expect(prevBtn.attributes('disabled')).toBeDefined()
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
