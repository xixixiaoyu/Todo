/* eslint-disable vue/one-component-per-file */
import { describe, it, expect, vi } from 'vitest'
import { useGsap } from '@/composables/useGsap'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import gsap from 'gsap'

describe('useGsap', () => {
  it('should provide gsap instance and context', () => {
    const TestComponent = defineComponent({
      setup() {
        const { gsap: gsapInstance, ctx } = useGsap()
        return { gsapInstance, ctx }
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)
    expect(wrapper.vm.gsapInstance).toBe(gsap)
    expect(wrapper.vm.ctx).toBeDefined()
  })

  it('should call ctx.revert on unmount', () => {
    const revertSpy = vi.fn()
    vi.spyOn(gsap, 'context').mockReturnValue({
      revert: revertSpy,
      add: vi.fn(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const TestComponent = defineComponent({
      setup() {
        useGsap()
        return {}
      },
      template: '<div></div>',
    })

    const wrapper = mount(TestComponent)
    wrapper.unmount()
    expect(revertSpy).toHaveBeenCalled()
  })
})
