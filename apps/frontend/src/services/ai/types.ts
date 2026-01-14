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
  thinkingContent?: string
  reasoning_details?: string
  discussionSteps?: DiscussionStep[]
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
