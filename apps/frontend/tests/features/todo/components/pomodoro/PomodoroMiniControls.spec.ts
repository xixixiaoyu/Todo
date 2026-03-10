import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PomodoroMiniControls from '@/features/todo/components/pomodoro/PomodoroMiniControls.vue'
import { useTodoStore } from '@/features/todo/stores/todo'
import { nativeService } from '@/services/native'

vi.mock('lucide-vue-next', () => ({
  X: { template: '<span>X</span>' },
}))

describe('PomodoroMiniControls', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    vi.restoreAllMocks()
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
})
