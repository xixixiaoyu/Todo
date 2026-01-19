import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { getAIStaticResponse } from '@/services/ai'

export interface Todo {
  id: string
  title: string
  completed: boolean
  createdAt: Date
  parentId?: string | null
  order: number
  isPinned?: boolean
  expanded?: boolean
  isProposed?: boolean
  isProposedDelete?: boolean
}

export interface ProposedTodoChange {
  id: string
  type: 'add' | 'update' | 'delete' | 'toggle' | 'pin'
  data: Partial<Todo> & { title?: string; parentId?: string | null }
}

export type FilterType = 'pending' | 'completed'
export type ViewMode = 'list' | 'visual'

/**
 * 待办事项状态管理 (纯本地存储)
 */
export const useTodoStore = defineStore(
  'todo',
  () => {
    // 状态
    const todos = ref<Todo[]>([])
    const filter = ref<FilterType>('pending')
    const viewMode = ref<ViewMode>('list')
    const searchQuery = ref('')
    const loading = ref(false)
    const error = ref<string | null>(null)
    const isDrawerOpen = ref(false)
    const isSilencingToast = ref(false)
    const proposedChanges = ref<ProposedTodoChange[]>([])
    const isAllExpanded = computed(() => {
      // 获取当前过滤/搜索条件下的所有父节点
      const currentParentTodos = filteredTodos.value.filter((t) =>
        todos.value.some((child) => (child.parentId ?? null) === t.id),
      )

      if (currentParentTodos.length === 0) return false
      // 只要有一个可见的父节点是展开的，图标就显示“全部收起”
      return currentParentTodos.some((t) => (t.expanded ?? true) !== false)
    })

    // 搜索时自动展开所有项
    watch(searchQuery, (newQuery) => {
      if (newQuery.trim()) {
        todos.value.forEach((todo) => {
          todo.expanded = true
        })
      }
    })

    // 计算属性
    const filteredTodos = computed(() => {
      return applyFilterAndSort(todos.value)
    })

    const previewTodos = computed(() => {
      if (proposedChanges.value.length === 0) return filteredTodos.value

      const result = todos.value.map((t) => ({ ...t }))

      for (const change of proposedChanges.value) {
        if (change.type === 'add') {
          result.push({
            id: change.id,
            title: change.data.title || '',
            completed: false,
            createdAt: new Date(),
            parentId: change.data.parentId,
            order: result.length,
            isProposed: true,
            expanded: true,
          })
        } else if (change.type === 'update') {
          const todo = result.find((t) => t.id === change.data.id)
          if (todo) {
            if (change.data.title) todo.title = change.data.title
            todo.isProposed = true
          }
        } else if (change.type === 'delete') {
          const todo = result.find((t) => t.id === change.data.id)
          if (todo) {
            todo.isProposedDelete = true
          }
        } else if (change.type === 'toggle') {
          const todo = result.find((t) => t.id === change.data.id)
          if (todo) {
            todo.completed = !todo.completed
            todo.isProposed = true
          }
        } else if (change.type === 'pin') {
          const todo = result.find((t) => t.id === change.data.id)
          if (todo) {
            todo.isPinned = !todo.isPinned
            todo.isProposed = true
          }
        }
      }

      return applyFilterAndSort(result)
    })

    /**
     * 对任务列表应用当前的过滤、搜索和排序规则
     */
    function applyFilterAndSort(items: Todo[]): Todo[] {
      const query = searchQuery.value.trim().toLowerCase()

      return items
        .filter((todo) => {
          const matchesFilter = filter.value === 'pending' ? !todo.completed : todo.completed
          // 如果是建议修改的任务，强制显示在当前视图中（除非被搜索过滤）
          const isProposedAction = todo.isProposed || todo.isProposedDelete
          const matchesSearch = !query || todo.title.toLowerCase().includes(query)

          if (isProposedAction) return matchesSearch
          return matchesFilter && matchesSearch
        })
        .sort((a, b) => {
          // 1. 置顶优先
          if (a.isPinned && !b.isPinned) return -1
          if (!a.isPinned && b.isPinned) return 1
          // 2. 其次按 order 排序
          return (a.order ?? 0) - (b.order ?? 0)
        })
    }

    const pendingCount = computed(() => todos.value.filter((todo) => !todo.completed).length)

    const completedCount = computed(() => todos.value.filter((todo) => todo.completed).length)

    /**
     * 检查是否存在重复的未完成待办事项 (同层级)
     */
    function isDuplicate(
      title: string,
      parentId: string | null = null,
      excludeId?: string,
    ): boolean {
      const trimmedTitle = title.trim().toLowerCase()
      return todos.value.some(
        (todo) =>
          todo.id !== excludeId &&
          (todo.parentId ?? null) === parentId &&
          !todo.completed &&
          todo.title.toLowerCase() === trimmedTitle,
      )
    }

    /**
     * 获取所有待办事项
     */
    async function fetchTodos(): Promise<void> {
      // 纯本地存储，初始化 order
      todos.value.forEach((todo, index) => {
        if (todo.order === undefined) {
          todo.order = index
        }
      })
    }

    /**
     * 重新排序
     */
    function reorderTodos(orderedIds: string[], parentId: string | null = null): void {
      // 1. 检查是否存在导致重复名称的移动
      for (const id of orderedIds) {
        const todo = todos.value.find((t) => t.id === id)
        if (todo && (todo.parentId ?? null) !== parentId) {
          // 只有当父级发生变化时才检查重复
          if (isDuplicate(todo.title, parentId, id)) {
            error.value = 'todo.duplicate'
            return // 终止整个排序操作，防止出现同名
          }
        }
      }

      // 2. 执行排序和父级更新
      orderedIds.forEach((id, index) => {
        const todo = todos.value.find((t) => t.id === id)
        if (todo) {
          todo.order = index
          // 如果提供了 parentId（包括 null），则更新它
          if (parentId !== undefined) {
            todo.parentId = parentId
          }
        }
      })
    }

    /**
     * 添加待办事项
     */
    async function addTodo(
      title: string,
      parentId: string | null = null,
      id?: string,
    ): Promise<string | null> {
      const trimmedTitle = title.trim()
      if (!trimmedTitle) return null

      if (isDuplicate(trimmedTitle, parentId)) {
        error.value = 'todo.duplicate'
        return null
      }

      // 禁止向已完成的任务添加子任务
      if (parentId) {
        const parent = todos.value.find((t) => t.id === parentId)
        if (parent?.completed) {
          error.value = 'todo.parentCompleted'
          return null
        }
      }

      loading.value = true
      try {
        const minOrder =
          todos.value.length > 0 ? Math.min(...todos.value.map((t) => t.order ?? 0)) : 0

        const newTodo: Todo = {
          id: id || crypto.randomUUID(),
          title: trimmedTitle,
          completed: false,
          createdAt: new Date(),
          parentId,
          order: minOrder - 1,
          expanded: true,
        }
        todos.value.unshift(newTodo)
        return newTodo.id
      } catch {
        error.value = 'todo.addError'
        return null
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

      // 递归切换所有子任务状态
      const toggleChildren = (parentId: string, completed: boolean) => {
        const children = todos.value.filter((t) => t.parentId === parentId)
        children.forEach((child) => {
          child.completed = completed
          toggleChildren(child.id, completed)
        })
      }

      toggleChildren(id, todo.completed)

      // 如果是子任务，检查父任务状态
      if (todo.parentId) {
        updateParentStatus(todo.parentId)
      }
    }

    /**
     * 切换置顶状态
     */
    async function togglePin(id: string): Promise<void> {
      const todo = todos.value.find((t) => t.id === id)
      if (todo) {
        todo.isPinned = !todo.isPinned
      }
    }

    /**
     * 使用 AI 拆解任务
     */
    async function breakdownTaskWithAI(id: string): Promise<void> {
      const todo = todos.value.find((t) => t.id === id)
      if (!todo) return

      loading.value = true
      try {
        const prompt = `请将以下待办任务拆解为 3-5 个具体的子任务。只需返回子任务标题列表，每行一个。任务名称：${todo.title}`
        const response = await getAIStaticResponse([{ role: 'user', content: prompt }])

        const subtasks = response.content
          .split('\n')
          .map((s) => s.replace(/^\d+\.\s*|[-*]\s*/, '').trim())
          .filter((s) => s.length > 0)

        for (const subtask of subtasks) {
          await addTodo(subtask, id)
        }

        todo.expanded = true
      } catch (err) {
        console.error('AI breakdown failed:', err)
        error.value = 'AI breakdown failed'
      } finally {
        loading.value = false
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

      if (isDuplicate(trimmedTitle, todo.parentId ?? null, id)) {
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

    function setSilencingToast(silence: boolean): void {
      isSilencingToast.value = silence
    }

    function toggleAllExpansion(): void {
      const targetState = !isAllExpanded.value
      // 只对当前过滤/搜索条件下的可见节点进行批量操作
      filteredTodos.value.forEach((todo) => {
        todo.expanded = targetState
      })
    }

    function toggleTodoExpansion(id: string): void {
      const todo = todos.value.find((t) => t.id === id)
      if (todo) {
        todo.expanded = !(todo.expanded ?? true)
      }
    }

    /**
     * 获取待办事项的父级路径
     */
    function getTodoPath(todoId: string): string[] {
      const path: string[] = []
      let current = todos.value.find((t) => t.id === todoId)
      while (current?.parentId) {
        const parent = todos.value.find((t) => t.id === current!.parentId)
        if (parent) {
          path.unshift(parent.title)
          current = parent
        } else {
          break
        }
      }
      return path
    }

    const hasProposedChanges = computed(() => proposedChanges.value.length > 0)

    function addProposedChanges(changes: ProposedTodoChange[]): void {
      proposedChanges.value = [...proposedChanges.value, ...changes]
    }

    function clearProposedChanges(): void {
      proposedChanges.value = []
    }

    async function applyProposedChanges(): Promise<void> {
      if (proposedChanges.value.length === 0) return

      for (const change of proposedChanges.value) {
        switch (change.type) {
          case 'add':
            if (change.data.title) {
              await addTodo(change.data.title, change.data.parentId ?? null, change.id)
            }
            break
          case 'update':
            if (change.data.id && change.data.title)
              await updateTodo(change.data.id, change.data.title)
            break
          case 'delete':
            if (change.data.id) await deleteTodo(change.data.id)
            break
          case 'toggle':
            if (change.data.id) await toggleTodo(change.data.id)
            break
          case 'pin':
            if (change.data.id) await togglePin(change.data.id)
            break
        }
      }
      clearProposedChanges()
    }

    function discardProposedChanges(): void {
      clearProposedChanges()
    }

    return {
      // 状态
      todos,
      filter,
      viewMode,
      searchQuery,
      loading,
      error,
      isDrawerOpen,
      isSilencingToast,
      isAllExpanded,
      proposedChanges,
      // 计算属性
      filteredTodos,
      pendingCount,
      completedCount,
      hasProposedChanges,
      previewTodos,
      // 方法
      isDuplicate,
      fetchTodos,
      addTodo,
      toggleTodo,
      togglePin,
      breakdownTaskWithAI,
      deleteTodo,
      updateTodo,
      reorderTodos,
      setDrawerOpen,
      toggleDrawer,
      setFilter,
      setSearchQuery,
      clearSearch,
      clearError,
      setSilencingToast,
      toggleAllExpansion,
      toggleTodoExpansion,
      getTodoPath,
      addProposedChanges,
      clearProposedChanges,
      applyProposedChanges,
      discardProposedChanges,
    }
  },
  {
    persist: {
      key: 'todos',
      storage: localStorage,
      pick: ['todos', 'filter', 'isDrawerOpen', 'viewMode'],
    },
  },
)
