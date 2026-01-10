import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import AiAssistantDrawer from '@/components/AiAssistantDrawer.vue'

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  Clover: { template: '<span>Clover</span>' },
  Plus: { template: '<span>Plus</span>' },
  X: { template: '<span>X</span>' },
  Maximize2: { template: '<span>Maximize2</span>' },
  Minimize2: { template: '<span>Minimize2</span>' },
  Send: { template: '<span>Send</span>' },
  Lightbulb: { template: '<span>Lightbulb</span>' },
  Settings2: { template: '<span>Settings2</span>' },
  ChevronDown: { template: '<span>ChevronDown</span>' },
  ChevronLeft: { template: '<span>ChevronLeft</span>' },
  Square: { template: '<span>Square</span>' },
  RefreshCw: { template: '<span>RefreshCw</span>' },
  Trash2: { template: '<span>Trash2</span>' },
  History: { template: '<span>History</span>' },
  Check: { template: '<span>Check</span>' },
}))

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
const mockMessages = ref<ChatMessage[]>([])
const mockIsGenerating = ref(false)

vi.mock('@/composables/useChatHistory', () => ({
  useChatHistory: () => ({
    sessions: mockSessions,
    currentSessionId: mockCurrentSessionId,
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
  }),
}))

vi.mock('@/composables/useAIConfig', () => ({
  useAIConfig: () => ({
    presets: ref([]),
    activePreset: ref(null),
    switchPreset: vi.fn(),
    config: ref({ thinkingMode: 'disabled', todoAssistant: false }),
    updateConfig: vi.fn(),
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

  it('should not show "Previous Session" button when there is only one session', async () => {
    mockSessions.value = [
      { id: '1', title: 'Session 1', messages: [], createdAt: new Date(), updatedAt: new Date() },
    ]
    mockCurrentSessionId.value = '1'

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const prevBtn = wrapper.find('button[title="ai.previousSession"]')
    expect(prevBtn.exists()).toBe(false)
  })

  it('should show "Previous Session" button when there are multiple sessions', async () => {
    mockSessions.value = [
      { id: '2', title: 'Session 2', messages: [], createdAt: new Date(), updatedAt: new Date() },
      { id: '1', title: 'Session 1', messages: [], createdAt: new Date(), updatedAt: new Date() },
    ]
    mockCurrentSessionId.value = '2'

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const prevBtn = wrapper.find('button[title="ai.previousSession"]')
    expect(prevBtn.exists()).toBe(true)
  })

  it('should disable "Previous Session" button when on the oldest session', async () => {
    mockSessions.value = [
      { id: '2', title: 'Session 2', messages: [], createdAt: new Date(), updatedAt: new Date() },
      { id: '1', title: 'Session 1', messages: [], createdAt: new Date(), updatedAt: new Date() },
    ]
    mockCurrentSessionId.value = '1' // Oldest

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const prevBtn = wrapper.find('button[title="ai.previousSession"]')
    expect(prevBtn.attributes('disabled')).toBeDefined()
  })

  it('should disable "Previous Session" button when generating', async () => {
    mockSessions.value = [
      { id: '2', title: 'Session 2', messages: [], createdAt: new Date(), updatedAt: new Date() },
      { id: '1', title: 'Session 1', messages: [], createdAt: new Date(), updatedAt: new Date() },
    ]
    mockCurrentSessionId.value = '2'
    mockIsGenerating.value = true

    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const prevBtn = wrapper.find('button[title="ai.previousSession"]')
    expect(prevBtn.attributes('disabled')).toBeDefined()
  })

  it('should call toggleThinkingMode when button is clicked', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const thinkingBtn = wrapper
      .findAll('button')
      .find((b) => b.attributes('title')?.includes('ai.thinking'))
    await thinkingBtn?.trigger('click')

    // Note: Since we are mocking useAIConfig, we check if the toggle function was called
    // or if the state changed if we were using the real composable.
    // In our mock, toggleThinkingMode is local to the component but it calls saveAIThinkingMode.
    const { saveAIThinkingMode } = await import('@/composables/useAIConfig')
    expect(saveAIThinkingMode).toHaveBeenCalled()
  })

  it('should remember the last tab when opening settings without arguments', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
      global: {
        stubs: {
          ChatMessageList: true,
          AISettingsDialog: {
            name: 'AISettingsDialog',
            template: '<div class="settings-dialog-stub"></div>',
            props: ['modelValue', 'initialTab'],
            emits: ['update:modelValue', 'update:initialTab'],
          },
          History: true,
          Settings2: true,
          Plus: true,
          Brain: true,
          ChevronDown: true,
          Check: true,
          Maximize2: true,
          Minimize2: true,
          X: true,
        },
        mocks: {
          t: (key: string) => key,
        },
      },
    })

    // 1. Initial state: should be settings
    const settingsBtn = wrapper
      .findAll('button')
      .find((b) => b.attributes('title') === 'ai.settings')
    await settingsBtn?.trigger('click')
    let dialog = wrapper.findComponent({ name: 'AISettingsDialog' })
    expect(dialog.props('initialTab')).toBe('settings')

    // 2. Simulate user switching tab in dialog to 'presets'
    await dialog.vm.$emit('update:initialTab', 'presets')
    await dialog.vm.$emit('update:modelValue', false) // close
    await nextTick()

    // 3. Reopen via settings button (no arguments)
    await settingsBtn?.trigger('click')
    dialog = wrapper.findComponent({ name: 'AISettingsDialog' })
    expect(dialog.props('initialTab')).toBe('presets')
  })

  it('should still allow explicit tab override', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
      global: {
        stubs: {
          ChatMessageList: true,
          AISettingsDialog: {
            name: 'AISettingsDialog',
            template: '<div></div>',
            props: ['modelValue', 'initialTab'],
          },
          ChevronDown: true,
        },
        mocks: {
          t: (key: string) => key,
        },
      },
    })

    // Click "Manage Presets" which should override even if last was settings
    const presetTrigger = wrapper
      .findAll('button')
      .find((b) => b.classes().some((c) => c.includes('bg-[#b8a785]')))
    await presetTrigger?.trigger('click') // open dropdown
    const manageBtn = wrapper.findAll('button').find((b) => b.text().includes('ai.managePresets'))
    await manageBtn?.trigger('click')

    const dialog = wrapper.findComponent({ name: 'AISettingsDialog' })
    expect(dialog.props('initialTab')).toBe('presets')
  })
})
