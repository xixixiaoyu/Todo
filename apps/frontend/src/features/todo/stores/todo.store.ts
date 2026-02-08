import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Todo as SharedTodo } from '@my-app/shared'
import type { ProposedTodoChange, FilterType, ViewMode, Todo } from './todo.types'
import { applyFilterAndSort } from './todo.filtering'
import { createTodoCloud } from './todo.cloud'
import { createTodoActions } from './todo.actions'

export const useTodoStore = defineStore(
  'todo',
  () => {
    const todos = ref<Todo[]>([])
    const filter = ref<FilterType>('pending')
    const viewMode = ref<ViewMode>('list')
    const searchQuery = ref('')
    const loading = ref(false)
    const error = ref<string | null>(null)
    const isDrawerOpen = ref(false)
    const isMaximized = ref(false)
    const isSilencingToast = ref(false)
    const proposedChanges = ref<ProposedTodoChange[]>([])
    const lastSyncAt = ref<string | null>(null)

    const filteredTodos = computed(() =>
      applyFilterAndSort(todos.value, filter.value, searchQuery.value),
    )

    const isAllExpanded = computed(() => {
      const currentParentTodos = filteredTodos.value.filter((t) =>
        todos.value.some((child) => (child.parentId ?? null) === t.id),
      )

      if (currentParentTodos.length === 0) return false
      return currentParentTodos.some((t) => (t.expanded ?? true) !== false)
    })

    watch(searchQuery, (newQuery) => {
      if (newQuery.trim()) {
        todos.value.forEach((todo) => {
          todo.expanded = true
        })
      }
    })

    watch(viewMode, (newMode) => {
      if (newMode === 'visual' && filter.value === 'trash') {
        filter.value = 'pending'
      }
    })

    const pendingCount = computed(
      () => todos.value.filter((todo) => !todo.completed && !todo.deletedAt).length,
    )

    const completedCount = computed(
      () => todos.value.filter((todo) => todo.completed && !todo.deletedAt).length,
    )

    const hasProposedChanges = computed(() => proposedChanges.value.length > 0)

    const basePreviewTodos = computed(() => {
      if (proposedChanges.value.length === 0) return [...todos.value]

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
            pomodoroCount: 0,
            isProposed: true,
            expanded: true,
            version: 0,
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

      return result
    })

    const previewTodos = computed(() =>
      applyFilterAndSort(basePreviewTodos.value, filter.value, searchQuery.value),
    )

    const visualTodos = computed(() =>
      applyFilterAndSort(basePreviewTodos.value, filter.value, searchQuery.value, false),
    )

    function toSharedTodo(todo: Todo): SharedTodo {
      return {
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        order: todo.order,
        isPinned: !!todo.isPinned,
        parentId: todo.parentId || null,
        version: todo.version || 0,
        pomodoroCount: todo.pomodoroCount || 0,
        createdAt: todo.createdAt,
        updatedAt: todo.updatedAt,
        completedAt: todo.completedAt || null,
        deletedAt: todo.deletedAt || null,
      }
    }

    const {
      sync,
      debouncedSync,
      mergeOnLogin,
      resetSyncStatus,
      initSocketListener,
      deleteTodoPermanently,
      clearTrash,
    } = createTodoCloud({
      todos,
      loading,
      error,
      lastSyncAt,
      toSharedTodo,
    })

    const actions = createTodoActions({
      todos,
      filter,
      viewMode,
      searchQuery,
      loading,
      error,
      filteredTodos,
      isAllExpanded,
      debouncedSync,
      sync,
      isDrawerOpen,
      isMaximized,
      isSilencingToast,
    })

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
              await actions.addTodo(change.data.title, change.data.parentId ?? null, change.id)
            }
            break
          case 'update':
            if (change.data.id && change.data.title)
              await actions.updateTodo(change.data.id, change.data.title)
            break
          case 'delete':
            if (change.data.id) await actions.deleteTodo(change.data.id)
            break
          case 'toggle':
            if (change.data.id) await actions.toggleTodo(change.data.id)
            break
          case 'pin':
            if (change.data.id) await actions.togglePin(change.data.id)
            break
        }
      }
      clearProposedChanges()
    }

    function discardProposedChanges(): void {
      clearProposedChanges()
    }

    return {
      todos,
      filter,
      viewMode,
      searchQuery,
      loading,
      error,
      isDrawerOpen,
      isMaximized,
      isSilencingToast,
      isAllExpanded,
      proposedChanges,
      lastSyncAt,
      filteredTodos,
      pendingCount,
      completedCount,
      hasProposedChanges,
      previewTodos,
      visualTodos,
      ...actions,
      deleteTodoPermanently,
      clearTrash,
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
      pick: ['todos', 'filter', 'viewMode', 'lastSyncAt', 'isDrawerOpen', 'isMaximized'],
    },
  },
)
