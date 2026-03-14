import type { ProposedTodoChange, Todo } from './todo.types'

export interface ProposedTodoActions {
  addTodo: (title: string, parentId?: string | null, id?: string) => Promise<string | null>
  updateTodo: (id: string, title?: string, parentId?: string | null) => Promise<boolean>
  deleteTodo: (id: string) => Promise<void>
  toggleTodo: (id: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
}

export function buildBasePreviewTodos(
  todos: Todo[],
  proposedChanges: ProposedTodoChange[],
): Todo[] {
  if (proposedChanges.length === 0) return [...todos]

  const result = todos.map((t) => ({ ...t }))

  for (const change of proposedChanges) {
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
        if (change.data.parentId !== undefined) todo.parentId = change.data.parentId
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
}

function orderAddActions(addActions: ProposedTodoChange[]): string[] {
  const addById = new Map<string, ProposedTodoChange>()
  const addIds: string[] = []

  for (const action of addActions) {
    if (!action.id) continue
    addById.set(action.id, action)
    addIds.push(action.id)
  }

  const addIdSet = new Set(addIds)
  const incomingCount = new Map<string, number>()
  const outgoing = new Map<string, string[]>()

  for (const id of addIds) {
    incomingCount.set(id, 0)
    outgoing.set(id, [])
  }

  for (const id of addIds) {
    const action = addById.get(id)
    const parentId = action?.data.parentId
    if (parentId && addIdSet.has(parentId)) {
      outgoing.get(parentId)?.push(id)
      incomingCount.set(id, (incomingCount.get(id) ?? 0) + 1)
    }
  }

  const queue: string[] = addIds.filter((id) => (incomingCount.get(id) ?? 0) === 0)
  const orderedAddIds: string[] = []
  const queued = new Set(queue)

  while (queue.length > 0) {
    const id = queue.shift()!
    orderedAddIds.push(id)
    const outs = outgoing.get(id) ?? []
    for (const next of outs) {
      incomingCount.set(next, (incomingCount.get(next) ?? 0) - 1)
      if ((incomingCount.get(next) ?? 0) === 0 && !queued.has(next)) {
        queue.push(next)
        queued.add(next)
      }
    }
  }

  if (orderedAddIds.length < addIds.length) {
    for (const id of addIds) {
      if (!orderedAddIds.includes(id)) orderedAddIds.push(id)
    }
  }

  return orderedAddIds
}

export async function applyProposedTodoChanges(
  changes: ProposedTodoChange[],
  existingTodos: Todo[],
  actions: ProposedTodoActions,
): Promise<void> {
  if (changes.length === 0) return

  const addActions = changes.filter((c) => c.type === 'add')
  const nonAddActions = changes.filter((c) => c.type !== 'add')
  const orderedAddIds = orderAddActions(addActions)
  const addById = new Map<string, ProposedTodoChange>()
  for (const action of addActions) {
    if (!action.id) continue
    addById.set(action.id, action)
  }

  const idMap = new Map<string, string>()
  const existingTodoIds = new Set(existingTodos.map((t) => t.id))

  for (const id of orderedAddIds) {
    const change = addById.get(id)
    if (!change) continue

    const rawTitle = change.data.title
    const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''
    if (!title) continue

    const parentIdRaw = change.data.parentId
    const parentId =
      typeof parentIdRaw === 'string' && parentIdRaw
        ? (idMap.get(parentIdRaw) ?? (existingTodoIds.has(parentIdRaw) ? parentIdRaw : null))
        : null

    const newId = await actions.addTodo(title, parentId ?? null)
    if (newId) {
      idMap.set(id, newId)
      existingTodoIds.add(newId)
    }
  }

  for (const change of nonAddActions) {
    const rawId = change.data.id
    const targetTodoId = typeof rawId === 'string' && rawId ? (idMap.get(rawId) ?? rawId) : null

    switch (change.type) {
      case 'update': {
        const rawTitle = change.data.title
        const title = typeof rawTitle === 'string' ? rawTitle.trim() : undefined
        const rawParentId = change.data.parentId
        const parentId =
          rawParentId === null
            ? null
            : typeof rawParentId === 'string'
              ? (idMap.get(rawParentId) ?? rawParentId)
              : undefined

        if (targetTodoId) {
          await actions.updateTodo(targetTodoId, title, parentId)
        }
        break
      }
      case 'delete':
        if (targetTodoId) await actions.deleteTodo(targetTodoId)
        break
      case 'toggle':
        if (targetTodoId) await actions.toggleTodo(targetTodoId)
        break
      case 'pin':
        if (targetTodoId) await actions.togglePin(targetTodoId)
        break
    }
  }
}
