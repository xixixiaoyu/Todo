import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTodoStore } from '@/features/todo/stores/todo'

describe('useTodoStore - Proposed Changes', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('applies a single message change set without affecting others', async () => {
    const store = useTodoStore()

    store.setProposedChanges('m1', [{ id: 'temp-a', type: 'add', data: { title: 'A' } }])
    store.setProposedChanges('m2', [{ id: 'temp-b', type: 'add', data: { title: 'B' } }])

    expect(store.hasProposedChanges).toBe(true)
    expect(store.previewTodos.some((t) => t.title === 'B' && t.isProposed)).toBe(true)

    await store.applyProposedChanges('m1')

    expect(store.todos.some((t) => t.title === 'A')).toBe(true)
    expect(store.todos.some((t) => t.title === 'B')).toBe(false)
    expect(store.previewTodos.some((t) => t.title === 'B' && t.isProposed)).toBe(true)
  })

  it('maps temporary ids when applying hierarchical add changes', async () => {
    const store = useTodoStore()

    store.setProposedChanges('m1', [
      { id: 'temp-parent', type: 'add', data: { title: 'Parent' } },
      { id: 'temp-child', type: 'add', data: { title: 'Child', parentId: 'temp-parent' } },
    ])

    const previewParent = store.previewTodos.find((t) => t.id === 'temp-parent')
    const previewChild = store.previewTodos.find((t) => t.id === 'temp-child')
    expect(previewParent?.isProposed).toBe(true)
    expect(previewChild?.parentId).toBe('temp-parent')

    await store.applyProposedChanges('m1')

    const parent = store.todos.find((t) => t.title === 'Parent')
    const child = store.todos.find((t) => t.title === 'Child')

    expect(parent).toBeTruthy()
    expect(child).toBeTruthy()
    expect(parent!.id).not.toBe('temp-parent')
    expect(child!.id).not.toBe('temp-child')
    expect(child!.parentId).toBe(parent!.id)
  })
})
