/**
 * AI 服务相关类型定义
 */

export interface ReasoningDetailItem {
  type?: string
  text?: string
  summary?: string
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

export interface AISkillRuntimeSecret {
  key: string
  label?: string
  placeholder?: string
  hint?: string
  envVar?: string
  required?: boolean
}

export interface AISkillRuntimeValueBinding {
  $source: 'arg' | 'secret'
  key: string
  default?: AISkillRuntimeTemplateValue
  required?: boolean
  prefix?: string
  suffix?: string
}

export type AISkillRuntimeTemplateValue =
  | string
  | number
  | boolean
  | null
  | AISkillRuntimeValueBinding
  | AISkillRuntimeTemplateValue[]
  | { [key: string]: AISkillRuntimeTemplateValue }

export interface AISkillHttpRuntime {
  type: 'http'
  tool: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
  secrets?: AISkillRuntimeSecret[]
  request: {
    url: string
    method?: 'GET' | 'POST'
    headers?: Record<string, AISkillRuntimeTemplateValue>
    query?: Record<string, AISkillRuntimeTemplateValue>
    body?: AISkillRuntimeTemplateValue
    timeoutMs?: number
    responseType?: 'json' | 'text'
  }
}

export interface AISkillMcpRuntime {
  type: 'mcp'
  tool: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
  target: {
    toolName: string
    serverId?: string
  }
  arguments?: AISkillRuntimeTemplateValue
}

export type AISkillRuntime = AISkillHttpRuntime | AISkillMcpRuntime

export interface AISkill {
  id: string
  name: string
  prompt: string
  description?: string
  aliases?: string[]
  path?: string
  resources?: string[]
  allowImplicitInvocation?: boolean
  runtime?: AISkillRuntime
}

export interface AISkillRuntimeAvailability {
  skillId: string
  skillName: string
  runtimeType: AISkillRuntime['type']
  toolName: string
  status: 'available' | 'blocked'
  reasonCode?:
    | 'auth_required'
    | 'missing_secrets'
    | 'mcp_disabled'
    | 'mcp_tool_not_found'
    | 'mcp_tool_ambiguous'
  missingSecrets?: string[]
}

export type AssistantMode = 'default' | 'teaching'

export type TeachingQuizKind = 'single_choice' | 'multi_choice' | 'short_answer'

export type TeachingAssessmentResult = 'correct' | 'partial' | 'incorrect'

export type TeachingMasteryLevel = 'novice' | 'developing' | 'proficient'

export type StructuredBlockKind = 'todo_actions' | 'teaching_quiz' | 'teaching_assessment'

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

export interface TeachingAssessment {
  quizId: string
  result: TeachingAssessmentResult
  mastery: TeachingMasteryLevel
  feedback: string
  nextFocus?: string
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
  teachingAssessments?: TeachingAssessment[]
  structuredBlockErrors?: StructuredBlockError[]
  pendingStructuredBlocks?: StructuredBlockKind[]
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
  thinkingEffort?: 'low' | 'medium' | 'high'
  contextSummary?: string
  memorySnapshot?: string[]
  skills?: AISkill[]
  activeSkills?: AISkill[]
  skillRuntimeAvailability?: AISkillRuntimeAvailability[]
  tools?: Tool[]
  toolChoice?: 'none' | 'auto' | 'required' | { type: 'function'; function: { name: string } }
  abortSignal?: AbortSignal
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
      reasoning_content?: string
      reasoning_details?: string
      tool_calls?: ToolCall[]
    }
  | {
      role: 'tool'
      content: string
      tool_call_id?: string
    }
