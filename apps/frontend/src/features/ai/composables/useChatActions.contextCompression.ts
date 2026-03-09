import { getAIStaticResponse, type ChatMessage } from '@/features/ai/services/aiService'
import { getAIConfig, getAIPresets, type AIConfig } from './useAIConfig'
import type { ChatSession } from './useChatHistory'

const compressingSessionIds = new Set<string>()
const compressingTasks = new Map<string, Promise<void>>()

const DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS = 24000
const SUMMARY_MAX_CHARS = 2400
const SUMMARY_INPUT_MAX_CHARS_PER_MESSAGE = 2000
const REQUEST_MAX_DOCUMENT_CHARS_PER_DOC = 8000

function truncateText(input: string, maxChars: number): string {
  if (input.length <= maxChars) return input
  return `${input.slice(0, maxChars)}\n\n…(truncated)…`
}

function estimateMessageSize(msg: ChatMessage): number {
  const base = msg.content?.length ?? 0
  const docs = (msg.documents ?? []).reduce((acc, d) => acc + d.name.length + d.content.length, 0)
  const images = (msg.images ?? []).reduce((acc, url) => acc + url.length, 0)
  const toolName = msg.toolName?.length ?? 0
  const toolCalls = (msg.tool_calls ?? []).reduce(
    (acc, call) => acc + call.function.name.length + call.function.arguments.length,
    0,
  )
  return base + docs + images + toolName + toolCalls
}

function estimateHistorySize(messages: ChatMessage[]): number {
  return messages.reduce((acc, m) => acc + estimateMessageSize(m), 0)
}

function normalizeMessagesForRequest(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => {
    if (!m.documents || m.documents.length === 0) return m

    return {
      ...m,
      documents: m.documents.map((d) => ({
        name: d.name,
        content: truncateText(d.content, REQUEST_MAX_DOCUMENT_CHARS_PER_DOC),
      })),
    }
  })
}

function findTailStartIndexByCharBudget(messages: ChatMessage[], budgetChars: number): number {
  if (budgetChars <= 0) return Math.max(0, messages.length - 1)
  if (messages.length <= 1) return 0

  let size = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    const next = size + estimateMessageSize(messages[i])
    if (next > budgetChars) {
      return i === messages.length - 1 ? i : i + 1
    }
    size = next
  }

  return 0
}

function formatMessagesForSummary(messages: ChatMessage[]): string {
  return messages
    .map((m) => {
      const role = m.role === 'tool' ? `tool:${m.toolName || 'unknown'}` : m.role
      const content = truncateText(m.content || '', SUMMARY_INPUT_MAX_CHARS_PER_MESSAGE)
      const docs = (m.documents ?? [])
        .map(
          (d) =>
            `<document name="${d.name.replace(/\s+/g, ' ').slice(0, 120)}">\n${truncateText(d.content, 1200)}\n</document>`,
        )
        .join('\n\n')
      const body = docs ? `${content}\n\n[documents]\n${docs}\n[/documents]` : content
      return `【${role}】\n${body}`
    })
    .join('\n\n---\n\n')
}

async function compressInBackground(
  session: ChatSession,
  segment: ChatMessage[],
  currentSummary: string,
  aiConfig: AIConfig,
  updateSessionContextSummary: (
    sessionId: string,
    context: { summary: string; untilMessageId: string },
  ) => void,
) {
  try {
    const inputText = formatMessagesForSummary(segment)
    const system =
      '你是一个上下文压缩器。目标：将早期对话压缩为高密度摘要，供后续对话继续使用。\n' +
      '要求：\n' +
      '- 输出中文，结构化，控制在 20 条以内的要点。\n' +
      '- 只保留：用户目标、约束/偏好、关键结论、已做决定、重要实体（如文件路径/ID/命令）。\n' +
      '- 严禁包含逐字转录、长段代码或长工具输出。\n' +
      '- 如果信息不足以确定某结论，明确标记为“未确认”。'

    const user =
      (currentSummary
        ? `【已存在摘要】\n${currentSummary}\n\n请在此基础上增量更新摘要。\n\n`
        : '') + `【新增对话片段】\n${inputText}`

    const modelOptions = (() => {
      if (!aiConfig.contextCompressionModelId) return {}
      const preset = getAIPresets().find((p) => p.id === aiConfig.contextCompressionModelId)
      if (!preset) return {}
      return {
        baseUrl: preset.baseUrl,
        apiKey: preset.apiKey,
        model: preset.model,
      }
    })()

    const res = await getAIStaticResponse(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      {
        ...modelOptions,
        temperature: 0.2,
      },
    )

    const nextSummary = truncateText((res.content || '').trim(), SUMMARY_MAX_CHARS)
    if (nextSummary) {
      const untilMessageId = segment[segment.length - 1].id
      updateSessionContextSummary(session.id, { summary: nextSummary, untilMessageId })
    }
  } catch (err) {
    console.warn(`[ContextCompression] Failed for session ${session.id}:`, err)
  }
}

export function createContextCompression(deps: {
  currentSession: { value: ChatSession | null }
  updateSessionContextSummary: (
    sessionId: string,
    context: { summary: string; untilMessageId: string },
  ) => void
  clearSessionContextSummary: (sessionId: string) => void
}) {
  async function buildContextCompression(messages: ChatMessage[]): Promise<{
    messagesForRequest: ChatMessage[]
    contextSummary?: string
  }> {
    const aiConfig = getAIConfig()
    const enabled = aiConfig.contextCompressionEnabled !== false
    if (!enabled) {
      return { messagesForRequest: normalizeMessagesForRequest(messages) }
    }

    const triggerChars =
      aiConfig.contextCompressionTriggerChars ?? DEFAULT_CONTEXT_COMPRESSION_TRIGGER_CHARS

    const session = deps.currentSession.value
    const hasSummary = !!session?.contextSummary?.trim()
    const size = estimateHistorySize(messages)

    const keepStartIndex = findTailStartIndexByCharBudget(messages, triggerChars)
    const keepMessages = messages.slice(keepStartIndex)

    if (size <= triggerChars && !hasSummary) {
      return { messagesForRequest: normalizeMessagesForRequest(messages) }
    }

    if (!session) {
      return { messagesForRequest: normalizeMessagesForRequest(keepMessages) }
    }

    const summary = session.contextSummary?.trim() || ''
    let summaryUntilIndex = -1

    if (session.contextSummaryUntilMessageId) {
      summaryUntilIndex = messages.findIndex((m) => m.id === session.contextSummaryUntilMessageId)
      if (summaryUntilIndex === -1) {
        deps.clearSessionContextSummary(session.id)
      }
    }

    const segmentStart = Math.max(0, summaryUntilIndex + 1)
    const segmentEnd = Math.max(0, keepStartIndex)
    const segment = segmentEnd > segmentStart ? messages.slice(segmentStart, segmentEnd) : []

    if (compressingSessionIds.has(session.id)) {
      const runningTask = compressingTasks.get(session.id)
      if (runningTask) {
        try {
          await runningTask
        } catch {
          // noop
        }
      }

      const refreshedSession = deps.currentSession.value
      const refreshedSummary =
        refreshedSession?.id === session.id
          ? refreshedSession.contextSummary?.trim() || ''
          : summary

      return {
        messagesForRequest: normalizeMessagesForRequest(keepMessages),
        contextSummary: refreshedSummary || undefined,
      }
    }

    if (segment.length > 0) {
      compressingSessionIds.add(session.id)

      const task = compressInBackground(
        session,
        segment,
        summary,
        aiConfig,
        deps.updateSessionContextSummary,
      ).finally(() => {
        compressingSessionIds.delete(session.id)
        compressingTasks.delete(session.id)
      })

      compressingTasks.set(session.id, task)
    }

    return {
      messagesForRequest: normalizeMessagesForRequest(segment.length > 0 ? messages : keepMessages),
      contextSummary: summary || undefined,
    }
  }

  return { buildContextCompression }
}
