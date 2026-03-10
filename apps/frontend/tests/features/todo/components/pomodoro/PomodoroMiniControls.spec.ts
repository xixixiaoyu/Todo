import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import PomodoroMiniControls from '@/features/todo/components/pomodoro/PomodoroMiniControls.vue'
import { useTodoStore } from '@/features/todo/stores/todo'
import { usePomodoroStore } from '@/features/todo/stores/pomodoro'
import { nativeService } from '@/services/native'

vi.mock('lucide-vue-next', () => ({
  X: { template: '<span>X</span>' },
}))

describe('PomodoroMiniControls', () => {
  const setWindowWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
    window.dispatchEvent(new Event('resize'))
  }

  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    setWindowWidth(1024)
  })

  it('点击 AI 按钮应只执行打开，不会被再次点击反向关闭', async () => {
    vi.spyOn(nativeService, 'platform', 'get').mockReturnValue('web')

    const wrapper = mount(PomodoroMiniControls, {
      global: {
        stubs: {
          Button: {
            template: '<button><slot /></button>',
          },
          AiLuminaIcon: {
            template: '<span>AI</span>',
          },
        },
      },
    })

    const todoStore = useTodoStore()
    expect(todoStore.isDrawerOpen).toBe(false)

    const aiButton = wrapper.findAll('button').at(1)
    expect(aiButton).toBeDefined()

    await aiButton?.trigger('click')
    expect(todoStore.isDrawerOpen).toBe(true)

    await aiButton?.trigger('click')
    expect(todoStore.isDrawerOpen).toBe(true)
  })

  it('移动端应默认展示左右按钮且重置按钮可点击', async () => {
    vi.spyOn(nativeService, 'platform', 'get').mockReturnValue('web')
    setWindowWidth(390)
    const pomodoroStore = usePomodoroStore()
    const resetSpy = vi.spyOn(pomodoroStore, 'resetTimer').mockImplementation(() => {})

    const wrapper = mount(PomodoroMiniControls, {
      global: {
        stubs: {
          Button: {
            template: '<button><slot /></button>',
          },
          AiLuminaIcon: {
            template: '<span>AI</span>',
          },
        },
      },
    })

    await nextTick()

    const resetContainer = wrapper.find('div.absolute.top-3.right-3')
    expect(resetContainer.exists()).toBe(true)
    expect(resetContainer.classes()).toContain('opacity-100')

    const aiButton = wrapper.findAll('button').at(1)
    expect(aiButton?.classes()).toContain('opacity-100')

    const resetButton = wrapper.findAll('button').at(0)
    await resetButton?.trigger('click')
    expect(resetSpy).toHaveBeenCalledTimes(1)
  })
})
