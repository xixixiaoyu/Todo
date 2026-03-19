import type { Ref } from 'vue'
import { todoApi } from '../api'
import { mapServerTodoToLocalTodo } from './todo.actions.common'
import type { Todo } from './todo.types'

type TodoFetchDeps = {
  todos: Ref<Todo[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  isTrashLoaded: Ref<boolean>
  isRemoteSource: Ref<boolean>
  sync: () => Promise<void>
}

export function createTodoFetchActions(deps: TodoFetchDeps): {
  fetchTodos: () => Promise<void>
  fetchTrash: () => Promise<void>
} {
  async function fetchTodos(): Promise<void> {
    deps.todos.value.forEach((todo, index) => {
      if (todo.order === undefined) {
        todo.order = index
      }
    })

    const { useAuthStore } = await import('@/features/auth/stores/auth')
    const authStore = useAuthStore()
    if (authStore.isAuthenticated && deps.isRemoteSource.value) {
      await deps.sync()
    }
  }

  async function fetchTrash(): Promise<void> {
    if (deps.isTrashLoaded.value) return

    const { useAuthStore } = await import('@/features/auth/stores/auth')
    const authStore = useAuthStore()
    if (!authStore.isAuthenticated || !deps.isRemoteSource.value) return

    deps.loading.value = true
    try {
      const response = await todoApi.findTrash()
      if (response.success && Array.isArray(response.data)) {
        response.data.forEach((serverTodo) => {
          const index = deps.todos.value.findIndex((todo) => todo.id === serverTodo.id)
          const todoData = mapServerTodoToLocalTodo(serverTodo)

          if (index !== -1) {
            deps.todos.value[index] = { ...deps.todos.value[index], ...todoData }
          } else {
            deps.todos.value.push(todoData)
          }
        })
        deps.isTrashLoaded.value = true
      }
    } catch (err) {
      console.error('Failed to fetch trash:', err)
      deps.error.value = 'todo.syncFailed'
    } finally {
      deps.loading.value = false
    }
  }

  return {
    fetchTodos,
    fetchTrash,
  }
}
