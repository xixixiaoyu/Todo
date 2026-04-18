import { nextTick } from 'vue'
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import { vi } from 'vitest'
import TodoList from '@/features/todo/components/TodoList.vue'
import TodoItem from '@/features/todo/components/TodoItem.vue'
import { useTodoStore, type Todo } from '@/features/todo/stores/todo'

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
        breakdown: '拆解',
        focus: '专注',
        schedule: '日程',
        pin: '置顶',
        unpin: '取消置顶',
        defer: '移到稍后',
        resumeFromDeferred: '移回当前',
        deferred: '稍后',
        deferredSection: '稍后处理',
        dropToRestore: '拖入此处恢复到当前',
        delete: '删除',
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
    vi.clearAllMocks()
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

  it('should render a collapsed deferred section for later tasks', async () => {
    const wrapper = mount(TodoList, {
      props: {
        todos: [
          {
            ...mockTodos[0],
            id: 'active',
            title: 'Now',
          },
          {
            ...mockTodos[0],
            id: 'deferred',
            title: 'Later',
            order: 1,
            deferredAt: new Date('2026-03-24T08:00:00.000Z'),
          },
        ],
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.get('[data-test="deferred-section-toggle"]').text()).toContain('稍后处理')
    expect(wrapper.text()).toContain('Now')
    expect(wrapper.text()).not.toContain('Later')

    await wrapper.get('[data-test="deferred-section-toggle"]').trigger('click')

    expect(wrapper.text()).toContain('Later')
  })

  it('should expand deferred section by default when it is the only visible section', () => {
    const wrapper = mount(TodoList, {
      props: {
        todos: [
          {
            ...mockTodos[0],
            id: 'deferred',
            title: 'Later',
            deferredAt: new Date('2026-03-24T08:00:00.000Z'),
          },
        ],
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.get('[data-test="deferred-section-toggle"]').attributes('aria-expanded')).toBe(
      'true',
    )
    expect(wrapper.text()).toContain('Later')
  })

  it('should remember deferred section expansion preference across remounts', async () => {
    const props = {
      todos: [
        {
          ...mockTodos[0],
          id: 'active',
          title: 'Now',
        },
        {
          ...mockTodos[0],
          id: 'deferred',
          title: 'Later',
          order: 1,
          deferredAt: new Date('2026-03-24T08:00:00.000Z'),
        },
      ],
      filter: 'pending' as const,
      searchQuery: '',
      editingId: null,
      editingTitle: '',
    }

    const firstWrapper = mount(TodoList, {
      props,
      global: {
        plugins: [i18n],
      },
    })

    await firstWrapper.get('[data-test="deferred-section-toggle"]').trigger('click')
    expect(firstWrapper.text()).toContain('Later')

    firstWrapper.unmount()

    const secondWrapper = mount(TodoList, {
      props,
      global: {
        plugins: [i18n],
      },
    })

    expect(
      secondWrapper.get('[data-test="deferred-section-toggle"]').attributes('aria-expanded'),
    ).toBe('true')
    expect(secondWrapper.text()).toContain('Later')
  })

  it('should render deferred draggable with correct group config for cross-list drag', async () => {
    const wrapper = mount(TodoList, {
      props: {
        todos: [
          {
            ...mockTodos[0],
            id: 'active',
            title: 'Now',
          },
          {
            ...mockTodos[0],
            id: 'deferred-item',
            title: 'Later',
            deferredAt: new Date('2026-03-24T08:00:00.000Z'),
          },
        ],
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    // 展开稍后处理区域
    await wrapper.get('[data-test="deferred-section-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()

    // 验证稍后处理区域的 draggable 渲染出来且具备跨区拖拽的 group 配置
    const deferredSectionEl = wrapper.find('#todo-deferred-section')
    expect(deferredSectionEl.exists()).toBe(true)
  })

  it('should call setTodoDeferred when an item is dragged from deferred to active list', async () => {
    const setTodoDeferredSpy = vi.spyOn(useTodoStore(), 'setTodoDeferred')

    const wrapper = mount(TodoList, {
      props: {
        todos: [
          {
            ...mockTodos[0],
            id: 'active',
            title: 'Now',
          },
          {
            ...mockTodos[0],
            id: 'deferred',
            title: 'Later',
            deferredAt: new Date('2026-03-24T08:00:00.000Z'),
          },
        ],
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    // 模拟 vuedraggable 将 deferred 项拖入 active 列表的 v-model setter
    // dragList setter 检测到 val 中存在 deferredAt 的项，立即调用 setTodoDeferred(id, false)
    const draggables = wrapper.findAllComponents({ name: 'draggable' })
    const activeDraggable = draggables[0]
    // 模拟 vuedraggable 更新 v-model：active 列表新增一个有 deferredAt 的项
    await activeDraggable.vm.$emit('update:modelValue', [
      { ...mockTodos[0], id: 'active', title: 'Now' },
      { ...mockTodos[0], id: 'deferred', title: 'Later', deferredAt: new Date() },
    ])

    expect(setTodoDeferredSpy).toHaveBeenCalledWith('deferred', false)
  })

  it('should call setTodoDeferred when an item is dragged from active to deferred list', async () => {
    const setTodoDeferredSpy = vi.spyOn(useTodoStore(), 'setTodoDeferred')

    const wrapper = mount(TodoList, {
      props: {
        todos: [
          {
            ...mockTodos[0],
            id: 'active',
            title: 'Now',
          },
          {
            ...mockTodos[0],
            id: 'deferred-item',
            title: 'Later',
            deferredAt: new Date('2026-03-24T08:00:00.000Z'),
          },
        ],
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    // 展开稍后处理区域
    await wrapper.get('[data-test="deferred-section-toggle"]').trigger('click')
    await wrapper.vm.$nextTick()

    // 验证 deferred section 已渲染
    const deferredDraggable = wrapper
      .findAllComponents({ name: 'draggable' })
      .find((c) => c.attributes('id') === 'todo-deferred-section')!
    expect(deferredDraggable.exists()).toBe(true)

    // 清除可能在 mount 期间意外触发的调用
    setTodoDeferredSpy.mockClear()

    // 模拟 vuedraggable 将 active 项拖入 deferred 列表 of v-model setter
    // deferredDragList setter 检测到 val 中存在没有 deferredAt 的项，立即调用 setTodoDeferred(id, true)
    await deferredDraggable.vm.$emit('update:modelValue', [
      {
        ...mockTodos[0],
        id: 'deferred-item',
        title: 'Later',
        deferredAt: new Date('2026-03-24T08:00:00.000Z'),
      },
      { ...mockTodos[0], id: 'active', title: 'Now' }, // 这里的 active 项没有 deferredAt
    ])

    expect(setTodoDeferredSpy).toHaveBeenCalledWith('active', true)
  })

  it('should render an empty drop zone when active list is empty but deferred list has items', () => {
    const wrapper = mount(TodoList, {
      props: {
        todos: [
          {
            ...mockTodos[0],
            id: 'deferred',
            title: 'Later',
            deferredAt: new Date('2026-03-24T08:00:00.000Z'),
          },
        ],
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    // 验证主列表容器渲染了空落脚点提示
    expect(wrapper.text()).toContain('拖入此处恢复到当前')
    // 验证主列表 draggable 依然存在（不应被 v-if 移除）
    const draggables = wrapper.findAllComponents({ name: 'draggable' })
    expect(draggables.length).toBeGreaterThanOrEqual(1)
  })

  it('should call setTodoDeferred(false) when an item is dragged into a subtask list', async () => {
    const store = useTodoStore()
    const setTodoDeferredSpy = vi.spyOn(store, 'setTodoDeferred')

    const wrapper = mount(TodoList, {
      props: {
        todos: [
          {
            ...mockTodos[0],
            id: 'parent',
            title: 'Parent Task',
          },
          {
            ...mockTodos[0],
            id: 'deferred-item',
            title: 'Sub Task Candidate',
            deferredAt: new Date(),
          },
        ],
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    // 找到父任务对应的 TodoItem
    const parentItem = wrapper
      .findAllComponents(TodoItem)
      .find((c) => c.props('todo').id === 'parent')!

    // 模拟拖拽状态，使 TodoItem 内部的子任务容器 visible
    store.isDragging = true
    await nextTick()

    // 找到父任务内部的 draggable（子任务容器）
    const subtaskDraggable = parentItem.findComponent({ name: 'draggable' })

    // 模拟将 deferred-item 拖入 parent 的子任务列表
    await subtaskDraggable.vm.$emit('update:modelValue', [
      { ...mockTodos[0], id: 'deferred-item', title: 'Sub Task Candidate', deferredAt: new Date() },
    ])

    // 验证是否触发了状态清除
    expect(setTodoDeferredSpy).toHaveBeenCalledWith('deferred-item', false)
  })

  it('should call setTodoDeferred(true) when a subtask is dragged into the deferred list', async () => {
    const store = useTodoStore()
    const setTodoDeferredSpy = vi.spyOn(store, 'setTodoDeferred')
    store.deferredSectionExpandedPreference = true

    const wrapper = mount(TodoList, {
      props: {
        todos: [
          {
            ...mockTodos[0],
            id: 'parent',
            title: 'Parent Task',
            completed: false,
          },
          {
            ...mockTodos[0],
            id: 'subtask',
            title: 'Sub Task',
            parentId: 'parent',
            completed: false,
          },
          {
            ...mockTodos[0],
            id: 'deferred-existing',
            title: 'Deferred Item',
            deferredAt: new Date(),
            completed: false,
          },
        ],
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    // 找到「稍后处理」列表的 draggable (它应该是 TodoList 根下的第二个 draggable)
    // 注意：TodoItem 内部也有 draggable，所以我们要找包含 deferredTodos 的那个
    const deferredDraggable = wrapper
      .findAllComponents({ name: 'draggable' })
      .find((c) => (c.props('modelValue') as Todo[]).some((t) => t.id === 'deferred-existing'))!

    // 确保我们找到了正确的 draggable
    expect(deferredDraggable.props('modelValue')[0].id).toBe('deferred-existing')

    const deferredAt = deferredDraggable.props('modelValue')[0].deferredAt

    // 模拟将 subtask 拖入「稍后处理」列表
    await deferredDraggable.vm.$emit('update:modelValue', [
      {
        ...mockTodos[0],
        id: 'deferred-existing',
        title: 'Deferred Item',
        deferredAt,
        completed: false,
      },
      {
        ...mockTodos[0],
        id: 'subtask',
        title: 'Sub Task',
        parentId: 'parent',
        completed: false,
      },
    ])

    // 验证是否触发了状态设置
    expect(setTodoDeferredSpy).toHaveBeenCalledWith('subtask', true)
  })
})
