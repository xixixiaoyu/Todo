import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Todo {
  id: string
  title: string
  completed: boolean
  createdAt: Date
}

export type FilterType = 'pending' | 'completed'

/**
 * 待办事项状态管理
 */
export const useTodoStore = defineStore(
  'todo',
  () => {
    // 状态
    const todos = ref<Todo[]>([])
    const filter = ref<FilterType>('pending')
    const searchQuery = ref('')

    // 计算属性
    const filteredTodos = computed(() => {
      let result = todos.value

      // 按完成状态过滤
      if (filter.value === 'pending') {
        result = result.filter((todo) => !todo.completed)
      } else {
        result = result.filter((todo) => todo.completed)
      }

      // 按搜索关键词过滤
      if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter((todo) => todo.title.toLowerCase().includes(query))
      }

      return result
    })

    const pendingCount = computed(() => todos.value.filter((todo) => !todo.completed).length)

    const completedCount = computed(() => todos.value.filter((todo) => todo.completed).length)

    /**
     * 添加待办事项
     * @returns 是否成功添加（false 表示已存在重复）
     */
    function addTodo(title: string): boolean {
      if (!title.trim()) return false

      const trimmedTitle = title.trim()

      // 检查是否已存在相同标题的待办事项（不区分大小写）
      const exists = todos.value.some(
        (todo) => todo.title.toLowerCase() === trimmedTitle.toLowerCase(),
      )
      if (exists) return false

      const newTodo: Todo = {
        id: crypto.randomUUID(),
        title: trimmedTitle,
        completed: false,
        createdAt: new Date(),
      }

      todos.value.unshift(newTodo)
      return true
    }

    /**
     * 切换待办事项完成状态
     */
    function toggleTodo(id: string): void {
      const todo = todos.value.find((t) => t.id === id)
      if (todo) {
        todo.completed = !todo.completed
      }
    }

    /**
     * 删除待办事项
     */
    function deleteTodo(id: string): void {
      const index = todos.value.findIndex((t) => t.id === id)
      if (index !== -1) {
        todos.value.splice(index, 1)
      }
    }

    /**
     * 更新待办事项标题
     */
    function updateTodo(id: string, title: string): void {
      if (!title.trim()) return
      const todo = todos.value.find((t) => t.id === id)
      if (todo) {
        todo.title = title.trim()
      }
    }

    /**
     * 设置过滤器
     */
    function setFilter(newFilter: FilterType): void {
      filter.value = newFilter
    }

    /**
     * 设置搜索关键词
     */
    function setSearchQuery(query: string): void {
      searchQuery.value = query
    }

    /**
     * 清除搜索
     */
    function clearSearch(): void {
      searchQuery.value = ''
    }

    return {
      // 状态
      todos,
      filter,
      searchQuery,
      // 计算属性
      filteredTodos,
      pendingCount,
      completedCount,
      // 方法
      addTodo,
      toggleTodo,
      deleteTodo,
      updateTodo,
      setFilter,
      setSearchQuery,
      clearSearch,
    }
  },
  {
    persist: {
      key: 'todos',
      storage: localStorage,
      pick: ['todos'],
    },
  },
)
