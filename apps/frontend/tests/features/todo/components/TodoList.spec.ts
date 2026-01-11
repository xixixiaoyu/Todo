import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import TodoList from '@/features/todo/components/TodoList.vue'
import TodoItem from '@/features/todo/components/TodoItem.vue'
import type { Todo } from '@/features/todo/stores/todo'

// Mock vue-i18n
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  messages: {
    'zh-CN': {
      todo: {
        emptyPending: '没有待办事项',
        emptyCompleted: '没有已完成事项',
        emptySearch: '未找到相关事项',
      },
    },
  },
})

describe('TodoList', () => {
  const mockTodos: Todo[] = [
    {
      id: '1',
      title: 'Todo 1',
      completed: false,
      createdAt: new Date(),
      order: 0,
    },
    {
      id: '2',
      title: 'Todo 2',
      completed: true,
      createdAt: new Date(),
      order: 1,
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
        todos: [mockTodos[0]],
        filter: 'pending',
        searchQuery: '',
        editingId: null,
        editingTitle: '',
      },
      global: {
        plugins: [i18n],
      },
    })

    const item = wrapper.findComponent(TodoItem)

    // Test toggle event
    await item.vm.$emit('toggle', '1', false)
    expect(wrapper.emitted('toggle')).toBeTruthy()
    expect(wrapper.emitted('toggle')?.[0]).toEqual(['1', false])

    // Test delete event
    await item.vm.$emit('delete', '1')
    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')?.[0]).toEqual(['1'])

    // Test startEdit event
    await item.vm.$emit('startEdit', '1', 'Todo 1')
    expect(wrapper.emitted('startEdit')).toBeTruthy()
    expect(wrapper.emitted('startEdit')?.[0]).toEqual(['1', 'Todo 1'])

    // Test saveEdit event
    await item.vm.$emit('saveEdit')
    expect(wrapper.emitted('saveEdit')).toBeTruthy()

    // Test cancelEdit event
    await item.vm.$emit('cancelEdit')
    expect(wrapper.emitted('cancelEdit')).toBeTruthy()

    // Test update:editingTitle event
    await item.vm.$emit('update:editingTitle', 'New Title')
    expect(wrapper.emitted('update:editingTitle')).toBeTruthy()
    expect(wrapper.emitted('update:editingTitle')?.[0]).toEqual(['New Title'])

    // Test editKeydown event
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    await item.vm.$emit('editKeydown', event)
    expect(wrapper.emitted('editKeydown')).toBeTruthy()
    expect(wrapper.emitted('editKeydown')?.[0]).toEqual([event])
  })
})
