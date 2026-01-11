import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Todo {
  id: string
  title: string
  completed: boolean
  createdAt: Date
  parentId?: string | null
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
    const isDrawerOpen = ref(false)

    // 计算属性
    const filteredTodos = computed(() => {
      const query = searchQuery.value.trim().toLowerCase()

      return todos.value
        .filter((todo) => {
          const matchesFilter = filter.value === 'pending' ? !todo.completed : todo.completed
          const matchesSearch = !query || todo.title.toLowerCase().includes(query)
          return matchesFilter && matchesSearch
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    })

    const pendingCount = computed(() => todos.value.filter((todo) => !todo.completed).length)

    const completedCount = computed(() => todos.value.filter((todo) => todo.completed).length)

    /**
     * 检查是否存在重复的未完成待办事项
     */
    function isDuplicate(title: string, excludeId?: string): boolean {
      const trimmedTitle = title.trim().toLowerCase()
      return todos.value.some(
        (todo) =>
          todo.id !== excludeId && !todo.completed && todo.title.toLowerCase() === trimmedTitle,
      )
    }

    /**
     * 获取所有待办事项
     */
    async function fetchTodos(): Promise<void> {
      // 纯本地存储
    }

    /**
     * 添加待办事项
     */
    async function addTodo(title: string, parentId: string | null = null): Promise<boolean> {
      const trimmedTitle = title.trim()
      if (!trimmedTitle) return false

      if (isDuplicate(trimmedTitle)) {
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
          parentId,
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

      // 如果是父任务，同步切换所有子任务
      const children = todos.value.filter((t) => t.parentId === id)
      children.forEach((child) => {
        child.completed = todo.completed
      })

      // 如果是子任务，检查父任务状态
      if (todo.parentId) {
        updateParentStatus(todo.parentId)
      }
    }

    /**
     * 递归更新父任务状态
     */
    function updateParentStatus(parentId: string): void {
      const parent = todos.value.find((t) => t.id === parentId)
      if (!parent) return

      const siblings = todos.value.filter((t) => t.parentId === parentId)
      const allCompleted = siblings.length > 0 && siblings.every((s) => s.completed)

      if (parent.completed !== allCompleted) {
        parent.completed = allCompleted
        // 继续向上更新祖先任务
        if (parent.parentId) {
          updateParentStatus(parent.parentId)
        }
      }
    }

    /**
     * 删除待办事项
     */
    async function deleteTodo(id: string): Promise<void> {
      const todo = todos.value.find((t) => t.id === id)
      if (!todo) return

      const parentId = todo.parentId

      // 递归删除子任务
      const children = todos.value.filter((t) => t.parentId === id)
      for (const child of children) {
        await deleteTodo(child.id)
      }

      // 删除自己
      const currentIndex = todos.value.findIndex((t) => t.id === id)
      if (currentIndex !== -1) {
        todos.value.splice(currentIndex, 1)
      }

      // 如果被删除的是子任务，更新父任务状态
      if (parentId) {
        updateParentStatus(parentId)
      }
    }

    /**
     * 更新待办事项标题
     */
    async function updateTodo(id: string, title: string): Promise<boolean> {
      const trimmedTitle = title.trim()
      if (!trimmedTitle) return false

      const todo = todos.value.find((t) => t.id === id)
      if (!todo || todo.title === trimmedTitle) return !!todo

      if (isDuplicate(trimmedTitle, id)) {
        error.value = 'todo.duplicate'
        return false
      }

      todo.title = trimmedTitle
      return true
    }

    /**
     * 设置侧边栏状态
     */
    function setDrawerOpen(open: boolean): void {
      isDrawerOpen.value = open
    }

    /**
     * 切换侧边栏状态
     */
    function toggleDrawer(): void {
      isDrawerOpen.value = !isDrawerOpen.value
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
      isDrawerOpen,
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
      setDrawerOpen,
      toggleDrawer,
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
      pick: ['todos', 'isDrawerOpen'],
    },
  },
)
