import { computed } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProposedTodoChange, TreeData } from '../stores/todo.types'
import { useTodoStore } from '../stores/todo'

export function useProposedTreeData(actions: Ref<ProposedTodoChange[]>, isDark: Ref<boolean>) {
  const todoStore = useTodoStore()
  const { t } = useI18n()

  const treeData = computed(() => {
    const todoMap = new Map<string, TreeData>()
    const roots: TreeData[] = []

    // 0. 创建一个 ID 到 Todo 的快速索引 Map，优化查找性能
    const existingTodoMap = new Map(todoStore.todos.map((t) => [t.id, t]))

    // 1. 获取涉及到的所有原始任务 ID
    const involvedTodoIds = new Set<string>()
    actions.value.forEach((action) => {
      if (action.data.id) {
        involvedTodoIds.add(action.data.id)
        // 从现有 todo 中获取父节点 ID 以保持树结构完整
        const existingTodo = existingTodoMap.get(action.data.id)
        if (existingTodo?.parentId) {
          involvedTodoIds.add(existingTodo.parentId)
        }
      }
      if (action.data.parentId) involvedTodoIds.add(action.data.parentId)
    })

    // 2. 准备基础节点（从现有 todos 中提取相关的）
    const baseTodos = todoStore.todos.filter((t) => involvedTodoIds.has(t.id))

    baseTodos.forEach((todo) => {
      todoMap.set(todo.id, {
        name: todo.title,
        id: todo.id,
        children: [],
        itemStyle: {
          color: isDark.value ? '#cbd5e1' : '#64748b',
          borderColor: isDark.value ? '#94a3b8' : '#475569',
          borderWidth: 1,
        },
        label: {
          formatter: `{normal|${todo.title}}`,
        },
      })
    })

    // 3. 应用 AI 建议的变更
    actions.value.forEach((action) => {
      if (action.type === 'add') {
        const id = action.id || `new-${crypto.randomUUID()}`
        const node: TreeData = {
          name: action.data.title || '',
          id,
          children: [],
          itemStyle: {
            color: isDark.value ? '#059669' : '#10b981',
            borderColor: isDark.value ? '#34d399' : '#059669',
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: 'rgba(16, 185, 129, 0.3)',
          },
          lineStyle: {
            color: isDark.value ? '#059669' : '#10b981',
            width: 2,
            type: 'dashed',
            curveness: 0.5,
          },
          label: {
            formatter: `{proposed|✨ ${action.data.title}}`,
          },
        }
        todoMap.set(id, node)

        if (action.data.parentId && todoMap.has(action.data.parentId)) {
          todoMap.get(action.data.parentId)!.children?.push(node)
        } else {
          roots.push(node)
        }
      } else if (action.type === 'update' || action.type === 'toggle') {
        const node = todoMap.get(action.data.id!)
        if (node) {
          node.itemStyle = {
            ...node.itemStyle,
            color: isDark.value ? '#059669' : '#10b981',
            borderWidth: 2,
          }
          if (action.data.title) {
            node.name = action.data.title
            node.label = { formatter: `{proposed|✨ ${action.data.title}}` }
          }
        }
      } else if (action.type === 'pin') {
        const node = todoMap.get(action.data.id!)
        if (node) {
          node.itemStyle = {
            ...node.itemStyle,
            color: '#fbbf24',
            borderWidth: 2,
          }
          node.label = {
            formatter: `{pin|📌 ${node.name}}`,
          }
        }
      } else if (action.type === 'delete') {
        const node = todoMap.get(action.data.id!)
        if (node) {
          node.itemStyle = {
            ...node.itemStyle,
            color: isDark.value ? '#b91c1c' : '#ef4444',
            borderColor: isDark.value ? '#f87171' : '#dc2626',
            borderWidth: 1,
          }
          node.label = {
            formatter: `{delete|🗑️ ${node.name}}`,
          }
          node.lineStyle = {
            type: 'dotted',
            color: isDark.value ? '#b91c1c' : '#ef4444',
            curveness: 0.5,
          }
        }
      }
    })

    // 4. 建立父子关系（对于非新增节点）
    baseTodos.forEach((todo) => {
      const node = todoMap.get(todo.id)!
      if (todo.parentId && todoMap.has(todo.parentId)) {
        // 避免重复添加
        if (!todoMap.get(todo.parentId)!.children?.includes(node)) {
          todoMap.get(todo.parentId)!.children?.push(node)
        }
      } else if (!roots.includes(node)) {
        // 只有当它确实是根节点且没被作为新增节点处理过时才加入 roots
        const isChildOfAny = Array.from(todoMap.values()).some((parent) =>
          parent.children?.includes(node),
        )
        if (!isChildOfAny) {
          roots.push(node)
        }
      }
    })

    if (roots.length === 0) return []

    // 虚拟根节点
    if (roots.length > 1) {
      const rootName = t('todo.proposedChangesTitle')
      return [
        {
          name: rootName,
          children: roots,
          itemStyle: { color: '#fbbf24', borderWidth: 2 },
          label: { formatter: `{root|${rootName}}` },
        },
      ]
    }

    return roots
  })

  return {
    treeData,
  }
}
