import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TodoItem from '@/features/todo/components/TodoItem.vue'
import { Checkbox } from '@/components/ui/checkbox'
import type { Todo } from '@/features/todo/stores/todo'

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
      },
    },
  },
})

describe('TodoItem', () => {
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
        plugins: [i18n],
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
        editingId: '1',
        editingTitle: 'Test todo',
      },
      global: {
        plugins: [i18n],
      },
    })

    expect(wrapper.find('input[type="text"]').exists()).toBe(true)
    expect(wrapper.find('span').exists()).toBe(false)
  })

  it('should emit startEdit event when edit button clicked', async () => {
    const wrapper = mount(TodoItem, {
      props: {
        todo: mockTodo,
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
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
        plugins: [i18n],
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
        plugins: [i18n],
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
        plugins: [i18n],
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
        plugins: [i18n],
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
        plugins: [i18n],
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
        plugins: [i18n],
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
        plugins: [i18n],
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
        plugins: [i18n],
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
        plugins: [i18n],
      },
    })

    const input = wrapper.find('input[type="text"]')
    await input.trigger('blur')

    expect(wrapper.emitted('saveEdit')).toBeTruthy()
  })
})
