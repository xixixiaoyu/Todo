/**
 * AI 服务工具函数
 */

import { getAIConfig } from '@/composables/useAIConfig'
import { useTodoStore, type Todo } from '@/features/todo/stores/todo'
import { useMemory } from '@/composables/useMemory'
import i18n from '@/i18n'
import type { ChatMessage, MultiModalContent } from './types'

const t = i18n.global.t

/**
 * 构建完整的 API URL
 */
export function buildApiUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '') // 移除末尾斜杠
  return `${base}/chat/completions`
}

/**
 * 构建请求头
 */
export function getHeaders(apiKeyOverride?: string): Record<string, string> {
  const { apiKey } = getAIConfig()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKeyOverride || apiKey}`,
  }
}

/**
 * 生成唯一 ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

interface TodoWithChildren extends Todo {
  children: TodoWithChildren[]
}

/**
 * 格式化 Todo 列表为带层级的字符串
 */
function formatTodoItems(todos: Todo[]): string {
  // 1. 过滤未完成任务
  const pendingTodos = todos.filter((t) => !t.completed)
  if (pendingTodos.length === 0) return ''

  // 2. 构建层级结构
  const todoMap = new Map<string, TodoWithChildren>()
  pendingTodos.forEach((t) => todoMap.set(t.id, { ...t, children: [] }))

  const roots: TodoWithChildren[] = []
  pendingTodos.forEach((t) => {
    const item = todoMap.get(t.id)!
    if (t.parentId && todoMap.has(t.parentId)) {
      todoMap.get(t.parentId)!.children.push(item)
    } else {
      roots.push(item)
    }
  })

  // 3. 排序 (置顶优先，其次 order)
  const sortFn = (a: TodoWithChildren, b: TodoWithChildren) => {
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    return (a.order ?? 0) - (b.order ?? 0)
  }

  roots.sort(sortFn)
  roots.forEach((root) => {
    if (root.children.length > 0) {
      root.children.sort(sortFn)
    }
  })

  // 4. 递归生成字符串
  const lines: string[] = []
  const traverse = (item: TodoWithChildren, depth: number) => {
    const indent = '  '.repeat(depth)
    const pinIcon = item.isPinned ? '📌 ' : ''
    lines.push(`${indent}- ${pinIcon}${item.title} (ID: ${item.id})`)
    item.children.forEach((child) => traverse(child, depth + 1))
  }

  roots.forEach((root) => traverse(root, 0))
  return lines.join('\n')
}

/**
 * 注入系统提示和上下文信息（待办事项、记忆等）
 */
export function injectSystemPrompts(
  messages: ChatMessage[],
  systemPrompt: string,
  todoAssistant: boolean,
): Array<{ role: string; content: string | MultiModalContent[] }> {
  const result: Array<{ role: string; content: string | MultiModalContent[] }> = []

  // 1. 基础系统提示词
  if (systemPrompt) {
    result.push({
      role: 'system',
      content: systemPrompt,
    })
  }

  // 2. 记忆功能：注入用户已知信息记录
  const { memories, isMemoryEnabled } = useMemory()
  if (isMemoryEnabled.value && memories.value.length > 0) {
    result.push({
      role: 'system',
      content: `[用户已知信息记录]\n${memories.value.map((m) => `- ${m}`).join('\n')}`,
    })
  }

  // 3. Todo 助手：注入待办事项列表上下文
  if (todoAssistant) {
    const todoStore = useTodoStore()
    const todoList = formatTodoItems(todoStore.todos)
    const pendingCount = todoStore.todos.filter((t) => !t.completed).length

    // 将上下文和指令分开，指令放在最后以提高依从性
    result.push({
      role: 'system',
      content: `[Todo 助手上下文]
用户当前有 ${pendingCount} 个待完成的待办事项（带有 📌 的为置顶任务）：
${todoList || t('common.none') || 'None'}

支持层级结构：
- 如果要创建子任务，请在 add 操作中指定 parentId。
- 你可以一次性创建父任务和子任务：先为父任务生成一个唯一的临时 ID（如 "temp-1"），然后在子任务的 parentId 中引用该 ID。`,
    })
  }

  result.push(
    ...messages.map((msg) => {
      // 如果有图片，使用多模态格式
      if (msg.images && msg.images.length > 0) {
        const content: MultiModalContent[] = [{ type: 'text', text: msg.content }]
        msg.images.forEach((url) => {
          content.push({
            type: 'image_url',
            image_url: { url },
          })
        })
        return {
          role: msg.role,
          content,
        }
      }
      return {
        role: msg.role,
        content: msg.content,
      }
    }),
  )

  // 4. Todo 助手指令：在消息历史之后再次注入指令，确保 AI 遵循格式要求
  if (todoAssistant) {
    result.push({
      role: 'system',
      content: `[重要指令：Todo 操作格式]
如果你认为需要修改待办事项（增加、删除、修改、切换完成状态），请在回复的最后添加一个 JSON 块（不要包含在 Markdown 代码块中），格式如下：

[TODO_ACTIONS_START]
[
  { "type": "add", "id": "temp-parent-1", "data": { "title": "父任务标题" } },
  { "type": "add", "id": "temp-child-1", "data": { "title": "子任务标题", "parentId": "temp-parent-1" } },
  { "type": "update", "data": { "id": "现有任务ID", "title": "新标题" } },
  { "type": "delete", "data": { "id": "现有任务ID" } },
  { "type": "toggle", "data": { "id": "现有任务ID" } }
]
[TODO_ACTIONS_END]

注意：
1. 只要你在回复中建议了新的待办事项、任务拆解或对现有任务的修改，就必须输出对应的 JSON 块。不用担心用户是否同意，用户会在可视化界面预览并手动点击“应用”后才会真正修改数据。
2. 对于新任务，必须生成唯一的临时 ID（如 "temp-1"），并在需要关联父子关系时正确引用。
3. 对于现有任务，务必使用上下文提供的真实 ID。
4. 请保持回复简洁且具有行动导向。
5. 严禁在 JSON 块中使用任何注释或 Markdown 标记。`,
    })
  }

  return result
}
