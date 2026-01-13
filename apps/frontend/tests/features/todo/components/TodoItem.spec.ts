import { describe, it, expect, beforeEach } from 'vitest'
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
  let store: ReturnType<typeof useTodoStore>
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    store = useTodoStore()
  })

  const mockTodo: Todo = {
    id: '1',
    title: 'Test todo',
    completed: false,
    createdAt: new Date(),
    order: 0,
  }

  it('should render todo title', () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    expect(wrapper.text()).toContain('Test todo')
  })

  it('should emit toggle event when checkbox clicked', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n, pinia],
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
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n, pinia],
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
        editingId: '1',
        editingTitle: 'Test todo',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
    expect(wrapper.find('span').exists()).toBe(false)
  })

  it('should show parent path when searching', () => {
    store.todos = [
      { id: '1', title: 'Parent Task', completed: false, createdAt: new Date(), order: 0 },
      {
        id: '2',
        title: 'Child Task',
        completed: false,
        createdAt: new Date(),
        order: 0,
        parentId: '1',
      },
    ]

    const wrapper = mount(TodoItem, {
      props: {
        todo: store.todos[1],
        editingId: null,
        editingTitle: '',
        searchQuery: 'Child',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    expect(wrapper.text()).toContain('Parent Task')
    expect(wrapper.text()).toContain('Child Task')
  })

  it('should emit startEdit event when edit button clicked', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    const buttons = wrapper.findAll('button')
    const editBtn = buttons.find((b) => b.find('.lucide-pencil').exists())
    await editBtn?.trigger('click')

    expect(wrapper.emitted('startEdit')).toBeTruthy()
    expect(wrapper.emitted('startEdit')?.[0]).toEqual(['1', 'Test todo'])
  })

  it('should emit startEdit event when title is double clicked', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    const titleSpan = wrapper.find('span')
    await titleSpan.trigger('dblclick')

    expect(wrapper.emitted('startEdit')).toBeTruthy()
    expect(wrapper.emitted('startEdit')?.[0]).toEqual(['1', 'Test todo'])
  })

  it('should emit delete event when delete button clicked', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    const buttons = wrapper.findAll('button')
    const deleteBtn = buttons.find((b) => b.find('[class*="trash"]').exists())
    await deleteBtn?.trigger('click')

    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')?.[0]).toEqual(['1'])
  })

  it('should emit saveEdit event when save button clicked in edit mode', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: '1',
        editingTitle: 'Test todo',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    const buttons = wrapper.findAll('button')
    const saveBtn = buttons.find((b) => b.find('.lucide-check').exists())
    await saveBtn?.trigger('click')

    expect(wrapper.emitted('saveEdit')).toBeTruthy()
  })

  it('should emit cancelEdit event when cancel button clicked in edit mode', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: '1',
        editingTitle: 'Test todo',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    const buttons = wrapper.findAll('button')
    const cancelBtn = buttons.find((b) => b.find('.lucide-x').exists())
    await cancelBtn?.trigger('click')

    expect(wrapper.emitted('cancelEdit')).toBeTruthy()
  })

  it('should emit update:editingTitle when input value changes', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: '1',
        editingTitle: 'Test todo',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    const input = wrapper.find('input[type="text"]')
    await input.setValue('Updated title')

    expect(wrapper.emitted('update:editingTitle')).toBeTruthy()
    expect(wrapper.emitted('update:editingTitle')?.[0]).toEqual(['Updated title'])
  })

  it('should emit editKeydown event when keydown event occurs', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: '1',
        editingTitle: 'Test todo',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    const input = wrapper.find('input[type="text"]')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('editKeydown')).toBeTruthy()
  })

  it('should show check icon when todo is completed', () => {
    const completedTodo: Todo = { ...mockTodo, completed: true }
    const wrapper = mount(TodoItem, {
      props: {
        todo: completedTodo,
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    const checkbox = wrapper.findComponent(Checkbox)
    expect(checkbox.props('modelValue')).toBe(true)
  })

  it('should not show check icon when todo is not completed', () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    const checkbox = wrapper.findComponent(Checkbox)
    expect(checkbox.props('modelValue')).toBe(false)
  })

  it('should emit saveEdit event when input blurred', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: '1',
        editingTitle: 'Updated todo',
      },
      global: {
        plugins: [i18n, pinia],
      },
    })

    const input = wrapper.find('input[type="text"]')
    await input.trigger('blur')

    expect(wrapper.emitted('saveEdit')).toBeTruthy()
  })

  describe('expand arrow visibility', () => {
    it('should not show expand arrow when there are no children', () => {
      const wrapper = mount(TodoItem, {
        props: {
          todo: mockTodo,
          editingId: null,
          editingTitle: '',
        },
        global: {
          plugins: [i18n, pinia],
        },
      })

      const expandBtn = wrapper.find('button .lucide-chevron-right')
      expect(expandBtn.exists()).toBe(false)
      const expandBtnDown = wrapper.find('button .lucide-chevron-down')
      expect(expandBtnDown.exists()).toBe(false)
    })

    it('should show expand arrow when there are children', async () => {
      const { useTodoStore } = await import('@/features/todo/stores/todo')
      const store = useTodoStore()
      store.todos = [
        mockTodo,
        {
          id: '2',
          title: 'Child todo',
          completed: false,
          parentId: '1',
          createdAt: new Date(),
          order: 0,
        },
      ]

      const wrapper = mount(TodoItem, {
        props: {
          todo: mockTodo,
          editingId: null,
          editingTitle: '',
        },
        global: {
          plugins: [i18n, pinia],
        },
      })

      const expandBtn = wrapper.find('.lucide-chevron-right, .lucide-chevron-down')
      expect(expandBtn.exists()).toBe(true)
    })
  })

  describe('nesting levels', () => {
    it('should show add subtask button at level 0 (root)', () => {
      const wrapper = mount(TodoItem, {
        props: {
          todo: mockTodo,
          editingId: null,
          editingTitle: '',
          level: 0,
        },
        global: {
          plugins: [i18n, pinia],
        },
      })

      const buttons = wrapper.findAll('button')
      const addSubtaskBtn = buttons.find((b) => b.find('.lucide-plus').exists())
      expect(addSubtaskBtn?.exists()).toBe(true)
    })

    it('should show add subtask button at level 1', () => {
      const childTodo: Todo = { ...mockTodo, parentId: 'root' }
      const wrapper = mount(TodoItem, {
        props: {
          todo: childTodo,
          editingId: null,
          editingTitle: '',
          level: 1,
        },
        global: {
          plugins: [i18n, pinia],
        },
      })

      const buttons = wrapper.findAll('button')
      const addSubtaskBtn = buttons.find((b) => b.find('.lucide-plus').exists())
      expect(addSubtaskBtn?.exists()).toBe(true)
    })

    it('should not show add subtask button at level 2', () => {
      const grandchildTodo: Todo = { ...mockTodo, parentId: 'child' }
      const wrapper = mount(TodoItem, {
        props: {
          todo: grandchildTodo,
          editingId: null,
          editingTitle: '',
          level: 2,
        },
        global: {
          plugins: [i18n, pinia],
        },
      })

      const buttons = wrapper.findAll('button')
      const addSubtaskBtn = buttons.find((b) => b.find('.lucide-plus').exists())
      expect(addSubtaskBtn?.exists()).toBe(undefined)
    })
  })
})
