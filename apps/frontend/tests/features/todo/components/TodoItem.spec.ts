import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock lucide-vue-next components
vi.mock('lucide-vue-next', () => ({
  ChevronDown: { template: '<span class="lucide-chevron-down">ChevronDown</span>' },
  ChevronRight: { template: '<span class="lucide-chevron-right">ChevronRight</span>' },
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
}))

import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import TodoItem from '@/features/todo/components/TodoItem.vue'
import { Checkbox } from '@/components/ui/checkbox'
import { useTodoStore, type Todo } from '@/features/todo/stores/todo'

// Mock vue-i18n
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      todo: {
        editPlaceholder: '编辑待办事项',
        save: '保存',
        cancel: '取消',
        edit: '编辑',
        addSubtask: '添加子任务',
      },
      common: {
        delete: '删除',
      },
    },
  },
})

describe('TodoItem', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  const mockTodo: Todo = {
    id: '1',
    title: 'Test todo',
    completed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    isPinned: false,
    order: 0,
    version: 0,
    pomodoroCount: 0,
  }

  it('should render todo title', () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.text()).toContain('Test todo')
  })

  it('should expand by default when expanded is undefined', () => {
    const parentTodo: Todo = {
      id: 'parent',
      title: 'Parent',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPinned: false,
      order: 0,
      version: 0,
      pomodoroCount: 0,
    }

    const childTodo: Todo = {
      id: 'child',
      title: 'Child',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPinned: false,
      order: 0,
      parentId: 'parent',
      version: 0,
      pomodoroCount: 0,
    }

    const wrapper = mount(TodoItem, {
      props: {
        todo: parentTodo,
        allTodos: [parentTodo, childTodo],
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.text()).toContain('Child')
    expect(wrapper.find('.lucide-chevron-down').exists()).toBe(true)
  })

  it('should emit toggle event when checkbox clicked', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    const checkbox = wrapper.findComponent(Checkbox)
    await checkbox.trigger('click')

    expect(wrapper.emitted('toggle')).toBeTruthy()
    expect(wrapper.emitted('toggle')?.[0]).toEqual(['1', false])
  })

  it('should show completed style when todo is completed', () => {
    const completedTodo: Todo = { ...mockTodo, completed: true }
    const wrapper = mount(TodoItem, {
      props: {
        todo: completedTodo,
        allTodos: [completedTodo],
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    const titleSpan = wrapper.findAll('span').find((s) => s.text() === 'Test todo')
    expect(titleSpan?.exists()).toBe(true)
    expect(titleSpan?.classes()).toContain('line-through')
    expect(titleSpan?.classes()).toContain('text-muted-foreground/50')
  })

  it('should show edit mode when editingId matches todo id', () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: '1',
        editingTitle: 'Test todo',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.find('input').element.value).toBe('Test todo')
  })

  it('should show parent path when searching', () => {
    const store = useTodoStore()
    store.todos = [
      {
        id: 'parent',
        title: 'Parent',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false,
        order: 0,
        expanded: false,
        version: 0,
        pomodoroCount: 0,
      },
      {
        id: '1',
        title: 'Child',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false,
        order: 1,
        parentId: 'parent',
        expanded: false,
        version: 0,
        pomodoroCount: 0,
      },
    ]

    const wrapper = mount(TodoItem, {
      props: {
        todo: store.todos[1],
        allTodos: store.todos,
        editingId: null,
        editingTitle: '',
        searchQuery: 'Child',
      },
      global: {
        plugins: [i18n],
      },
    })

    // parentPath.length > 0 ensures the container is rendered
    // Each item is followed by a ChevronRight
    expect(wrapper.text()).toContain('Parent')
    expect(wrapper.find('.lucide-chevron-right').exists()).toBe(true)
  })

  it('should emit startEdit event when edit button clicked', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    const editButton = wrapper.find('.lucide-pencil').element.closest('button')
    await editButton?.click()

    expect(wrapper.emitted('startEdit')).toBeTruthy()
    expect(wrapper.emitted('startEdit')?.[0]).toEqual(['1', 'Test todo'])
  })

  it('should emit startEdit event when title is double clicked', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    const titleSpan = wrapper.find('span.cursor-pointer')
    await titleSpan.trigger('dblclick')

    expect(wrapper.emitted('startEdit')).toBeTruthy()
    expect(wrapper.emitted('startEdit')?.[0]).toEqual(['1', 'Test todo'])
  })

  it('should emit delete event when delete button clicked', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
        stubs: {
          TooltipProvider: { template: '<div><slot /></div>' },
          Tooltip: { template: '<div><slot /></div>' },
          TooltipTrigger: { template: '<div><slot /></div>' },
          TooltipContent: { template: '<div><slot /></div>' },
          Trash2: { template: '<div class="lucide-trash2" />' },
        },
      },
    })

    // Try to trigger click on the button directly by index or searching for the Trash2 component stub
    const buttons = wrapper.findAll('button')
    // The delete button is the last one in the display mode (Plus, Pencil, Trash2)
    // Actually it's index 3 if we count Chevron (maybe), Checkbox, Plus, Pencil, Trash2
    const deleteButton = buttons.find((b) => b.html().includes('lucide-trash2'))
    await deleteButton?.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')?.[0]).toEqual(['1'])
  })

  it('should emit saveEdit event when save button clicked in edit mode', async () => {
    const store = useTodoStore()
    vi.spyOn(store, 'updateTodo').mockResolvedValue(true)

    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: '1',
        editingTitle: 'Updated title',
      },
      global: {
        plugins: [i18n],
      },
    })

    const saveButton = wrapper.find('.lucide-check').element.closest('button')
    await saveButton?.click()

    expect(wrapper.emitted('saveEdit')).toBeTruthy()
  })

  it('should emit cancelEdit event when cancel button clicked in edit mode', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: '1',
        editingTitle: 'Updated title',
      },
      global: {
        plugins: [i18n],
      },
    })

    const cancelButton = wrapper.find('.lucide-x').element.closest('button')
    await cancelButton?.click()

    expect(wrapper.emitted('cancelEdit')).toBeTruthy()
  })

  it('should emit update:editingTitle when input value changes', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: '1',
        editingTitle: 'Test todo',
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input')
    await input.setValue('New title')

    expect(wrapper.emitted('update:editingTitle')).toBeTruthy()
    expect(wrapper.emitted('update:editingTitle')?.[0]).toEqual(['New title'])
  })

  it('should emit editKeydown event when keydown event occurs', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: '1',
        editingTitle: 'Test todo',
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('editKeydown')).toBeTruthy()
  })

  it('should show check icon when todo is completed', () => {
    const completedTodo: Todo = { ...mockTodo, completed: true }
    const wrapper = mount(TodoItem, {
      props: {
        todo: completedTodo,
        allTodos: [completedTodo],
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.find('.lucide-check').exists()).toBe(true)
  })

  it('should not show check icon when todo is not completed', () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.find('.lucide-check').exists()).toBe(false)
  })

  it('should emit saveEdit event when input blurred', async () => {
    const store = useTodoStore()
    // Mock updateTodo to return true immediately
    vi.spyOn(store, 'updateTodo').mockResolvedValue(true)

    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        allTodos: [mockTodo],
        editingId: '1',
        editingTitle: 'Test todo',
      },
      global: {
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input')
    await input.trigger('blur')

    expect(wrapper.emitted('saveEdit')).toBeTruthy()
  })

  describe('expand arrow visibility', () => {
    it('should not show expand arrow when there are no children', () => {
      const wrapper = mount(TodoItem, {
        props: {
          todo: mockTodo,
          allTodos: [mockTodo],
          editingId: null,
          editingTitle: '',
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.find('.lucide-chevron-down').exists()).toBe(false)
      expect(wrapper.find('.lucide-chevron-right').exists()).toBe(false)
    })

    it('should show expand arrow when there are children', async () => {
      const store = useTodoStore()
      const parentTodo: Todo = { ...mockTodo, id: 'parent-1', expanded: true, version: 0 }
      const childTodo: Todo = {
        id: 'child-1',
        title: 'Child',
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false,
        order: 0,
        parentId: 'parent-1',
        version: 0,
        pomodoroCount: 0,
      }
      store.todos = [parentTodo, childTodo]

      const wrapper = mount(TodoItem, {
        props: {
          todo: parentTodo,
          allTodos: store.todos,
          editingId: null,
          editingTitle: '',
        },
        global: {
          plugins: [i18n],
        },
      })

      // When expanded, it should show ChevronDown
      expect(wrapper.find('.lucide-chevron-down').exists()).toBe(true)
    })
  })

  describe('nesting levels', () => {
    it('should show add subtask button at level 0 (root)', () => {
      const wrapper = mount(TodoItem, {
        props: {
          todo: mockTodo,
          allTodos: [mockTodo],
          editingId: null,
          editingTitle: '',
          level: 0,
        },
        global: {
          plugins: [i18n],
          stubs: {
            TooltipProvider: { template: '<div><slot /></div>' },
            Tooltip: { template: '<div><slot /></div>' },
            TooltipTrigger: { template: '<div><slot /></div>' },
            TooltipContent: { template: '<div><slot /></div>' },
          },
        },
      })

      expect(wrapper.find('.lucide-plus').exists()).toBe(true)
    })

    it('should show add subtask button at level 1', () => {
      const wrapper = mount(TodoItem, {
        props: {
          todo: mockTodo,
          allTodos: [mockTodo],
          editingId: null,
          editingTitle: '',
          level: 1,
        },
        global: {
          plugins: [i18n],
          stubs: {
            TooltipProvider: { template: '<div><slot /></div>' },
            Tooltip: { template: '<div><slot /></div>' },
            TooltipTrigger: { template: '<div><slot /></div>' },
            TooltipContent: { template: '<div><slot /></div>' },
          },
        },
      })

      expect(wrapper.find('.lucide-plus').exists()).toBe(true)
    })

    it('should not show add subtask button when todo is completed', () => {
      const completedTodo = { ...mockTodo, completed: true }
      const wrapper = mount(TodoItem, {
        props: {
          todo: completedTodo,
          allTodos: [completedTodo],
          editingId: null,
          editingTitle: '',
          level: 0,
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.find('.lucide-plus').exists()).toBe(false)
    })

    it('should not show AI breakdown button when todo is completed', () => {
      const completedTodo = { ...mockTodo, completed: true }
      const wrapper = mount(TodoItem, {
        props: {
          todo: completedTodo,
          allTodos: [completedTodo],
          editingId: null,
          editingTitle: '',
          level: 0,
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.find('.lucide-sparkles').exists()).toBe(false)
    })

    it('should not show add subtask button at level 2', () => {
      const wrapper = mount(TodoItem, {
        props: {
          todo: mockTodo,
          allTodos: [mockTodo],
          editingId: null,
          editingTitle: '',
          level: 2,
        },
        global: {
          plugins: [i18n],
        },
      })

      expect(wrapper.find('.lucide-plus').exists()).toBe(false)
    })
  })
})
