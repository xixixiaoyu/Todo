import { todoApi } from '../api'
import { mapServerTodoToLocalTodo } from './todo.actions.common'
import type { TodoCloudDataDeps } from './todo.cloud.types'

export function createTodoCloudTrashActions(deps: TodoCloudDataDeps): {
  fetchTrash: () => Promise<void>
  deleteTodoPermanently: (id: string) => Promise<void>
  clearTrash: () => Promise<void>
} {
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
    } catch (error) {
      console.error('Failed to fetch trash:', error)
      deps.error.value = 'todo.syncFailed'
    } finally {
      deps.loading.value = false
    }
  }

  async function deleteTodoPermanently(id: string): Promise<void> {
    const index = deps.todos.value.findIndex((todo) => todo.id === id)
    if (index === -1) return

    const children = deps.todos.value.filter((todo) => todo.parentId === id)
    for (const child of children) {
      await deleteTodoPermanently(child.id)
    }

    deps.todos.value.splice(index, 1)

    const authStore = (await import('@/features/auth/stores/auth')).useAuthStore()
    if (authStore.isAuthenticated && deps.isRemoteSource.value) {
      try {
        await todoApi.deletePermanently(id)
      } catch (error) {
        console.error('Failed to delete todo permanently:', error)
      }
    }
  }

  async function clearTrash(): Promise<void> {
    deps.todos.value = deps.todos.value.filter((todo) => !todo.deletedAt)

    const authStore = (await import('@/features/auth/stores/auth')).useAuthStore()
    if (authStore.isAuthenticated && deps.isRemoteSource.value) {
      try {
        await todoApi.clearTrash()
      } catch (error) {
        console.error('Failed to clear trash:', error)
      }
    }
  }

  return {
    fetchTrash,
    deleteTodoPermanently,
    clearTrash,
  }
}
