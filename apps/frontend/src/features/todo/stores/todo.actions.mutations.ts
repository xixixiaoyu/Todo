import type { Ref } from 'vue'
import { toDate } from './todo.dates'
import { generateTodoId, isDuplicateTodo } from './todo.actions.common'
import type { Todo } from './todo.types'

type TodoMutationDeps = {
  todos: Ref<Todo[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  debouncedSync: () => void
}

export function createTodoMutations(deps: TodoMutationDeps): {
  isDuplicate: (title: string, parentId?: string | null, excludeId?: string) => boolean
  addTodo: (title: string, parentId?: string | null, id?: string) => Promise<string | null>
  addTodos: (titles: string[], parentId?: string | null) => Promise<string[]>
  removeTodos: (ids: string[]) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  setTodoDeferred: (id: string, deferred: boolean) => Promise<boolean>
  incrementPomodoro: (id: string) => void
  restoreTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
  updateTodo: (id: string, title?: string, parentId?: string | null) => Promise<boolean>
  updateTodoSchedule: (
    id: string,
    dueAt: Date | null,
    remindAt: Date | null,
    recurrenceRule?: Todo['recurrenceRule'] | null,
  ) => boolean
  reorderTodos: (orderedIds: string[], parentId?: string | null) => void
} {
  function isDuplicate(title: string, parentId: string | null = null, excludeId?: string): boolean {
    return isDuplicateTodo(deps.todos.value, title, parentId, excludeId)
  }

  function updateParentStatus(parentId: string): void {
    const parent = deps.todos.value.find((todo) => todo.id === parentId)
    if (!parent) return

    const siblings = deps.todos.value.filter(
      (todo) => todo.parentId === parentId && !todo.deletedAt,
    )
    const allCompleted = siblings.length > 0 && siblings.every((sibling) => sibling.completed)

    if (parent.completed !== allCompleted) {
      parent.completed = allCompleted
      if (allCompleted) {
        parent.completedAt = new Date()
      } else {
        delete parent.completedAt
      }
      parent.updatedAt = new Date()
      parent.syncStatus = 'pending'
      if (parent.parentId) {
        updateParentStatus(parent.parentId)
      }
    }
  }

  function reorderTodos(orderedIds: string[], parentId: string | null = null): void {
    for (const id of orderedIds) {
      const todo = deps.todos.value.find((item) => item.id === id)
      if (todo && (todo.parentId ?? null) !== parentId) {
        if (isDuplicate(todo.title, parentId, id)) {
          deps.error.value = 'todo.duplicate'
          return
        }
      }
    }

    orderedIds.forEach((id, index) => {
      const todo = deps.todos.value.find((item) => item.id === id)
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

    deps.debouncedSync()
  }

  async function addTodo(
    title: string,
    parentId: string | null = null,
    id?: string,
  ): Promise<string | null> {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return null

    if (isDuplicate(trimmedTitle, parentId)) {
      deps.error.value = 'todo.duplicate'
      return null
    }

    if (parentId) {
      const parent = deps.todos.value.find((todo) => todo.id === parentId)
      if (parent?.completed) {
        deps.error.value = 'todo.parentCompleted'
        return null
      }
    }

    deps.loading.value = true
    try {
      const minOrder =
        deps.todos.value.length > 0
          ? Math.min(...deps.todos.value.map((todo) => todo.order ?? 0))
          : 0

      const newTodo: Todo = {
        id: id || generateTodoId(),
        title: trimmedTitle,
        completed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false,
        parentId,
        order: minOrder - 1,
        expanded: true,
        version: 0,
        syncStatus: 'pending',
        pomodoroCount: 0,
      }
      deps.todos.value.unshift(newTodo)

      deps.debouncedSync()

      return newTodo.id
    } catch (err) {
      console.error('Failed to add todo:', err)
      deps.error.value = 'todo.addError'
      return null
    } finally {
      deps.loading.value = false
    }
  }

  async function addTodos(titles: string[], parentId: string | null = null): Promise<string[]> {
    const addedIds: string[] = []

    if (parentId) {
      const parent = deps.todos.value.find((todo) => todo.id === parentId)
      if (parent?.completed) {
        deps.error.value = 'todo.parentCompleted'
        return []
      }
    }

    deps.loading.value = true
    try {
      let minOrder =
        deps.todos.value.length > 0
          ? Math.min(...deps.todos.value.map((todo) => todo.order ?? 0))
          : 0

      const reversedTitles = [...titles].reverse()

      for (const title of reversedTitles) {
        const trimmedTitle = title.trim()
        if (!trimmedTitle || isDuplicate(trimmedTitle, parentId)) continue

        const newTodo: Todo = {
          id: generateTodoId(),
          title: trimmedTitle,
          completed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPinned: false,
          parentId,
          order: --minOrder,
          expanded: true,
          version: 0,
          syncStatus: 'pending',
          pomodoroCount: 0,
        }
        deps.todos.value.unshift(newTodo)
        addedIds.push(newTodo.id)
      }

      if (addedIds.length > 0) {
        deps.debouncedSync()
      }

      return addedIds
    } catch (err) {
      console.error('Failed to add todos:', err)
      deps.error.value = 'todo.addError'
      return []
    } finally {
      deps.loading.value = false
    }
  }

  async function removeTodos(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    deps.loading.value = true
    try {
      for (const id of ids) {
        await deleteTodo(id)
      }
    } catch (err) {
      console.error('Failed to remove todos:', err)
      deps.error.value = 'todo.deleteError'
    } finally {
      deps.loading.value = false
    }
  }

  async function toggleTodo(id: string): Promise<void> {
    const todo = deps.todos.value.find((item) => item.id === id)
    if (!todo) return

    const toggledAt = new Date()
    todo.completed = !todo.completed
    if (todo.completed) {
      todo.completedAt = toggledAt
      todo.deferredAt = undefined
    } else {
      delete todo.completedAt
    }
    todo.updatedAt = toggledAt
    todo.syncStatus = 'pending'

    const toggleChildren = (parentId: string, completed: boolean) => {
      const children = deps.todos.value.filter((item) => item.parentId === parentId)
      children.forEach((child) => {
        child.completed = completed
        if (completed) {
          child.completedAt = toggledAt
          child.deferredAt = undefined
        } else {
          delete child.completedAt
        }
        child.updatedAt = toggledAt
        child.syncStatus = 'pending'
        toggleChildren(child.id, completed)
      })
    }

    toggleChildren(id, todo.completed)

    if (todo.parentId) {
      updateParentStatus(todo.parentId)
    }

    deps.debouncedSync()
  }

  async function togglePin(id: string): Promise<void> {
    const todo = deps.todos.value.find((item) => item.id === id)
    if (todo) {
      todo.isPinned = !todo.isPinned
      todo.updatedAt = new Date()
      todo.syncStatus = 'pending'
      deps.debouncedSync()
    }
  }

  async function setTodoDeferred(id: string, deferred: boolean): Promise<boolean> {
    const todo = deps.todos.value.find((item) => item.id === id)
    if (!todo || todo.completed || todo.deletedAt || todo.parentId) return false

    if (deferred === !!todo.deferredAt) {
      return true
    }

    todo.deferredAt = deferred ? new Date() : undefined
    todo.updatedAt = new Date()
    todo.syncStatus = 'pending'
    deps.debouncedSync()
    return true
  }

  function incrementPomodoro(id: string): void {
    const todo = deps.todos.value.find((item) => item.id === id)
    if (todo) {
      todo.pomodoroCount = (todo.pomodoroCount || 0) + 1
      todo.updatedAt = new Date()
      todo.syncStatus = 'pending'
      deps.debouncedSync()
    }
  }

  async function deleteTodo(id: string): Promise<void> {
    const todo = deps.todos.value.find((item) => item.id === id)
    if (!todo) return

    const parentId = todo.parentId

    const children = deps.todos.value.filter((item) => item.parentId === id)
    for (const child of children) {
      await deleteTodo(child.id)
    }

    todo.deletedAt = new Date()
    todo.updatedAt = new Date()
    todo.syncStatus = 'pending'

    if (parentId) {
      updateParentStatus(parentId)
    }

    deps.debouncedSync()
  }

  async function restoreTodo(id: string): Promise<void> {
    const todo = deps.todos.value.find((item) => item.id === id)
    if (!todo) return

    todo.deletedAt = undefined
    todo.updatedAt = new Date()
    todo.syncStatus = 'pending'

    if (todo.parentId) {
      const parent = deps.todos.value.find((item) => item.id === todo.parentId)
      if (parent && parent.deletedAt) {
        await restoreTodo(parent.id)
      }
    }

    deps.debouncedSync()
  }

  async function updateTodo(
    id: string,
    title?: string,
    parentId?: string | null,
  ): Promise<boolean> {
    const todo = deps.todos.value.find((item) => item.id === id)
    if (!todo) return false

    const trimmedTitle = title?.trim()
    if (trimmedTitle === '') {
      deps.error.value = 'todo.titleEmpty'
      return false
    }
    const targetTitle = trimmedTitle || todo.title
    const targetParentId = parentId !== undefined ? parentId : todo.parentId

    if (targetTitle === todo.title && targetParentId === todo.parentId) return true

    if (isDuplicate(targetTitle, targetParentId, id)) {
      deps.error.value = 'todo.duplicate'
      return false
    }

    if (title !== undefined) {
      todo.title = targetTitle
    }
    if (parentId !== undefined) {
      todo.parentId = parentId
    }

    todo.updatedAt = new Date()
    todo.syncStatus = 'pending'
    deps.debouncedSync()
    return true
  }

  function updateTodoSchedule(
    id: string,
    dueAt: Date | null,
    remindAt: Date | null,
    recurrenceRule: Todo['recurrenceRule'] | null = undefined,
  ): boolean {
    const todo = deps.todos.value.find((item) => item.id === id)
    if (!todo) return false

    if (dueAt && Number.isNaN(dueAt.getTime())) return false
    if (remindAt && Number.isNaN(remindAt.getTime())) return false

    if (dueAt && remindAt && remindAt.getTime() > dueAt.getTime()) {
      deps.error.value = 'todo.remindAfterDue'
      return false
    }

    if (recurrenceRule && !dueAt) {
      deps.error.value = 'todo.recurrenceNeedsDue'
      return false
    }

    const nextDueAt = dueAt ? new Date(dueAt) : null
    const nextReminderAt = remindAt ? new Date(remindAt) : null
    const prevRemindAt = toDate(todo.remindAt)?.getTime() ?? null
    const nextRemindAt = nextReminderAt ? nextReminderAt.getTime() : null

    todo.dueAt = nextDueAt || undefined
    todo.remindAt = nextReminderAt || undefined
    if (recurrenceRule !== undefined) {
      todo.recurrenceRule = recurrenceRule || null
      if (todo.recurrenceRule) {
        todo.recurrenceTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      } else {
        todo.recurrenceTz = null
      }
    } else if (todo.recurrenceRule && !dueAt) {
      todo.recurrenceRule = null
      todo.recurrenceTz = null
    }

    if (prevRemindAt !== nextRemindAt) {
      todo.remindedAt = undefined
    }

    todo.updatedAt = new Date()
    todo.syncStatus = 'pending'
    deps.debouncedSync()
    return true
  }

  return {
    isDuplicate,
    addTodo,
    addTodos,
    removeTodos,
    toggleTodo,
    togglePin,
    setTodoDeferred,
    incrementPomodoro,
    restoreTodo,
    deleteTodo,
    updateTodo,
    updateTodoSchedule,
    reorderTodos,
  }
}
