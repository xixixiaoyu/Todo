import { ref, computed, watch } from 'vue'
import i18n from '@/i18n'
import { generateId } from '@/features/ai/services/aiService'
import type { ChatMessage } from '@/features/ai/services/aiService'
import { useMemory } from './useMemory'
import {
  AI_STORAGE_SCOPE_CHANGE_EVENT,
  getAiScopedStorageItem,
  setAiScopedStorageItem,
  removeAiScopedStorageItem,
} from './aiStorageScope'

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  contextSummary?: string
  contextSummaryUpdatedAt?: Date
  contextSummaryUntilMessageId?: string
  memorySnapshot?: string[] // 锁定在会话启动时的记忆快照
  createdAt: Date
  updatedAt: Date
  isPinned?: boolean
  isAutoTitle?: boolean
}

const SESSIONS_STORAGE_KEY = 'ai-chat-sessions'
const CURRENT_SESSION_KEY = 'ai-chat-current-session'
const LAST_ACTIVE_SESSION_KEY = 'ai-chat-last-active-session'
const SAVE_THROTTLE_MS = 500

// 全局单例状态
const sessions = ref<ChatSession[]>([])
const currentSessionId = ref<string | null>(null)
const lastActiveSessionId = ref<string | null>(null)
let saveTimer: ReturnType<typeof setTimeout> | null = null

function compareSessionsByPriority(a: ChatSession, b: ChatSession): number {
  // 优先置顶
  if (a.isPinned && !b.isPinned) return -1
  if (!a.isPinned && b.isPinned) return 1
  // 其次按更新时间倒序
  return b.updatedAt.getTime() - a.updatedAt.getTime()
}

/**
 * 保存当前会话 ID 到 localStorage
 */
function saveCurrentSessionId(id: string | null): void {
  if (id) {
    setAiScopedStorageItem(CURRENT_SESSION_KEY, id)
  } else {
    removeAiScopedStorageItem(CURRENT_SESSION_KEY)
  }
}

/**
 * 保存上一个激活的会话 ID 到 localStorage
 */
function saveLastActiveSessionId(id: string | null): void {
  if (id) {
    setAiScopedStorageItem(LAST_ACTIVE_SESSION_KEY, id)
  } else {
    removeAiScopedStorageItem(LAST_ACTIVE_SESSION_KEY)
  }
}

/**
 * 从 localStorage 加载会话列表
 */
function loadSessions(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }

  // 先计算新值，再原子赋值，避免中间空状态导致 chatHistory 暂时返回 []、
  // 使得 messages computed 在 isGenerating 为 true 时只含流式临时消息而丢失用户消息
  let newSessions: ChatSession[] = []
  let newCurrentId: string | null = null
  let newLastId: string | null = null

  try {
    const saved = getAiScopedStorageItem(SESSIONS_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      newSessions = parsed.map((s: ChatSession) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
        contextSummaryUpdatedAt: s.contextSummaryUpdatedAt
          ? new Date(s.contextSummaryUpdatedAt)
          : undefined,
        messages: s.messages.map((msg: ChatMessage) => ({
          ...msg,
          createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
          // 确保 images 数组被正确加载
          images: msg.images,
        })),
      }))

      // 加载当前会话 ID
      const savedCurrentId = getAiScopedStorageItem(CURRENT_SESSION_KEY)
      if (savedCurrentId && newSessions.some((s) => s.id === savedCurrentId)) {
        newCurrentId = savedCurrentId
      } else if (newSessions.length > 0) {
        // 回退逻辑：优先选择最近更新的会话
        const latestSession = [...newSessions].sort(
          (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        )[0]
        newCurrentId = latestSession.id
      }

      // 加载上一个激活的会话 ID
      const savedLastId = getAiScopedStorageItem(LAST_ACTIVE_SESSION_KEY)
      if (savedLastId && newSessions.some((s) => s.id === savedLastId)) {
        newLastId = savedLastId
      }
    }
  } catch (e) {
    console.warn('加载会话历史失败', e)
  }

  // 原子赋值：仅在 currentSessionId 实际变化时，watch 才会触发 resetStreamingState
  sessions.value = newSessions
  currentSessionId.value = newCurrentId
  lastActiveSessionId.value = newLastId
}

/**
 * 保存会话列表到 localStorage
 * @param immediate 是否立即保存（跳过节流）
 */
function saveSessions(immediate = false): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }

  const truncateText = (input: string, maxChars: number) => {
    if (input.length <= maxChars) return input
    return input.slice(0, maxChars)
  }

  const sanitizeMessageForStorage = (msg: ChatMessage): ChatMessage => {
    const images =
      msg.images && msg.images.length > 0
        ? msg.images.filter((url) => typeof url === 'string' && !url.startsWith('data:'))
        : undefined

    const documents =
      msg.documents && msg.documents.length > 0
        ? msg.documents.map((d) => ({
            name: d.name,
            content: truncateText(d.content, 4000),
          }))
        : undefined

    return {
      ...msg,
      images,
      documents,
      content: truncateText(msg.content, 20000),
      thinkingContent: msg.thinkingContent ? truncateText(msg.thinkingContent, 20000) : undefined,
      reasoning_details: msg.reasoning_details
        ? truncateText(msg.reasoning_details, 20000)
        : undefined,
    }
  }

  const doSave = () => {
    try {
      const data = JSON.stringify(
        sessions.value.map((s) => ({
          ...s,
          messages: s.messages.map(sanitizeMessageForStorage),
        })),
      )
      setAiScopedStorageItem(SESSIONS_STORAGE_KEY, data)
    } catch (e) {
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        console.warn('会话历史保存失败：存储配额已满。尝试清理旧数据...')
        // 空间不足时，每次删除最旧的 5 条非置顶会话
        const nonPinnedSessions = sessions.value
          .filter((s) => !s.isPinned)
          .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())

        if (nonPinnedSessions.length > 5) {
          const idsToDelete = nonPinnedSessions.slice(0, 5).map((s) => s.id)
          sessions.value = sessions.value.filter((s) => !idsToDelete.includes(s.id))
          doSave()
        } else if (sessions.value.length > 5) {
          // 如果非置顶会话不足，则删除最旧的 5 条（包括置顶的）
          const allSorted = [...sessions.value].sort(
            (a, b) => a.updatedAt.getTime() - b.updatedAt.getTime(),
          )
          const idsToDelete = allSorted.slice(0, 5).map((s) => s.id)
          sessions.value = sessions.value.filter((s) => !idsToDelete.includes(s.id))
          doSave()
        }
      } else {
        console.warn('保存会话历史失败', e)
      }
    }
  }

  if (immediate) {
    doSave()
  } else {
    saveTimer = setTimeout(doSave, SAVE_THROTTLE_MS)
  }
}

// 初始化加载
if (typeof window !== 'undefined') {
  loadSessions()

  // 页面卸载前确保保存
  window.addEventListener('beforeunload', () => {
    saveSessions(true)
  })

  // 监听会话列表变化自动保存
  watch(sessions, () => saveSessions(), { deep: true })

  window.addEventListener(AI_STORAGE_SCOPE_CHANGE_EVENT, loadSessions)
  window.addEventListener('storage', (event) => {
    if (
      event.key === 'auth' ||
      event.key === null ||
      event.key.startsWith(`${SESSIONS_STORAGE_KEY}::`) ||
      event.key.startsWith(`${CURRENT_SESSION_KEY}::`) ||
      event.key.startsWith(`${LAST_ACTIVE_SESSION_KEY}::`)
    ) {
      loadSessions()
    }
  })
}

// 监听当前会话变化，更新上一个激活的会话并立即保存 ID
watch(
  currentSessionId,
  (newId, oldId) => {
    if (oldId && oldId !== newId && sessions.value.some((s) => s.id === oldId)) {
      lastActiveSessionId.value = oldId
    }
    saveCurrentSessionId(newId)
  },
  { flush: 'sync' },
)

// 监听上一个激活的会话变化并立即保存 ID
watch(
  lastActiveSessionId,
  (newId) => {
    saveLastActiveSessionId(newId)
  },
  { flush: 'sync' },
)

/**
 * 导出内部函数用于测试
 */
export function _resetChatHistory() {
  sessions.value = []
  currentSessionId.value = null
  lastActiveSessionId.value = null
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

export function _loadSessions() {
  loadSessions()
}

/**
 * 会话历史管理 composable
 */
export function useChatHistory() {
  // 当前会话
  const currentSession = computed(
    () => sessions.value.find((s) => s.id === currentSessionId.value) ?? null,
  )

  // 上一个激活的会话
  const lastActiveSession = computed(
    () => sessions.value.find((s) => s.id === lastActiveSessionId.value) ?? null,
  )

  // 会话列表（优先置顶，其次按更新时间倒序）
  const sortedSessions = computed(() => [...sessions.value].sort(compareSessionsByPriority))

  // 是否有会话
  const hasSession = computed(() => sessions.value.length > 0)

  /**
   * 创建新会话
   */
  function createSession(): ChatSession {
    const { memories, isMemoryEnabled } = useMemory()

    const newSession: ChatSession = {
      id: generateId(),
      title: i18n.global.t('ai.newChat'),
      messages: [],
      memorySnapshot:
        isMemoryEnabled.value && memories.value.length > 0 ? [...memories.value] : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      isAutoTitle: true,
    }
    sessions.value.unshift(newSession)
    currentSessionId.value = newSession.id
    saveSessions(true) // 创建新会话立即保存
    return newSession
  }

  /**
   * 切换到指定会话
   */
  function switchSession(sessionId: string): void {
    if (sessions.value.some((s) => s.id === sessionId)) {
      currentSessionId.value = sessionId
    }
  }

  /**
   * 更新会话消息
   * @param sessionId 会话 ID
   * @param messages 消息列表
   * @param immediate 是否立即保存到存储
   */
  function updateSessionMessages(
    sessionId: string,
    messages: ChatMessage[],
    immediate = false,
  ): void {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (!session) return

    session.messages = messages
    session.updatedAt = new Date()

    // 如果是第一条用户消息，且仍处于自动标题模式，则更新标题为消息内容
    const firstUserMsg = messages.find((m) => m.role === 'user')

    if (firstUserMsg && session.isAutoTitle) {
      const title = firstUserMsg.content.trim()
      if (title) {
        session.title = title.slice(0, 100) // 限制标题长度，防止极端情况
      }
    }

    if (immediate) {
      saveSessions(true)
    }
  }

  /**
   * 向指定会话添加单条消息
   */
  function addSessionMessage(sessionId: string, message: ChatMessage, immediate = false): void {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (!session) return

    const newMessages = [...session.messages, message]
    updateSessionMessages(sessionId, newMessages, immediate)
  }

  function updateSessionContextSummary(
    sessionId: string,
    data: { summary: string; untilMessageId: string },
  ): void {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (!session) return

    session.contextSummary = data.summary
    session.contextSummaryUntilMessageId = data.untilMessageId
    session.contextSummaryUpdatedAt = new Date()
    session.updatedAt = new Date()
  }

  function clearSessionContextSummary(sessionId: string): void {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (!session) return

    session.contextSummary = undefined
    session.contextSummaryUntilMessageId = undefined
    session.contextSummaryUpdatedAt = undefined
    session.updatedAt = new Date()
  }

  /**
   * 切换置顶状态
   */
  function togglePin(sessionId: string): void {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session) {
      session.isPinned = !session.isPinned
      session.updatedAt = new Date() // 更新时间，确保置顶时排在最前面
      saveSessions()
    }
  }

  /**
   * 修改会话标题
   */
  function renameSession(sessionId: string, newTitle: string): void {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session && newTitle.trim()) {
      session.title = newTitle.trim()
      session.isAutoTitle = false // 手动重命名后关闭自动标题
      session.updatedAt = new Date()
    }
  }

  /**
   * 删除单个会话
   */
  function deleteSession(sessionId: string): void {
    const index = sessions.value.findIndex((s) => s.id === sessionId)
    if (index === -1) return

    sessions.value.splice(index, 1)

    // 如果删除的是当前会话，切换到下一个
    if (currentSessionId.value === sessionId) {
      if (sessions.value.length === 0) {
        currentSessionId.value = null
      } else if (
        lastActiveSessionId.value &&
        lastActiveSessionId.value !== sessionId &&
        sessions.value.some((s) => s.id === lastActiveSessionId.value)
      ) {
        currentSessionId.value = lastActiveSessionId.value
      } else {
        const fallbackSession = [...sessions.value].sort(compareSessionsByPriority)[0]
        currentSessionId.value = fallbackSession?.id ?? null
      }
    }

    // 如果删除的是上一个激活的会话，重置它
    if (lastActiveSessionId.value === sessionId) {
      lastActiveSessionId.value = null
    }

    saveSessions(true) // 删除会话立即保存
  }

  /**
   * 删除所有会话
   */
  function clearAllSessions(): void {
    sessions.value = []
    currentSessionId.value = null
    lastActiveSessionId.value = null
    // 强制清理 localStorage
    removeAiScopedStorageItem(SESSIONS_STORAGE_KEY)
    removeAiScopedStorageItem(CURRENT_SESSION_KEY)
    removeAiScopedStorageItem(LAST_ACTIVE_SESSION_KEY)
    saveSessions(true) // 立即同步状态
  }

  /**
   * 获取或创建当前会话
   */
  function getOrCreateCurrentSession(): ChatSession {
    if (currentSession.value) return currentSession.value
    return createSession()
  }

  return {
    // 状态
    sessions: sortedSessions,
    currentSession,
    currentSessionId,
    lastActiveSession,
    lastActiveSessionId,
    hasSession,

    // 方法
    createSession,
    switchSession,
    updateSessionMessages,
    addSessionMessage,
    updateSessionContextSummary,
    clearSessionContextSummary,
    renameSession,
    togglePin,
    deleteSession,
    clearAllSessions,
    getOrCreateCurrentSession,
  }
}
