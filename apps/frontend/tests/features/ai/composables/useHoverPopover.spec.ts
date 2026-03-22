import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHoverPopover } from '@/features/ai/composables/useHoverPopover'

function stubMatchMedia(canHover: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: canHover,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  )
}

const TestHoverPopover = defineComponent({
  setup() {
    const open = ref(false)
    const hover = useHoverPopover({ open, delayMs: 50 })

    return {
      open,
      hover,
    }
  },
  template: `
    <div
      data-test="trigger"
      :data-open="open"
      @mouseenter="hover.onMouseEnter"
      @mouseleave="hover.onMouseLeave"
    />
  `,
})

describe('useHoverPopover', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('只在支持 hover 的环境下响应 mouseenter', async () => {
    stubMatchMedia(true)

    const wrapper = mount(TestHoverPopover)
    await wrapper.get('[data-test="trigger"]').trigger('mouseenter')

    expect(wrapper.get('[data-test="trigger"]').attributes('data-open')).toBe('true')
  })

  it('在触屏环境下忽略 hover 事件，避免首次 tap 被开关抵消', async () => {
    stubMatchMedia(false)

    const wrapper = mount(TestHoverPopover)
    await wrapper.get('[data-test="trigger"]').trigger('mouseenter')

    expect(wrapper.get('[data-test="trigger"]').attributes('data-open')).toBe('false')
  })

  it('在支持 hover 的环境下延迟关闭', async () => {
    stubMatchMedia(true)

    const wrapper = mount(TestHoverPopover)
    const trigger = wrapper.get('[data-test="trigger"]')

    await trigger.trigger('mouseenter')
    await trigger.trigger('mouseleave')
    expect(trigger.attributes('data-open')).toBe('true')

    vi.advanceTimersByTime(50)
    await wrapper.vm.$nextTick()

    expect(trigger.attributes('data-open')).toBe('false')
  })
})
