/**
 * Agent 工具类型定义 — 共享契约层
 */

export type ToolCategory = 'file_read' | 'file_write' | 'shell' | 'search' | 'delivery' | 'task'

export interface AgentToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  category: ToolCategory
  /** 是否需要用户确认（write / shell / delivery 类默认需要） */
  requiresPermission?: boolean
}

export interface AgentToolResultContent {
  type: 'text'
  text: string
}

export interface AgentToolResult {
  content: AgentToolResultContent[]
  details?: Record<string, unknown>
}

export const AGENT_TOOL_PREFIX = 'agent_'

export const AGENT_TOOL_NAMES = {
  READ_FILE: `${AGENT_TOOL_PREFIX}read_file`,
  WRITE_FILE: `${AGENT_TOOL_PREFIX}write_file`,
  EDIT_FILE: `${AGENT_TOOL_PREFIX}edit_file`,
  LS: `${AGENT_TOOL_PREFIX}ls`,
  GREP: `${AGENT_TOOL_PREFIX}grep`,
  FIND: `${AGENT_TOOL_PREFIX}find`,
  MKDIR: `${AGENT_TOOL_PREFIX}mkdir`,
  BASH: `${AGENT_TOOL_PREFIX}bash`,
  STAGE_FILES: `${AGENT_TOOL_PREFIX}stage_files`,
  TASK: `${AGENT_TOOL_PREFIX}task`,
} as const
