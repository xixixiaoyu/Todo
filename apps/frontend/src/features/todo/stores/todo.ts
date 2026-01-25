import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { debounce } from 'lodash-es'
import { getAIStaticResponse } from '@/services/ai'
import { todoApi } from '../api'
import type { Todo as SharedTodo } from '@my-app/shared'

export interface Todo extends SharedTodo {
  completedAt?: Date
  deletedAt?: Date
  parentId?: string | null
  expanded?: boolean
  isProposed?: boolean
  isProposedDelete?: boolean
  syncStatus?: 'synced' | 'pending' | 'error'
}

export interface ProposedTodoChange {
  id: string
  type: 'add' | 'update' | 'delete' | 'toggle' | 'pin'
  data: Partial<Todo> & { title?: string; parentId?: string | null }
}

export type FilterType = 'pending' | 'completed'
export type ViewMode = 'list' | 'visual' | 'stats'

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
            updatedAt: new Date(),
            isPinned: false,
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
            if (todo.completed) {
              todo.completedAt = new Date()
            } else {
              delete todo.completedAt
            }
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
          // 排除已删除的任务
          if (todo.deletedAt) return false

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
          // 2. 未完成优先
          if (!a.completed && b.completed) return -1
          if (a.completed && !b.completed) return 1
          // 3. 其次按 order 排序
          return (a.order ?? 0) - (b.order ?? 0)
        })
    }

    const pendingCount = computed(
      () => todos.value.filter((todo) => !todo.completed && !todo.deletedAt).length,
    )

    const completedCount = computed(
      () => todos.value.filter((todo) => todo.completed && !todo.deletedAt).length,
    )

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
          !todo.deletedAt &&
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
     * 防抖同步 (用于频繁操作)
     */
    const debouncedSync = debounce(() => void sync(), 1000)

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
          const hasChanged =
            todo.order !== index || (parentId !== undefined && todo.parentId !== parentId)
          if (hasChanged) {
            todo.order = index
            if (parentId !== undefined) {
              todo.parentId = parentId
            }
            todo.updatedAt = new Date()
            todo.syncStatus = 'pending'
          }
        }
      })

      // 尝试自动同步 (防抖)
      debouncedSync()
    }

    /**
     * 生成唯一 ID (兼容非安全环境)
     */
    function generateId(): string {
      const c =
        typeof window !== 'undefined'
          ? window.crypto
          : typeof crypto !== 'undefined'
            ? crypto
            : null
      if (c?.randomUUID) {
        return c.randomUUID()
      }
      if (c?.getRandomValues) {
        return Array.from(c.getRandomValues(new Uint8Array(16)))
          .map((b, i) =>
            (i === 6 ? (b & 0x0f) | 0x40 : i === 8 ? (b & 0x3f) | 0x80 : b)
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')
          .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
      }
      // 极低概率下的最后兜底
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === 'x' ? r : (r & 0x3) | 0x8
        return v.toString(16)
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
          id: id || generateId(),
          title: trimmedTitle,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          parentId,
          order: minOrder - 1,
          expanded: true,
          syncStatus: 'pending',
        }
        todos.value.unshift(newTodo)

        // 尝试自动同步 (防抖)
        debouncedSync()

        return newTodo.id
      } catch (err) {
        console.error('Failed to add todo:', err)
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
      if (todo.completed) {
        todo.completedAt = new Date()
      } else {
        delete todo.completedAt
      }
      todo.updatedAt = new Date()
      todo.syncStatus = 'pending'

      // 递归切换所有子任务状态
      const toggleChildren = (parentId: string, completed: boolean) => {
        const children = todos.value.filter((t) => t.parentId === parentId)
        children.forEach((child) => {
          child.completed = completed
          if (completed) {
            child.completedAt = new Date()
          } else {
            delete child.completedAt
          }
          child.updatedAt = new Date()
          child.syncStatus = 'pending'
          toggleChildren(child.id, completed)
        })
      }

      toggleChildren(id, todo.completed)

      // 如果是子任务，检查父任务状态
      if (todo.parentId) {
        updateParentStatus(todo.parentId)
      }

      // 尝试自动同步 (防抖)
      debouncedSync()
    }

    /**
     * 切换置顶状态
     */
    async function togglePin(id: string): Promise<void> {
      const todo = todos.value.find((t) => t.id === id)
      if (todo) {
        todo.isPinned = !todo.isPinned
        todo.updatedAt = new Date()
        todo.syncStatus = 'pending'
        // 尝试自动同步 (防抖)
        debouncedSync()
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

      const siblings = todos.value.filter((t) => t.parentId === parentId && !t.deletedAt)
      const allCompleted = siblings.length > 0 && siblings.every((s) => s.completed)

      if (parent.completed !== allCompleted) {
        parent.completed = allCompleted
        if (allCompleted) {
          parent.completedAt = new Date()
        } else {
          delete parent.completedAt
        }
        parent.updatedAt = new Date()
        parent.syncStatus = 'pending'
        // 继续向上更新祖先任务
        if (parent.parentId) {
          updateParentStatus(parent.parentId)
        }
      }
    }

    /**
     * 删除待办事项 (逻辑删除)
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

      // 逻辑删除
      todo.deletedAt = new Date()
      todo.updatedAt = new Date()
      todo.syncStatus = 'pending'

      // 如果被删除的是子任务，更新父任务状态
      if (parentId) {
        updateParentStatus(parentId)
      }

      // 尝试自动同步 (防抖)
      debouncedSync()
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
      todo.updatedAt = new Date()
      todo.syncStatus = 'pending'
      // 尝试自动同步 (防抖)
      debouncedSync()
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

    const lastSyncAt = ref<string | null>(null)

    /**
     * 将本地 Todo 转换为共享层 Schema 格式，去除 UI 状态字段
     */
    function toSharedTodo(todo: Todo): SharedTodo {
      return {
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        order: todo.order,
        isPinned: !!todo.isPinned,
        parentId: todo.parentId || null,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        completedAt: todo.completedAt || null,
        deletedAt: todo.deletedAt || null,
      }
    }

    /**
     * 同步数据到云端
     */
    async function sync(): Promise<void> {
      if (loading.value) return

      const authStore = (await import('@/features/auth/stores/auth')).useAuthStore()
      authStore.hydrateFromStorage()
      if (!authStore.isAuthenticated) return

      loading.value = true
      try {
        // 获取当前 Socket ID 用于排除通知
        const { useSocket } = await import('@/composables/useSocket')
        const { socketId, connect: connectSocket } = useSocket()

        // 确保同步前 Socket 是连通的
        connectSocket()

        console.log('[Sync] Socket ID:', socketId.value)

        // 找出所有待同步的变更 (pending 或 还没 syncStatus 的)
        const pendingTodos = todos.value.filter((t) => t.syncStatus !== 'synced')

        const response = await todoApi.sync(
          {
            todos: pendingTodos.map(toSharedTodo),
            lastSyncAt: lastSyncAt.value || undefined,
          },
          socketId.value,
        )

        // 更新本地状态
        const { synced, deletedIds, serverTime } = response.data

        // 1. 标记刚才上传成功的为 synced
        pendingTodos.forEach((t) => (t.syncStatus = 'synced'))

        // 2. 合并服务器端的变更
        if (synced && Array.isArray(synced)) {
          synced.forEach((serverTodo: SharedTodo) => {
            const index = todos.value.findIndex((t) => t.id === serverTodo.id)
            const todoData: Todo = {
              id: serverTodo.id,
              title: serverTodo.title,
              completed: serverTodo.completed,
              order: serverTodo.order,
              isPinned: serverTodo.isPinned,
              parentId: serverTodo.parentId,
              createdAt: new Date(serverTodo.createdAt),
              updatedAt: new Date(serverTodo.updatedAt),
              completedAt: serverTodo.completedAt ? new Date(serverTodo.completedAt) : undefined,
              deletedAt: serverTodo.deletedAt ? new Date(serverTodo.deletedAt) : undefined,
              syncStatus: 'synced' as const,
            }

            if (index !== -1) {
              todos.value[index] = { ...todos.value[index], ...todoData }
            } else {
              todos.value.push(todoData)
            }
          })
        }

        // 3. 处理服务器告知已删除的 ID (物理删除)
        if (deletedIds && deletedIds.length > 0) {
          const deletedSet = new Set(deletedIds)
          todos.value = todos.value.filter((t) => !deletedSet.has(t.id))
        }

        // 4. 清理本地已成功同步的逻辑删除项，保持内存整洁
        todos.value = todos.value.filter((t) => !(t.deletedAt && t.syncStatus === 'synced'))

        lastSyncAt.value = serverTime
      } catch (err) {
        console.error('Sync failed:', err)
        error.value = 'todo.syncFailed'
      } finally {
        loading.value = false
      }
    }

    /**
     * 登录后合并本地数据
     */
    async function mergeOnLogin(): Promise<void> {
      lastSyncAt.value = null

      // 标记所有本地数据为待同步，强制合并
      todos.value.forEach((t) => {
        if (!t.syncStatus) t.syncStatus = 'pending'
      })

      await sync()
    }

    /**
     * 登出后重置同步状态
     */
    function resetSyncStatus(): void {
      lastSyncAt.value = null
      todos.value.forEach((t) => {
        t.syncStatus = undefined
      })
    }

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

    let isSocketInitialized = false

    /**
     * 初始化 WebSocket 监听
     */
    function initSocketListener(): void {
      if (isSocketInitialized) return

      void import('@/composables/useSocket').then(({ useSocket }) => {
        const { connect } = useSocket()
        const socket = connect()

        if (!socket) return

        // 监听来自服务器的同步通知
        socket.on('todos:sync', () => {
          console.log('[Socket] Received sync notification, debouncing...')
          debouncedSync()
        })

        socket.on('connect', () => {
          console.log('[Socket] Connected in TodoStore')
        })

        socket.on('disconnect', () => {
          console.log('[Socket] Disconnected in TodoStore')
        })

        isSocketInitialized = true
      })
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
      lastSyncAt,
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
      sync,
      mergeOnLogin,
      resetSyncStatus,
      addProposedChanges,
      clearProposedChanges,
      applyProposedChanges,
      discardProposedChanges,
      initSocketListener,
    }
  },
  {
    persist: {
      key: 'todos',
      storage: localStorage,
      pick: ['todos', 'filter', 'viewMode', 'lastSyncAt'],
    },
  },
)
