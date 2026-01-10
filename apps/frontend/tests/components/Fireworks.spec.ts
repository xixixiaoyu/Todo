import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Fireworks from '@/components/Fireworks.vue'
import confetti from 'canvas-confetti'

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}))

describe('Fireworks.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('should not trigger confetti on mount if active is false', () => {
    mount(Fireworks, {
      props: {
        active: false,
      },
    })
    expect(confetti).not.toHaveBeenCalled()
  })

  it('should trigger confetti when active becomes true', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const wrapper = mount(Fireworks, {
      props: {
        active: false,
      },
    })

    await wrapper.setProps({ active: true })
    await nextTick()

    expect(confetti).toHaveBeenCalled()
  })

  it('should emit complete after timeout', async () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 0
    })

    const wrapper = mount(Fireworks, {
      props: {
        active: false,
      },
    })

    await wrapper.setProps({ active: true })
    await nextTick()

    // Fast forward time for the setTimeout in startFireworks
    vi.advanceTimersByTime(2500)

    expect(wrapper.emitted()).toHaveProperty('complete')
  })
})
