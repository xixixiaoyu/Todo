import { describe, it, expect, vi } from 'vitest'
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

// Mock composables
vi.mock('@/composables/useChatHistory', () => ({
  useChatHistory: () => ({
    sessions: ref([]),
    currentSessionId: ref(null),
    lastActiveSession: ref(null),
    switchSession: vi.fn(),
    createSession: vi.fn(),
  }),
}))

vi.mock('@/composables/useChat', () => ({
  useChat: () => ({
    messages: ref([]),
    isGenerating: ref(false),
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
    await new Promise((resolve) => setTimeout(resolve, 10))
    await nextTick()

    // Check if image preview is rendered
    const images = wrapper.findAll('img')
    expect(images.length).toBe(1)
    expect(images[0].attributes('src')).toBe('data:image/png;base64,mock-data')
  })

  it('should not add more than 4 images', async () => {
    const wrapper = mount(AiAssistantDrawer, {
      props: { modelValue: true },
    })

    const textarea = wrapper.find('textarea')
    const mockFile = new File([''], 'test.png', { type: 'image/png' })
    const mockClipboardData = {
      items: Array(6).fill({
        type: 'image/png',
        getAsFile: () => mockFile,
      }),
    }

    await textarea.trigger('paste', {
      clipboardData: mockClipboardData,
    })

    await new Promise((resolve) => setTimeout(resolve, 10))
    await nextTick()

    const images = wrapper.findAll('img')
    expect(images.length).toBe(4)
  })
})
