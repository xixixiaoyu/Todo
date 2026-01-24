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
  const mockTodos: Todo[] = [
    {
      id: '1',
      title: 'Todo 1',
      completed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPinned: false,
      order: 0,
    },
    {
      id: '2',
      title: 'Todo 2',
      completed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPinned: false,
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
