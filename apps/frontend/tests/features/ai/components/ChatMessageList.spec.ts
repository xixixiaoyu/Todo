import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import ChatMessageList from '@/features/ai/components/ChatMessageList.vue'

const scrollToBottomSpy = vi.fn()
const setStreamingModeSpy = vi.fn()

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

vi.mock('lucide-vue-next', () => ({
  ArrowDown: { template: '<span />' },
  Sparkles: { template: '<span />' },
}))

vi.mock('@/composables/useSmartScroll', () => ({
  useSmartScroll: () => ({
    isSticking: ref(true),
    isUserScrolledUp: ref(false),
    isScrollable: ref(true),
    scrollToBottom: scrollToBottomSpy,
    streamingScroll: vi.fn(),
    setStreamingMode: setStreamingModeSpy,
    enableAutoScroll: vi.fn(),
  }),
}))

vi.mock('@/features/ai/composables/useChatHistory', () => ({
  useChatHistory: () => ({
    currentSessionId: ref('s1'),
  }),
}))

describe('ChatMessageList - performance windowing', () => {
  it('renders only the tail window by default and can load older messages', async () => {
    scrollToBottomSpy.mockClear()
    setStreamingModeSpy.mockClear()

    const messages = Array.from({ length: 500 }).map((_, i) => ({
      id: `m-${i}`,
      role: 'assistant' as const,
      content: `hello ${i}`,
      isStreaming: false,
    }))

    const wrapper = mount(ChatMessageList, {
      props: { messages },
      global: {
        stubs: {
          Transition: { template: '<div><slot /></div>' },
          TransitionGroup: { template: '<div><slot /></div>' },
          ChatMessage: { template: '<div class="msg" />' },
          ChatSuggestions: { template: '<div />' },
        },
      },
    })

    expect(wrapper.findAll('.msg').length).toBe(200)
    expect(wrapper.find('[data-test="load-older"]').exists()).toBe(true)

    await wrapper.find('[data-test="load-older"]').trigger('click')
    await nextTick()

    expect(wrapper.findAll('.msg').length).toBe(400)
  })

  it('does not apply session entrance staggering on initial mount with persisted messages', async () => {
    scrollToBottomSpy.mockClear()
    setStreamingModeSpy.mockClear()

    const messages = [
      { id: 'm-1', role: 'assistant' as const, content: 'first', isStreaming: false },
      { id: 'm-2', role: 'assistant' as const, content: 'second', isStreaming: false },
    ]

    const wrapper = mount(ChatMessageList, {
      props: { messages },
      global: {
        stubs: {
          Transition: false,
          TransitionGroup: false,
          ChatMessage: {
            inheritAttrs: false,
            template: '<div class="msg" v-bind="$attrs" />',
          },
          ChatSuggestions: { template: '<div />' },
          ChatMinimap: { template: '<div />' },
          AiLuminaIcon: { template: '<div />' },
        },
      },
    })

    await nextTick()

    const renderedMessages = wrapper.findAll('.msg')
    expect(renderedMessages).toHaveLength(2)
    expect(renderedMessages[1].attributes('style')).toContain('transition-delay: 0s;')
    expect(scrollToBottomSpy).toHaveBeenCalledWith('instant')
  })
})
