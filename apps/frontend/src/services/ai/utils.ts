/**
 * AI 服务工具函数
 */

import { getAIConfig } from '@/composables/useAIConfig'
import { useTodoStore } from '@/features/todo/stores/todo'
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

  // 3. Todo 助手：注入未完成的 Todo 列表
  if (todoAssistant) {
    const todoStore = useTodoStore()
    const pendingTodos = todoStore.todos.filter((t) => !t.completed)
    if (pendingTodos.length > 0) {
      const todoList = pendingTodos.map((t) => `- ${t.title}`).join('\n')
      result.push({
        role: 'system',
        content: t('ai.todoAssistantPrompt', {
          count: pendingTodos.length,
          todoList,
        }),
      })
    }
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

  return result
}
