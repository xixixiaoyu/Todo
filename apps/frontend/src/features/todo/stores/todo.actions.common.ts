import type { Todo } from './todo.types'

export function generateTodoId(): string {
  const c =
    typeof window !== 'undefined' ? window.crypto : typeof crypto !== 'undefined' ? crypto : null
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
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0
    const v = char === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function isDuplicateTodo(
  todos: Todo[],
  title: string,
  parentId: string | null = null,
  excludeId?: string,
): boolean {
  const trimmedTitle = title.trim().toLowerCase()
  return todos.some(
    (todo) =>
      todo.id !== excludeId &&
      (todo.parentId ?? null) === parentId &&
      !todo.completed &&
      !todo.deletedAt &&
      todo.title.toLowerCase() === trimmedTitle,
  )
}

export function getTodoPath(todos: Todo[], todoId: string): string[] {
  const path: string[] = []
  let current = todos.find((todo) => todo.id === todoId)
  while (current?.parentId) {
    const parent = todos.find((todo) => todo.id === current!.parentId)
    if (parent) {
      path.unshift(parent.title)
      current = parent
    } else {
      break
    }
  }
  return path
}
