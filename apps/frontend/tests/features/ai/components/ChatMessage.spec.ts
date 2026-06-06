import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import i18n from '@/i18n'
import ChatMessage from '@/features/ai/components/chat/ChatMessage.vue'
import type { ChatMessage as ChatMessageType } from '@/features/ai/composables/useChat'
import * as aiService from '@/features/ai/services/aiService'

beforeEach(() => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
})
import ChatMessageMarkdown from '@/features/ai/components/chat/ChatMessageMarkdown.vue'

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  ChevronUp: { name: 'ChevronUp', template: '<span>ChevronUp</span>' },
  Copy: { name: 'Copy', template: '<span>Copy</span>' },
  Check: { name: 'Check', template: '<span>Check</span>' },
  RefreshCw: { name: 'RefreshCw', template: '<span>RefreshCw</span>' },
  Pencil: { name: 'Pencil', template: '<span>Pencil</span>' },
  Trash2: { name: 'Trash2', template: '<span>Trash2</span>' },
  Users: { name: 'Users', template: '<span>Users</span>' },
  MessageSquare: { name: 'MessageSquare', template: '<span>MessageSquare</span>' },
  LayoutTemplate: { name: 'LayoutTemplate', template: '<span>LayoutTemplate</span>' },
  CircleDashed: { name: 'CircleDashed', template: '<span>CircleDashed</span>' },
  CheckCircle2: { name: 'CheckCircle2', template: '<span>CheckCircle2</span>' },
  AlertCircle: { name: 'AlertCircle', template: '<span>AlertCircle</span>' },
  Send: { name: 'Send', template: '<span>Send</span>' },
  ExternalLink: { name: 'ExternalLink', template: '<span>ExternalLink</span>' },
  Sparkles: { name: 'Sparkles', template: '<span>Sparkles</span>' },
  X: { name: 'X', template: '<span>X</span>' },
  BookCheck: { name: 'BookCheck', template: '<span>BookCheck</span>' },
  Target: { name: 'Target', template: '<span>Target</span>' },
}))

// Mock composables
vi.mock('@/composables/useMarkdown', () => ({
  useMarkdown: () => ({
    renderMarkdown: vi.fn((c) => Promise.resolve(c)),
    getMermaidSvgMap: vi.fn(() => new Map()),
  }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('@/features/ai/services/aiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/ai/services/aiService')>()
  return {
    ...actual,
    generateId: vi.fn(() => 'mock-id'),
    getAIStreamResponse: vi.fn(actual.getAIStreamResponse),
    abortCurrentRequest: vi.fn(actual.abortCurrentRequest),
  }
})

describe('ChatMessage', () => {
  it('applies the refined typography classes to assistant and user bubbles', async () => {
    const assistantWrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'assistant-1',
          role: 'assistant' as const,
          content: 'Hello',
        },
      },
      global: {
        plugins: [i18n],
      },
    })

    await flushPromises()

    expect(assistantWrapper.find('.ai-chat-message--assistant').exists()).toBe(true)
    expect(assistantWrapper.find('.ai-chat-markdown').exists()).toBe(true)

    const userWrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'user-1',
          role: 'user' as const,
          content: '你好',
        },
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(userWrapper.find('.ai-chat-message--user').exists()).toBe(true)
    expect(userWrapper.find('.ai-chat-user-text').exists()).toBe(true)

    // Verify alignment and width constraints for user messages
    const userMessageContainer = userWrapper.find('.flex-col.items-end')
    expect(userMessageContainer.exists()).toBe(true)
    expect(userMessageContainer.classes()).toContain('max-w-[76%]')

    const userBubble = userWrapper.find('.ai-chat-message--user')
    expect(userBubble.classes()).toContain('w-fit')
  })

  it('keeps image generation bubbles free of assistant padding classes', () => {
    const wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'assistant-image',
          role: 'assistant' as const,
          content: 'ai.generatingImage',
        },
      },
      global: {
        plugins: [i18n],
        stubs: {
          ImageLoadingState: true,
        },
      },
    })

    const bubble = wrapper.find('.ai-chat-message')
    expect(bubble.classes()).toContain('p-0')
    expect(bubble.classes()).not.toContain('ai-chat-message--assistant')
  })

  it('should render discussion steps correctly', async () => {
    const message = {
      id: '1',
      role: 'assistant' as const,
      content: 'Hello',
      discussionSteps: [
        { modelId: 'm1', modelName: 'Model 1', content: 'Result 1', status: 'done' as const },
        { modelId: 'm2', modelName: 'Model 2', content: '', status: 'thinking' as const },
        { modelId: 'm3', modelName: 'Model 3', content: 'Error 1', status: 'error' as const },
      ],
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
      global: {
        stubs: {
          Users: true,
          CircleDashed: true,
          CheckCircle2: true,
          AlertCircle: true,
        },
      },
    })

    // Check if discussion steps container is rendered
    expect(wrapper.find('.mb-2.space-y-2').exists()).toBe(true)

    // Check if status text is rendered
    expect(wrapper.text()).toContain('ai.discussionStatus')

    // Check individual steps
    const steps = wrapper.findAll('.flex.items-start.gap-2.text-xs')
    expect(steps).toHaveLength(3)

    // Step 1: Done
    expect(steps[0].text()).toContain('Model 1')
    expect(steps[0].text()).toContain('ai.contributionReady')
    expect(steps[0].findComponent({ name: 'CheckCircle2' }).exists()).toBe(true)

    // Step 2: Thinking
    expect(steps[1].text()).toContain('Model 2')
    expect(steps[1].text()).toContain('ai.isThinking')
    expect(steps[1].findComponent({ name: 'CircleDashed' }).exists()).toBe(true)

    // Step 3: Error
    expect(steps[2].text()).toContain('Model 3')
    expect(steps[2].text()).toContain('Error 1')
    expect(steps[2].findComponent({ name: 'AlertCircle' }).exists()).toBe(true)
  })

  it('should not render discussion steps for user messages', () => {
    const message = {
      id: '1',
      role: 'user' as const,
      content: 'Hello',
      discussionSteps: [
        { modelId: 'm1', modelName: 'Model 1', content: 'Result 1', status: 'done' as const },
      ],
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
    })

    expect(wrapper.find('.mb-2.space-y-2').exists()).toBe(false)
  })

  it('should update thinking status correctly during discussion', async () => {
    const message = {
      id: '1',
      role: 'assistant' as const,
      content: '',
      thinkingContent: 'Thinking...',
      isStreaming: true,
      discussionSteps: [
        { modelId: 'm1', modelName: 'Model 1', content: '', status: 'thinking' as const },
      ],
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
      global: {
        stubs: {
          Users: true,
          CircleDashed: true,
          CheckCircle2: true,
          AlertCircle: true,
          ChevronUp: true,
        },
      },
    })

    // When discussion steps are present and thinking
    expect(wrapper.text()).toContain('ai.discussionStatus')

    // When all steps are done but still synthesizing
    await wrapper.setProps({
      message: {
        ...message,
        discussionSteps: [
          { modelId: 'm1', modelName: 'Model 1', content: 'done', status: 'done' as const },
        ],
      },
    } as never)
    expect(wrapper.text()).toContain('ai.finalSynthesizing')
  })

  it('should show streaming cursor when isStreaming is true', () => {
    const message = {
      id: '1',
      role: 'assistant' as const,
      content: '',
      isStreaming: true,
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
      global: {
        plugins: [i18n],
      },
    })

    // 当流式输出且没有内容时，应显示加载状态中的动画
    expect(wrapper.find('.loading-container').exists()).toBe(true)
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
  })

  it('should switch from loading to thinking panel without overlap', async () => {
    const message = {
      id: '1',
      role: 'assistant' as const,
      content: '',
      isStreaming: true,
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.find('.loading-container').exists()).toBe(true)
    expect(wrapper.find('.thinking-content').exists()).toBe(false)

    await wrapper.setProps({
      message: {
        ...message,
        thinkingContent: '正在分析...',
      },
    } as never)
    await flushPromises()

    expect(wrapper.find('.loading-container').exists()).toBe(false)
    expect(wrapper.find('.thinking-content').exists()).toBe(true)
  })

  it('should keep the thinking icon anchored and render a subtle active state while streaming', async () => {
    const message = {
      id: '1',
      role: 'assistant' as const,
      content: '',
      thinkingContent: '正在分析...',
      isStreaming: true,
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
      global: {
        plugins: [i18n],
      },
    })

    await flushPromises()

    const iconShell = wrapper.find('.thinking-icon-shell')
    const iconCore = wrapper.find('.thinking-icon-core')

    expect(iconShell.exists()).toBe(true)
    expect(iconCore.exists()).toBe(true)
    expect(iconShell.classes()).toContain('thinking-icon-shell--active')
    expect(iconCore.classes()).toContain('thinking-icon-core--active')
    expect(wrapper.find('.thinking-icon-sheen').exists()).toBe(false)
    expect(iconShell.classes()).not.toContain('animate-ai-float')
  })

  it('should show structured block loading states while streaming', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'assistant' as const,
      content: '已收到你的需求，正在准备结构化内容',
      isStreaming: true,
      pendingStructuredBlocks: ['teaching_quiz', 'todo_actions'],
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
      global: {
        plugins: [i18n],
      },
    })

    const teachingLoading = wrapper.find('[data-test="teaching-quiz-loading"]')
    const todoLoading = wrapper.find('[data-test="todo-actions-loading"]')

    expect(teachingLoading.exists()).toBe(true)
    expect(todoLoading.exists()).toBe(true)
    expect(teachingLoading.classes()).toContain('backdrop-blur-md')
    expect(todoLoading.classes()).toContain('backdrop-blur-md')
    expect(wrapper.findAll('.structured-skeleton-sheen').length).toBeGreaterThanOrEqual(2)
    expect(wrapper.findAll('.structured-skeleton-line').length).toBeGreaterThanOrEqual(4)
  })

  it('should prioritize reasoning details over thinking content in thinking panel', async () => {
    const message = {
      id: '1',
      role: 'assistant' as const,
      content: '',
      thinkingContent: 'generic thinking',
      reasoning_details: 'provider reasoning summary',
      isStreaming: true,
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
      global: {
        plugins: [i18n],
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('provider reasoning summary')
    expect(wrapper.text()).not.toContain('generic thinking')
  })

  it('should toggle thinking content when clicked', async () => {
    const message = {
      id: '1',
      role: 'assistant' as const,
      content: 'Hello',
      thinkingContent: 'Let me think...',
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
      global: {
        plugins: [i18n],
      },
    })

    const toggleButton = wrapper.find('.thinking-header')
    expect(toggleButton.exists()).toBe(true)

    // 点击切换展开状态
    await toggleButton.trigger('click')
    // 检查 body 是否有 maxHeight (不为 0px)
    const body = wrapper.find('.thinking-body')
    expect(body.attributes('style')).not.toContain('maxHeight: 0px')
  })

  it('should emit regenerate event when refresh button is clicked', async () => {
    const message = {
      id: '1',
      role: 'assistant' as const,
      content: 'Hello',
    }

    const wrapper = mount(ChatMessage, {
      props: { message, isLast: true },
      global: {
        plugins: [i18n],
      },
    })

    const allButtons = wrapper.findAll('button')
    const btn = allButtons.find((b) => b.text().includes('ai.regenerate'))
    expect(btn?.exists()).toBe(true)
    await btn?.trigger('click')

    expect(wrapper.emitted('regenerate')).toBeTruthy()
  })

  it('should handle editing user message', async () => {
    const message = {
      id: '1',
      role: 'user' as const,
      content: 'Original content',
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
      global: {
        plugins: [i18n],
        stubs: {
          Pencil: true,
        },
      },
    })

    // 找到编辑按钮（使用 title 属性）
    const editBtn = wrapper.find('button[title="ai.edit"]')
    expect(editBtn.exists()).toBe(true)
    await editBtn.trigger('click')

    // 应该显示 textarea
    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)

    expect(wrapper.html()).toContain('w-full max-w-full space-y-2')

    // 修改内容并保存
    await textarea.setValue('Updated content')
    const saveBtn = wrapper.findAll('button').find((btn) => btn.text().includes('ai.save'))
    await saveBtn?.trigger('click')

    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('edit')?.[0]).toEqual(['Updated content'])
  })

  it('should handle code copy button interaction', async () => {
    // Mock navigator.clipboard
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      configurable: true,
    })

    const message = {
      id: '1',
      role: 'assistant' as const,
      content: '```javascript\nconsole.log("hi")\n```',
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
      global: {
        plugins: [i18n],
      },
    })

    // 模拟 Markdown 渲染后的 HTML
    const container = document.createElement('div')
    container.innerHTML = `
      <div class="code-block-container">
        <button class="code-copy-button" data-code="${encodeURIComponent('console.log("hi")')}">
          <span>复制</span>
        </button>
      </div>
    `
    document.body.appendChild(container)

    // 在组件实例上调用初始化函数
    const vm = wrapper.vm as unknown as { initCodeInteractions: (el: HTMLElement) => void }
    vm.initCodeInteractions(container)

    const copyBtn = container.querySelector('.code-copy-button') as HTMLButtonElement
    copyBtn.click()

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockWriteText).toHaveBeenCalledWith('console.log("hi")')

    document.body.removeChild(container)
  })

  it('should show structured block warning and copy diagnostics', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      configurable: true,
    })

    const message = {
      id: '1',
      role: 'assistant' as const,
      content: 'Hello',
      structuredBlockErrors: [
        {
          block: 'todo_actions' as const,
          code: 'invalid_json' as const,
          raw: 'not json',
        },
      ],
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
    })

    expect(wrapper.text()).toContain('ai.structuredBlockWarningTitle')

    const copyBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('ai.structuredBlockCopyDiagnostics'))
    expect(copyBtn?.exists()).toBe(true)

    await copyBtn?.trigger('click')

    expect(mockWriteText).toHaveBeenCalledTimes(1)
    const arg = mockWriteText.mock.calls[0][0] as string
    expect(arg).toContain('"messageId": "1"')
    expect(arg).toContain('"block": "todo_actions"')
  })

  it('should render teaching learning report when assessments exist', () => {
    const message: ChatMessageType = {
      id: '1',
      role: 'assistant',
      content: '反馈如下',
      teachingAssessments: [
        {
          quizId: 'q1',
          result: 'incorrect',
          mastery: 'novice',
          feedback: '你已经抓住一半概念',
          nextFocus: '先解释输入输出关系',
        },
      ],
    }

    const wrapper = mount(ChatMessage, {
      props: { message },
    })

    expect(wrapper.text()).toContain('ai.teachingReportTitle')
    expect(wrapper.text()).toContain('q1')
    expect(wrapper.text()).toContain('ai.teachingReportNextFocus')
  })

  it('should emit ask-selection when asking about selected text', async () => {
    const wrapper = mount(ChatMessageMarkdown, {
      props: { content: 'Hello world', isStreaming: false, isMobile: false },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await flushPromises()

    const htmlContainer = wrapper.find('.markdown-content > div').element
    const textNode = htmlContainer.childNodes[0]
    expect(textNode).toBeTruthy()

    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 5)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    await wrapper.trigger('mouseup')
    await flushPromises()

    const askBtn = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'ai.askSelectionAction')
    expect(askBtn?.exists()).toBe(true)

    await askBtn!.trigger('click')
    await flushPromises()

    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    await input.setValue('What does this mean?')

    // 切换到对话模式以触发 ask-selection 事件
    const chatModeBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('ai.askSelectionModeChat'))
    if (chatModeBtn) {
      await chatModeBtn.trigger('click')
    }

    const sendBtn = wrapper.findAll('button').find((b) => b.text().includes('ai.send'))
    expect(sendBtn?.exists()).toBe(true)
    await sendBtn!.trigger('click')

    const emitted = wrapper.emitted('ask-selection')
    expect(emitted).toBeTruthy()
    const prompt = emitted![0][0] as string
    expect(prompt).toContain('What does this mean?')
    expect(prompt).toContain('ai.askSelectionQuote')
    expect(prompt).toContain('Hello')
  })

  it('should hide ask-selection action while streaming', async () => {
    const wrapper = mount(ChatMessageMarkdown, {
      props: { content: 'Hello world', isStreaming: true, isMobile: false },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await flushPromises()

    const fallbackContainer = wrapper.find('.relative.selectable.select-text')
    expect(fallbackContainer.exists()).toBe(true)
    const textNode = fallbackContainer.element.childNodes[0]
    expect(textNode).toBeTruthy()

    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 5)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    await wrapper.trigger('mouseup')
    await flushPromises()

    const askBtn = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'ai.askSelectionAction')
    expect(askBtn?.exists()).toBeFalsy()
  })

  it('should support floating ask flow and transfer result to chat', async () => {
    vi.mocked(aiService.getAIStreamResponse).mockImplementationOnce(async (_messages, onChunk) => {
      onChunk('Quick answer')
      onChunk('[DONE]')
    })

    const wrapper = mount(ChatMessageMarkdown, {
      props: { content: 'Hello world', isStreaming: false, isMobile: false },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await flushPromises()

    const htmlContainer = wrapper.find('.markdown-content > div').element
    const textNode = htmlContainer.childNodes[0]
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 5)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    await wrapper.trigger('mouseup')
    await flushPromises()

    const askBtn = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'ai.askSelectionAction')
    expect(askBtn?.exists()).toBe(true)
    await askBtn!.trigger('click')
    await flushPromises()

    const input = wrapper.find('input')
    await input.setValue('What does this mean?')

    const sendBtn = wrapper.findAll('button').find((b) => b.text().includes('ai.send'))
    expect(sendBtn?.exists()).toBe(true)
    await sendBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Quick answer')

    const transferBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('ai.askSelectionTransferToChat'))
    expect(transferBtn?.exists()).toBe(true)
    await transferBtn!.trigger('click')

    expect(wrapper.emitted('transfer-selection')).toBeTruthy()
    expect(wrapper.emitted('ask-selection')).toBeFalsy()
  })

  it('should abort only floating request when closing result panel', async () => {
    let capturedSignal: AbortSignal | undefined
    vi.mocked(aiService.getAIStreamResponse).mockImplementationOnce(
      async (_messages, onChunk, _onThinking, _onReasoning, options) => {
        capturedSignal = options?.abortSignal
        await new Promise<void>((resolve) => {
          if (!capturedSignal) {
            resolve()
            return
          }
          if (capturedSignal.aborted) {
            onChunk('[ABORTED]')
            resolve()
            return
          }
          capturedSignal.addEventListener(
            'abort',
            () => {
              onChunk('[ABORTED]')
              resolve()
            },
            { once: true },
          )
        })
      },
    )

    const wrapper = mount(ChatMessageMarkdown, {
      props: { content: 'Hello world', isStreaming: false, isMobile: false },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    })

    await flushPromises()

    const htmlContainer = wrapper.find('.markdown-content > div').element
    const textNode = htmlContainer.childNodes[0]
    const range = document.createRange()
    range.setStart(textNode, 0)
    range.setEnd(textNode, 5)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    await wrapper.trigger('mouseup')
    await flushPromises()

    const askBtn = wrapper
      .findAll('button')
      .find((b) => b.text().trim() === 'ai.askSelectionAction')
    expect(askBtn?.exists()).toBe(true)
    await askBtn!.trigger('click')
    await flushPromises()

    const input = wrapper.find('input')
    await input.setValue('Need details')

    const sendBtn = wrapper.findAll('button').find((b) => b.text().includes('ai.send'))
    expect(sendBtn?.exists()).toBe(true)
    await sendBtn!.trigger('click')
    await flushPromises()

    const closeBtn = wrapper.find('button[aria-label="common.close"]')
    expect(closeBtn.exists()).toBe(true)
    await closeBtn.trigger('click')
    await flushPromises()

    expect(capturedSignal).toBeDefined()
    expect(capturedSignal?.aborted).toBe(true)
    expect(aiService.abortCurrentRequest).not.toHaveBeenCalled()
  })
})
