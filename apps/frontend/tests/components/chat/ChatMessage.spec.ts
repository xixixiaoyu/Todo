import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessage from '@/components/chat/ChatMessage.vue'

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  ChevronUp: { name: 'ChevronUp', template: '<span>ChevronUp</span>' },
  Copy: { name: 'Copy', template: '<span>Copy</span>' },
  Check: { name: 'Check', template: '<span>Check</span>' },
  RefreshCw: { name: 'RefreshCw', template: '<span>RefreshCw</span>' },
  Pencil: { name: 'Pencil', template: '<span>Pencil</span>' },
  Users: { name: 'Users', template: '<span>Users</span>' },
  CircleDashed: { name: 'CircleDashed', template: '<span>CircleDashed</span>' },
  CheckCircle2: { name: 'CheckCircle2', template: '<span>CheckCircle2</span>' },
  AlertCircle: { name: 'AlertCircle', template: '<span>AlertCircle</span>' },
}))

// Mock composables
vi.mock('@/composables/useMarkdown', () => ({
  useMarkdown: () => ({
    renderMarkdown: vi.fn((c) => Promise.resolve(c)),
    getMermaidSvgMap: vi.fn(() => new Map()),
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

describe('ChatMessage', () => {
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
    })
    expect(wrapper.text()).toContain('ai.finalSynthesizing')
  })
})
