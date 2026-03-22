import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { mount } from '@vue/test-utils'
import { reactive, ref } from 'vue'
import TodoItemActions from '@/features/todo/components/TodoItemActions.vue'
import { common } from '@/i18n/locales/zh-CN/common'
import { todo } from '@/i18n/locales/zh-CN/todo'
import { pomodoro } from '@/i18n/locales/zh-CN/pomodoro'
import type { Todo } from '@/features/todo/stores/todo'

const isMobileMock = ref(false)
const todoStoreMock = reactive({
  filter: 'pending',
  togglePin: vi.fn(),
  restoreTodo: vi.fn(),
  updateTodoSchedule: vi.fn(),
})
const pomodoroStoreMock = reactive({
  activeTodoId: null as string | null,
  isMiniMode: false,
  startFocus: vi.fn(),
})

vi.mock('@/composables/useWindowSize', () => ({
  useIsMobile: () => ({ isMobile: isMobileMock }),
}))

vi.mock('@/features/todo/stores/todo', () => ({
  useTodoStore: () => todoStoreMock,
}))

vi.mock('@/features/todo/stores/pomodoro', () => ({
  usePomodoroStore: () => pomodoroStoreMock,
}))

vi.mock('lucide-vue-next', () => ({
  RotateCcw: { template: '<span class="lucide-rotate-ccw">RotateCcw</span>' },
  Trash2: { template: '<span class="lucide-trash2">Trash2</span>' },
  Loader2: { template: '<span class="lucide-loader2">Loader2</span>' },
  Wand2: { template: '<span class="lucide-wand2">Wand2</span>' },
  Target: { template: '<span class="lucide-target">Target</span>' },
  X: { template: '<span class="lucide-x">X</span>' },
  ChevronRight: { template: '<span class="lucide-chevron-right">ChevronRight</span>' },
  ChevronDown: { template: '<span class="lucide-chevron-down">ChevronDown</span>' },
  ChevronLeft: { template: '<span class="lucide-chevron-left">ChevronLeft</span>' },
  Zap: { template: '<span class="lucide-zap">Zap</span>' },
  Timer: { template: '<span class="lucide-timer">Timer</span>' },
  Rocket: { template: '<span class="lucide-rocket">Rocket</span>' },
  Globe: { template: '<span class="lucide-globe">Globe</span>' },
  CalendarClock: { template: '<span class="lucide-calendar-clock">CalendarClock</span>' },
  Pin: { template: '<span class="lucide-pin">Pin</span>' },
  PinOff: { template: '<span class="lucide-pin-off">PinOff</span>' },
  Pencil: { template: '<span class="lucide-pencil">Pencil</span>' },
  Plus: { template: '<span class="lucide-plus">Plus</span>' },
  MoreHorizontal: { template: '<span class="lucide-more-horizontal">MoreHorizontal</span>' },
}))

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      common,
      todo,
      pomodoro,
    },
  },
})

describe('TodoItemActions', () => {
  const resetBodyScrollLockState = () => {
    document.body.style.overflow = ''
    document.body.style.touchAction = ''
    delete document.body.dataset.todoSheetLockCount
    delete document.body.dataset.todoSheetPrevOverflow
    delete document.body.dataset.todoSheetPrevTouchAction
  }

  const mockTodo: Todo = {
    id: 'todo-1',
    title: 'Test todo',
    completed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    isPinned: false,
    order: 0,
    version: 0,
    pomodoroCount: 0,
  }

  const mountComponent = () =>
    mount(TodoItemActions, {
      props: {
        todo: mockTodo,
        isBreakingDown: false,
      },
      global: {
        plugins: [i18n],
        stubs: {
          Teleport: true,
          Transition: { template: '<div><slot /></div>' },
          TooltipProvider: { template: '<div><slot /></div>' },
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
          Popover: { props: ['open'], template: '<div><slot v-if="open" /></div>' },
          PopoverTrigger: { template: '<div><slot /></div>' },
          PopoverContent: { template: '<div><slot /></div>' },
          PomodoroModeSelector: { template: '<div><slot /></div>' },
          TodoSchedulePopover: { template: '<div class="todo-schedule-popover" />' },
        },
      },
    })

  beforeEach(() => {
    isMobileMock.value = false
    todoStoreMock.filter = 'pending'
    todoStoreMock.togglePin.mockClear()
    todoStoreMock.restoreTodo.mockClear()
    todoStoreMock.updateTodoSchedule.mockClear()
    pomodoroStoreMock.activeTodoId = null
    pomodoroStoreMock.isMiniMode = false
    pomodoroStoreMock.startFocus.mockClear()
    resetBodyScrollLockState()
  })

  afterEach(() => {
    resetBodyScrollLockState()
  })

  it('renders desktop actions and toggles pin from the desktop toolbar', async () => {
    const wrapper = mountComponent()
    const desktopActions = wrapper.get('[data-test="desktop-actions"]')

    expect(wrapper.find('.lucide-more-horizontal').exists()).toBe(false)
    expect(wrapper.find('.lucide-pin').exists()).toBe(true)
    expect(wrapper.text()).toContain('专注')
    expect(wrapper.text()).toContain('时间设置')
    expect(desktopActions.classes()).toContain('invisible')
    expect(desktopActions.classes()).toContain('opacity-0')
    expect(desktopActions.classes()).toContain('group-hover:visible')
    expect(desktopActions.classes()).toContain('group-focus-within:visible')

    const pinButton = wrapper
      .findAll('button')
      .find((button) => button.html().includes('lucide-pin'))

    expect(pinButton).toBeTruthy()
    await pinButton!.trigger('click')

    expect(todoStoreMock.togglePin).toHaveBeenCalledWith('todo-1')
  })

  it('opens the mobile sheet and locks body scroll until it closes', async () => {
    isMobileMock.value = true
    const wrapper = mountComponent()

    const moreButton = wrapper
      .findAll('button')
      .find((button) => button.html().includes('lucide-more-horizontal'))

    expect(moreButton).toBeTruthy()
    await moreButton!.trigger('click')

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.style.touchAction).toBe('none')
    expect(document.body.dataset.todoSheetLockCount).toBe('1')
    expect(wrapper.text()).toContain('专注')
    expect(wrapper.text()).toContain('删除')

    const closeButton = wrapper
      .findAll('button')
      .find((button) => button.html().includes('lucide-x'))

    expect(closeButton).toBeTruthy()
    await closeButton!.trigger('click')

    expect(document.body.style.overflow).toBe('')
    expect(document.body.style.touchAction).toBe('')
    expect(document.body.dataset.todoSheetLockCount).toBeUndefined()
  })

  it('keeps trash mode actions separate from the normal sheet', async () => {
    todoStoreMock.filter = 'trash'

    const wrapper = mountComponent()

    expect(wrapper.find('.lucide-rotate-ccw').exists()).toBe(true)
    expect(wrapper.find('.lucide-trash2').exists()).toBe(true)

    const restoreButton = wrapper
      .findAll('button')
      .find((button) => button.html().includes('lucide-rotate-ccw'))

    expect(restoreButton).toBeTruthy()
    await restoreButton!.trigger('click')

    expect(todoStoreMock.restoreTodo).toHaveBeenCalledWith('todo-1')

    const deleteButton = wrapper
      .findAll('button')
      .find((button) => button.html().includes('lucide-trash2'))

    expect(deleteButton).toBeTruthy()
    await deleteButton!.trigger('click')

    expect(wrapper.emitted('permanentDelete')).toBeTruthy()
  })
})
