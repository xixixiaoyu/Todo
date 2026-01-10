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
 * 待办事项状态管理 (纯本地存储)
 */
export const useTodoStore = defineStore(
  'todo',
  () => {
    // 状态
    const todos = ref<Todo[]>([])
    const filter = ref<FilterType>('pending')
    const searchQuery = ref('')
    const loading = ref(false)
    const error = ref<string | null>(null)

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
     * 获取所有待办事项 (本地存储已由 pinia-plugin-persistedstate 处理)
     */
    async function fetchTodos(): Promise<void> {
      // 纯本地存储，不需要从 API 获取
      // 这里可以做一些初始化逻辑，如果有必要的话
    }

    /**
     * 添加待办事项
     */
    async function addTodo(title: string): Promise<boolean> {
      if (!title.trim()) return false

      const trimmedTitle = title.trim()

      // 检查是否已存在相同标题的未完成待办事项
      const exists = todos.value.some(
        (todo) => !todo.completed && todo.title.toLowerCase() === trimmedTitle.toLowerCase(),
      )
      if (exists) {
        error.value = 'todo.duplicate'
        return false
      }

      loading.value = true
      try {
        const newTodo: Todo = {
          id: crypto.randomUUID(),
          title: trimmedTitle,
          completed: false,
          createdAt: new Date(),
        }
        todos.value.unshift(newTodo)
        return true
      } catch {
        error.value = 'todo.addError'
        return false
      } finally {
        loading.value = false
      }
    }

    /**
     * 切换待办事项完成状态
     */
    async function toggleTodo(id: string): Promise<void> {
      const todo = todos.value.find((t) => t.id === id)
      if (!todo) return

      todo.completed = !todo.completed
    }

    /**
     * 删除待办事项
     */
    async function deleteTodo(id: string): Promise<void> {
      const index = todos.value.findIndex((t) => t.id === id)
      if (index !== -1) {
        todos.value.splice(index, 1)
      }
    }

    /**
     * 更新待办事项标题
     */
    async function updateTodo(id: string, title: string): Promise<boolean> {
      if (!title.trim()) return false
      const todo = todos.value.find((t) => t.id === id)
      if (!todo) return false

      const trimmedTitle = title.trim()

      // 如果标题没变，直接返回成功
      if (todo.title === trimmedTitle) return true

      // 检查是否已存在相同标题的未完成待办事项 (排除自身)
      const exists = todos.value.some(
        (t) => t.id !== id && !t.completed && t.title.toLowerCase() === trimmedTitle.toLowerCase(),
      )
      if (exists) {
        error.value = 'todo.duplicate'
        return false
      }

      todo.title = trimmedTitle
      return true
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

    /**
     * 清除错误
     */
    function clearError(): void {
      error.value = null
    }

    return {
      // 状态
      todos,
      filter,
      searchQuery,
      loading,
      error,
      // 计算属性
      filteredTodos,
      pendingCount,
      completedCount,
      // 方法
      fetchTodos,
      addTodo,
      toggleTodo,
      deleteTodo,
      updateTodo,
      setFilter,
      setSearchQuery,
      clearSearch,
      clearError,
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
