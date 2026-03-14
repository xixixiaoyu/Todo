import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AiAssistantInput from '@/features/ai/components/AiAssistantInput.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

class MockResizeObserver {
  observe() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', MockResizeObserver)

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
  window.dispatchEvent(new Event('resize'))
}

const defaultProps = {
  modelValue: '',
  isImageGenerationEnabled: false,
  isTodoAssistantEnabled: false,
  isDiscussionEnabled: false,
  isThinkingEnabled: false,
  isTeachingEnabled: false,
  selectedImages: [],
  parsedFiles: [],
  isGenerating: false,
  error: null,
}

describe('AiAssistantInput', () => {
  beforeEach(() => {
    setViewportWidth(1024)
  })

  it('应在桌面端按 Enter 时发送消息', async () => {
    const wrapper = mount(AiAssistantInput, {
      props: {
        ...defaultProps,
        modelValue: 'hello',
      },
      global: {
        stubs: {
          AiAssistantInputAttachments: true,
          AiAssistantInputSlashCommands: true,
        },
      },
    })

    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('send')).toHaveLength(1)
  })

  it('应在移动端按 Enter 时不发送消息', async () => {
    setViewportWidth(390)

    const wrapper = mount(AiAssistantInput, {
      props: {
        ...defaultProps,
        modelValue: 'hello',
      },
      global: {
        stubs: {
          AiAssistantInputAttachments: true,
          AiAssistantInputSlashCommands: true,
        },
      },
    })

    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('send')).toBeFalsy()
  })
})
