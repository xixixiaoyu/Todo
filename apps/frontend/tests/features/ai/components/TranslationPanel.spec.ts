import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TranslationPanel from '@/features/ai/components/TranslationPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/composables/useResizable', () => ({
  useResizable: () => ({
    width: { value: 300 },
    isResizing: { value: false },
    startResize: vi.fn(),
  }),
}))

const mockToast = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: mockToast,
  }),
}))

const mockTranslateText = vi.fn()
const mockDetectLanguage = vi.fn()
vi.mock('@/features/ai/services/translation', () => ({
  detectLanguage: (...args: Parameters<typeof mockDetectLanguage>) => mockDetectLanguage(...args),
  translateText: (...args: Parameters<typeof mockTranslateText>) => mockTranslateText(...args),
}))

const DEFAULT_CONFIG = {
  assistantMode: 'translation' as const,
  baseUrl: 'https://api.test.com',
  apiKey: 'sk-test',
  model: 'test-model',
  temperature: 0.6,
  systemPrompt: '',
  thinkingMode: 'off' as const,
  todoAssistant: false,
  discussionMode: false,
  discussionModelIds: [] as readonly string[],
  discussionPrimaryModelId: null,
  memoryModelId: null,
  enableImageGeneration: false,
  mcpEnabled: false,
  contextCompressionEnabled: false,
  contextCompressionTriggerChars: 24000,
  contextCompressionModelId: null,
  skillIds: [] as readonly string[],
  novelGenre: null,
  novelTone: '',
  novelProtagonistHint: '',
  agentMode: false,
  agentWorkspaceId: null,
  agentWorkspacePath: null,
  visionEnabled: false,
  visionPresetId: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDetectLanguage.mockReturnValue('zh')
  mockTranslateText.mockResolvedValue('Hello world')
})

describe('TranslationPanel', () => {
  it('渲染左右分栏布局', () => {
    const wrapper = mount(TranslationPanel, {
      props: { config: DEFAULT_CONFIG },
      global: { stubs: { Teleport: true } },
    })

    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.text()).toContain('ai.translationMode')
  })

  it('空输入时翻译按钮禁用', () => {
    const wrapper = mount(TranslationPanel, {
      props: { config: DEFAULT_CONFIG },
      global: { stubs: { Teleport: true } },
    })

    const button = wrapper.find('button[disabled]')
    expect(button.exists()).toBe(true)
  })

  it('输入中文时调用翻译为英文', async () => {
    const wrapper = mount(TranslationPanel, {
      props: { config: DEFAULT_CONFIG },
      global: { stubs: { Teleport: true } },
    })

    const textarea = wrapper.find('textarea')
    await textarea.setValue('你好世界')

    // 点击翻译按钮
    const translateButton = wrapper.find('button')
    await translateButton.trigger('click')

    expect(mockDetectLanguage).toHaveBeenCalledWith('你好世界')
    expect(mockTranslateText).toHaveBeenCalledWith('你好世界', 'en', DEFAULT_CONFIG)
  })

  it('输入英文时翻译为中文', async () => {
    mockDetectLanguage.mockReturnValue('non-zh')

    const wrapper = mount(TranslationPanel, {
      props: { config: DEFAULT_CONFIG },
      global: { stubs: { Teleport: true } },
    })

    const textarea = wrapper.find('textarea')
    await textarea.setValue('Hello world')

    const translateButton = wrapper.find('button')
    await translateButton.trigger('click')

    expect(mockDetectLanguage).toHaveBeenCalledWith('Hello world')
    expect(mockTranslateText).toHaveBeenCalledWith('Hello world', 'zh', DEFAULT_CONFIG)
  })

  it('翻译成功后显示译文', async () => {
    const wrapper = mount(TranslationPanel, {
      props: { config: DEFAULT_CONFIG },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.find('textarea').setValue('你好世界')
    await wrapper.find('button').trigger('click')

    // 等待异步完成
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(wrapper.text()).toContain('Hello world')
  })

  it('翻译失败显示错误信息', async () => {
    mockTranslateText.mockRejectedValueOnce(new Error('API error'))

    const wrapper = mount(TranslationPanel, {
      props: { config: DEFAULT_CONFIG },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.find('textarea').setValue('test')
    await wrapper.find('button').trigger('click')

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(wrapper.text()).toContain('API error')
  })

  it('点击复制按钮写入剪贴板', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
    })

    const wrapper = mount(TranslationPanel, {
      props: { config: DEFAULT_CONFIG },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.find('textarea').setValue('你好世界')
    await wrapper.find('button').trigger('click')

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 10))

    // 找到复制按钮并点击
    const buttons = wrapper.findAll('button')
    const copyButton = buttons.find((b) => b.text().includes('ai.translationCopyResult'))
    expect(copyButton).toBeTruthy()
    await copyButton!.trigger('click')

    expect(writeTextMock).toHaveBeenCalledWith('Hello world')
    expect(mockToast).toHaveBeenCalledWith('ai.translationCopied')
  })
})
