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
    'GraduationCap',
    'BookOpen',
    'LayoutGrid',
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
  default: {
    name: 'AISettingsDialog',
    template: '<div>AISettingsDialog</div>',
    props: ['modelValue', 'initialTab'],
  },
}))
vi.mock('@/features/ai/components/ChatHistoryPanel.vue', () => ({
  default: { template: '<div>ChatHistoryPanel</div>' },
}))

// Mock composables
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
    messages: ref([]),
    isGenerating: ref(false),
    error: ref(null),
    sendMessage: vi.fn(),
    stopGenerating: vi.fn(),
    clearHistory: vi.fn(),
    regenerateLastResponse: vi.fn(),
    regenerateMessage: vi.fn(),
    deleteMessage: vi.fn(),
    editAndResendMessage: vi.fn(),
    updateTeachingQuizAnswer: vi.fn(),
    getTeachingQuizSnapshot: vi.fn(),
  }),
}))

vi.mock('@/features/ai/composables/useAIConfig', () => ({
  useAIConfig: () => ({
    presets: ref([]),
    skills: ref([]),
    activePreset: ref(null),
    switchPreset: vi.fn(),
    config: ref({
      assistantMode: 'default',
      baseUrl: '',
      apiKey: '',
      model: '',
      temperature: 0.7,
      systemPrompt: '',
      thinkingMode: 'off',
      todoAssistant: false,
      discussionMode: false,
      mcpEnabled: false,
      contextCompressionEnabled: false,
      contextCompressionTriggerChars: 24000,
      contextCompressionModelId: null,
      enableImageGeneration: false,
      discussionModelIds: [],
      discussionPrimaryModelId: null,
      memoryModelId: null,
      skillIds: [],
    }),
    updateConfig: vi.fn(),
  }),
  aiThinkingLevel: ref('off'),
  saveAIThinkingLevel: vi.fn(),
}))

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

// Mock components to simplify rendering
vi.mock('@/features/ai/components/AiAssistantHeader.vue', () => ({
  default: { template: '<div>AiAssistantHeader</div>' },
}))

vi.mock('@/features/ai/components/AiAssistantToolbar.vue', () => ({
  default: {
    template: '<div>AiAssistantToolbar<slot name="input" /></div>',
  },
}))

// Mock FileReader
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

describe('AiAssistantDrawer Clipboard Paste', () => {
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
