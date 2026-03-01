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

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolResult {
  role: 'tool'
  tool_call_id: string
  content: string
}

export interface Tool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

export type AssistantMode = 'default' | 'teaching'

export type TeachingQuizKind = 'single_choice' | 'multi_choice' | 'short_answer'

export type StructuredBlockKind = 'todo_actions' | 'teaching_quiz'

export interface StructuredBlockError {
  block: StructuredBlockKind
  code: 'partial_block' | 'invalid_json' | 'invalid_shape' | 'no_valid_block'
  raw?: string
}

export interface TeachingQuizOption {
  id: string
  text: string
}

export interface TeachingQuiz {
  id: string
  kind: TeachingQuizKind
  stem: string
  options?: TeachingQuizOption[]
  answerHint?: string
  userAnswer?: string | string[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string // 用于 role: 'tool'
  toolName?: string // 用于 role: 'tool'，显示工具名称
  images?: string[] // 图片 URL 或 base64
  documents?: { name: string; content: string }[] // 解析后的文档内容
  thinkingContent?: string
  reasoning_details?: string
  discussionSteps?: DiscussionStep[]
  todoActions?: import('@/features/todo/stores/todo').ProposedTodoChange[] // AI 建议的 Todo 变更
  todoActionsProcessed?: 'applied' | 'discarded' // AI 建议的处理状态
  teachingQuizzes?: TeachingQuiz[]
  structuredBlockErrors?: StructuredBlockError[]
  isStreaming?: boolean
  createdAt?: Date
}

export interface AIRequestOptions {
  model?: string
  baseUrl?: string
  apiKey?: string
  temperature?: number
  top_p?: number
  maxTokens?: number
  systemPrompt?: string
  assistantMode?: AssistantMode
  thinkingMode?: 'enabled' | 'disabled'
  contextSummary?: string
  memorySnapshot?: string[]
  tools?: Tool[]
  toolChoice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } }
}

export interface MultiModalContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

export type AIChatCompletionMessage =
  | {
      role: 'system' | 'user' | 'assistant'
      content: string | MultiModalContent[]
      reasoning_details?: string
      tool_calls?: ToolCall[]
    }
  | {
      role: 'tool'
      content: string
      tool_call_id?: string
    }
