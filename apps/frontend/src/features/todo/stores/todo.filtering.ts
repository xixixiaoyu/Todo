import type { FilterType, Todo } from './todo.types'

export function isEffectivelyCompleted(todo: Todo, allTodos: Todo[]): boolean {
  if (!todo.completed) return false
  if (!todo.parentId) return true

  const parent = allTodos.find((t) => t.id === todo.parentId)
  if (!parent) return true
  return isEffectivelyCompleted(parent, allTodos)
}

export function applyFilterAndSort(
  items: Todo[],
  filter: FilterType,
  searchQuery: string,
  ignoreTab = false,
): Todo[] {
  const query = searchQuery.trim().toLowerCase()

  return items
    .filter((todo) => {
      if (filter === 'trash') {
        const matchesSearch = !query || todo.title.toLowerCase().includes(query)
        return !!todo.deletedAt && matchesSearch
      }

      if (todo.deletedAt) return false

      const effectivelyCompleted = isEffectivelyCompleted(todo, items)
      const matchesFilter = ignoreTab
        ? true
        : filter === 'pending'
          ? !effectivelyCompleted
          : effectivelyCompleted

      const isProposedAction = todo.isProposed || todo.isProposedDelete
      const matchesSearch = !query || todo.title.toLowerCase().includes(query)

      if (isProposedAction) return matchesSearch
      return matchesFilter && matchesSearch
    })
    .sort((a, b) => {
      if (filter === 'trash') {
        return new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime()
      }

      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      if (!a.completed && b.completed) return -1
      if (a.completed && !b.completed) return 1
      return (a.order ?? 0) - (b.order ?? 0)
    })
}
