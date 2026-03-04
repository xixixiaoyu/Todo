import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'
import TodoList from '@/features/todo/components/TodoList.vue'
import TodoItem from '@/features/todo/components/TodoItem.vue'
import type { Todo } from '@/features/todo/stores/todo'

// Mock reka-ui components
vi.mock('reka-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('reka-ui')>()
  return {
    ...actual,
    TooltipProvider: { template: '<div><slot /></div>' },
    TooltipRoot: { template: '<div><slot /></div>' },
    TooltipTrigger: { template: '<div><slot /></div>' },
    TooltipContent: { template: '<div><slot /></div>' },
    TooltipPortal: { template: '<div><slot /></div>' },
    TooltipArrow: { template: '<div><slot /></div>' },
  }
})

// Mock lucide-vue-next components
vi.mock('lucide-vue-next', () => ({
  CheckCircle2: { template: '<span class="lucide-check-circle2">CheckCircle2</span>' },
  ClipboardList: { template: '<span class="lucide-clipboard-list">ClipboardList</span>' },
  SearchX: { template: '<span class="lucide-search-x">SearchX</span>' },
  ChevronDown: { template: '<span class="lucide-chevron-down">ChevronDown</span>' },
  ChevronRight: { template: '<span class="lucide-chevron-right">ChevronRight</span>' },
  ChevronLeft: { template: '<span class="lucide-chevron-left">ChevronLeft</span>' },
  CalendarClock: { template: '<span class="lucide-calendar-clock">CalendarClock</span>' },
  Clock3: { template: '<span class="lucide-clock3">Clock3</span>' },
  Plus: { template: '<span class="lucide-plus">Plus</span>' },
  Trash2: { template: '<span class="lucide-trash2">Trash2</span>' },
  Wand2: { template: '<span class="lucide-wand2">Wand2</span>' },
  Loader2: { template: '<span class="lucide-loader2">Loader2</span>' },
  Sparkles: { template: '<span class="lucide-sparkles">Sparkles</span>' },
  Target: { template: '<span class="lucide-target">Target</span>' },
  Pin: { template: '<span class="lucide-pin">Pin</span>' },
  PinOff: { template: '<span class="lucide-pin-off">PinOff</span>' },
  Pencil: { template: '<span class="lucide-pencil">Pencil</span>' },
  GripVertical: { template: '<span class="lucide-grip-vertical">GripVertical</span>' },
  Check: { template: '<span class="lucide-check">Check</span>' },
  X: { template: '<span class="lucide-x">X</span>' },
  RotateCcw: { template: '<span class="lucide-rotate-ccw">RotateCcw</span>' },
  Zap: { template: '<span class="lucide-zap">Zap</span>' },
  Timer: { template: '<span class="lucide-timer">Timer</span>' },
  Rocket: { template: '<span class="lucide-rocket">Rocket</span>' },
  Globe: { template: '<span class="lucide-globe">Globe</span>' },
}))

// Mock vue-i18n
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      todo: {
        emptyPending: '没有待办事项',
        emptyPendingDescription: '快去添加一个吧',
        emptyCompleted: '没有已完成事项',
        emptyCompletedDescription: '继续加油',
        emptySearch: '未找到相关事项',
        emptySearchDescription: '尝试换个关键词',
        addSubtask: '添加子任务',
        edit: '编辑',
      },
      common: {
        delete: '删除',
      },
    },
  },
})

describe('TodoList', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const mockTodos: Todo[] = [
    {
      id: '1',
      title: 'Todo 1',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPinned: false,
      order: 0,
      version: 0,
      pomodoroCount: 0,
    },
    {
      id: '2',
      title: 'Todo 2',
      completed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPinned: false,
      order: 1,
      version: 0,
      pomodoroCount: 0,
    },
  ]

  it('should render a list of todo items', () => {
    const wrapper = mount(TodoList, {
      props: {
        todos: mockTodos,
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    const items = wrapper.findAllComponents(TodoItem)
    expect(items).toHaveLength(2)
  })

  it('should show empty pending message when list is empty and filter is pending', () => {
    const wrapper = mount(TodoList, {
      props: {
        todos: [],
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.text()).toContain('没有待办事项')
  })

  it('should show empty completed message when list is empty and filter is completed', () => {
    const wrapper = mount(TodoList, {
      props: {
        todos: [],
        filter: 'completed',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.text()).toContain('没有已完成事项')
  })

  it('should show empty search message when list is empty and searchQuery is present', () => {
    const wrapper = mount(TodoList, {
      props: {
        todos: [],
        filter: 'pending',
        searchQuery: 'test',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.text()).toContain('未找到相关事项')
  })

  it('should bubble up events from TodoItem', async () => {
    const wrapper = mount(TodoList, {
      props: {
        todos: mockTodos,
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    const firstItem = wrapper.findComponent(TodoItem)
    await firstItem.vm.$emit('toggle', '1', false)
    expect(wrapper.emitted('toggle')).toBeTruthy()
    expect(wrapper.emitted('toggle')?.[0]).toEqual(['1', false])
  })
})
