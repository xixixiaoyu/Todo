/**
 * AI 服务相关类型定义
 */

export interface ReasoningDetailItem {
  type?: string
  text?: string
  [key: string]: unknown
}

export interface DiscussionStep {
  modelId: string
  modelName: string
  content: string
  status: 'thinking' | 'done' | 'error'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  images?: string[] // 图片 URL 或 base64
  documents?: { name: string; content: string }[] // 解析后的文档内容
  thinkingContent?: string
  reasoning_details?: string
  discussionSteps?: DiscussionStep[]
  todoActions?: import('@/features/todo/stores/todo').ProposedTodoChange[] // AI 建议的 Todo 变更
  todoActionsProcessed?: 'applied' | 'discarded' // AI 建议的处理状态
  isStreaming?: boolean
  createdAt?: Date
}

export interface AIRequestOptions {
  model?: string
  baseUrl?: string
  apiKey?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
  thinkingMode?: 'enabled' | 'disabled'
}

export interface MultiModalContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}
