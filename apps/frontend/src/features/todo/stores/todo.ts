import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { todoApi } from '../api'

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
     * 获取所有待办事项
     */
    async function fetchTodos(): Promise<void> {
      loading.value = true
      error.value = null
      try {
        const response = await todoApi.getAll()
        todos.value = response.data.map((apiTodo) => ({
          ...apiTodo,
          createdAt: new Date(apiTodo.createdAt),
        }))
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || '获取待办事项失败'
      } finally {
        loading.value = false
      }
    }

    /**
     * 添加待办事项
     */
    async function addTodo(title: string): Promise<boolean> {
      if (!title.trim()) return false

      const trimmedTitle = title.trim()

      // 检查是否已存在相同标题的待办事项（不区分大小写）
      const exists = todos.value.some(
        (todo) => todo.title.toLowerCase() === trimmedTitle.toLowerCase(),
      )
      if (exists) return false

      loading.value = true
      error.value = null
      try {
        const response = await todoApi.create({ title: trimmedTitle })
        const newTodo: Todo = {
          ...response.data,
          createdAt: new Date(response.data.createdAt),
        }
        todos.value.unshift(newTodo)
        return true
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || '添加待办事项失败'
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

      const oldStatus = todo.completed
      const newStatus = !oldStatus
      loading.value = true
      error.value = null
      try {
        const response = await todoApi.update(id, { completed: newStatus })
        todo.completed = response.data.completed
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || '更新待办事项失败'
        // 回滚状态
        todo.completed = oldStatus
      } finally {
        loading.value = false
      }
    }

    /**
     * 删除待办事项
     */
    async function deleteTodo(id: string): Promise<void> {
      loading.value = true
      error.value = null
      try {
        await todoApi.delete(id)
        const index = todos.value.findIndex((t) => t.id === id)
        if (index !== -1) {
          todos.value.splice(index, 1)
        }
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || '删除待办事项失败'
        // 不需要回滚，因为删除是在 API 成功后才执行的
      } finally {
        loading.value = false
      }
    }

    /**
     * 更新待办事项标题
     */
    async function updateTodo(id: string, title: string): Promise<void> {
      if (!title.trim()) return
      const todo = todos.value.find((t) => t.id === id)
      if (!todo) return

      const oldTitle = todo.title
      const trimmedTitle = title.trim()
      loading.value = true
      error.value = null
      try {
        const response = await todoApi.update(id, { title: trimmedTitle })
        todo.title = response.data.title
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } }
        error.value = err.response?.data?.message || '更新待办事项失败'
        // 回滚状态
        todo.title = oldTitle
      } finally {
        loading.value = false
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
