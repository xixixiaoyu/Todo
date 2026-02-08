import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useProposedTreeData } from '@/features/todo/composables/useProposedTreeData'
import type { ProposedTodoChange } from '@/features/todo/stores/todo.types'

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

// Mock the todo store
const mockTodos = [
  { id: '1', title: 'Existing Task', completed: false, pomodoroCount: 0, parentId: null },
  { id: '2', title: 'Task to Delete', completed: false, pomodoroCount: 0, parentId: null },
  { id: '3', title: 'Child Task', completed: false, pomodoroCount: 0, parentId: '1' },
]

vi.mock('@/features/todo/stores/todo', () => ({
  useTodoStore: vi.fn(() => ({
    todos: mockTodos,
  })),
}))

describe('useProposedTreeData', () => {
  it('should generate tree data correctly from actions', () => {
    const actions = ref<ProposedTodoChange[]>([
      {
        id: 'new-1',
        type: 'add',
        data: { title: 'New Task', id: 'new-1' },
      },
      {
        id: 'update-1',
        type: 'update',
        data: { id: '1', title: 'Updated Task' },
      },
      {
        id: 'delete-2',
        type: 'delete',
        data: { id: '2' },
      },
    ])
    const isDark = ref(false)

    const { treeData } = useProposedTreeData(actions, isDark)

    // Should have a virtual root because there are multiple roots ('New Task', 'Updated Task', and 'Task to Delete' are all top-level in this case)
    expect(treeData.value).toHaveLength(1)
    const root = treeData.value[0]
    // The name is now translated, and the mock returns the key
    expect(root.name).toBe('todo.proposedChangesTitle')
    expect(root.children).toHaveLength(3)

    // Check individual nodes
    const newNode = root.children?.find((n) => n.id === 'new-1')
    expect(newNode?.label?.formatter).toContain('✨ New Task')

    const updatedNode = root.children?.find((n) => n.id === '1')
    expect(updatedNode?.label?.formatter).toContain('✨ Updated Task')

    const deletedNode = root.children?.find((n) => n.id === '2')
    expect(deletedNode?.label?.formatter).toContain('🗑️ Task to Delete')
  })

  it('should handle single root without virtual root', () => {
    const actions = ref<ProposedTodoChange[]>([
      {
        id: 'new-1',
        type: 'add',
        data: { title: 'Single New Task', id: 'new-1' },
      },
    ])
    const isDark = ref(false)

    const { treeData } = useProposedTreeData(actions, isDark)

    expect(treeData.value).toHaveLength(1)
    expect(treeData.value[0].id).toBe('new-1')
    expect(treeData.value[0].name).toBe('Single New Task')
  })

  it('should handle nested structures', () => {
    const actions = ref<ProposedTodoChange[]>([
      {
        id: 'update-3',
        type: 'update',
        data: { id: '3', title: 'Updated Child' },
      },
    ])
    const isDark = ref(false)

    const { treeData } = useProposedTreeData(actions, isDark)

    // Involved: ID 3 and its parent ID 1 (which is automatically included because it's the parent of 3)
    // Root should be ID 1
    expect(treeData.value).toHaveLength(1)
    expect(treeData.value[0].id).toBe('1')
    expect(treeData.value[0].children).toHaveLength(1)
    expect(treeData.value[0].children![0].id).toBe('3')
    expect(treeData.value[0].children![0].label?.formatter).toContain('✨ Updated Child')
  })

  it('should update colors based on isDark', () => {
    const actions = ref<ProposedTodoChange[]>([
      {
        id: 'new-1',
        type: 'add',
        data: { title: 'Theme Test', id: 'new-1' },
      },
    ])
    const isDark = ref(false)

    const { treeData: data1 } = useProposedTreeData(actions, isDark)
    const lightColor = data1.value[0].itemStyle?.color

    isDark.value = true
    // Note: Since treeData is a computed property, we need to access its value again
    const darkColor = data1.value[0].itemStyle?.color

    expect(lightColor).toBe('#10b981')
    expect(darkColor).toBe('#059669')
  })
})
