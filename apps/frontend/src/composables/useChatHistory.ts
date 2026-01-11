import { ref, computed, watch } from 'vue'
import i18n from '@/i18n'
import { generateId } from '@/services/aiService'
import type { ChatMessage } from '@/services/aiService'

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  isPinned?: boolean
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

/**
 * 保存当前会话 ID 到 localStorage
 */
function saveCurrentSessionId(id: string | null): void {
  if (id) {
    localStorage.setItem(CURRENT_SESSION_KEY, id)
  } else {
    localStorage.removeItem(CURRENT_SESSION_KEY)
  }
}

/**
 * 保存上一个激活的会话 ID 到 localStorage
 */
function saveLastActiveSessionId(id: string | null): void {
  if (id) {
    localStorage.setItem(LAST_ACTIVE_SESSION_KEY, id)
  } else {
    localStorage.removeItem(LAST_ACTIVE_SESSION_KEY)
  }
}

/**
 * 从 localStorage 加载会话列表
 */
function loadSessions(): void {
  try {
    const saved = localStorage.getItem(SESSIONS_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      sessions.value = parsed.map((s: ChatSession) => ({
        ...s,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
        messages: s.messages.map((msg: ChatMessage) => ({
          ...msg,
          createdAt: msg.createdAt ? new Date(msg.createdAt) : undefined,
        })),
      }))
    }

    // 加载当前会话 ID
    const savedCurrentId = localStorage.getItem(CURRENT_SESSION_KEY)
    if (savedCurrentId && sessions.value.some((s) => s.id === savedCurrentId)) {
      currentSessionId.value = savedCurrentId
    } else if (sessions.value.length > 0) {
      // 回退逻辑：优先选择最近更新的会话
      const latestSession = [...sessions.value].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
      )[0]
      currentSessionId.value = latestSession.id
    }

    // 加载上一个激活的会话 ID
    const savedLastId = localStorage.getItem(LAST_ACTIVE_SESSION_KEY)
    if (savedLastId && sessions.value.some((s) => s.id === savedLastId)) {
      lastActiveSessionId.value = savedLastId
    }
  } catch {
    console.warn('加载会话历史失败')
  }
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

  const doSave = () => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions.value))
    } catch {
      console.warn('保存会话历史失败')
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
  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) => {
      // 优先置顶
      if (a.isPinned && !b.isPinned) return -1
      if (!a.isPinned && b.isPinned) return 1
      // 其次按更新时间倒序
      return b.updatedAt.getTime() - a.updatedAt.getTime()
    }),
  )

  // 是否有会话
  const hasSession = computed(() => sessions.value.length > 0)

  /**
   * 创建新会话
   */
  function createSession(): ChatSession {
    const newSession: ChatSession = {
      id: generateId(),
      title: i18n.global.t('ai.newChat'),
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
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
   */
  function updateSessionMessages(sessionId: string, messages: ChatMessage[]): void {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (!session) return

    session.messages = messages
    session.updatedAt = new Date()

    // 如果是第一条用户消息，且标题仍为默认值，则更新标题为消息内容
    const firstUserMsg = messages.find((m) => m.role === 'user')
    const isDefaultTitle =
      session.title === '新对话' ||
      session.title === 'New Chat' ||
      session.title === i18n.global.t('ai.newChat')

    if (firstUserMsg && (isDefaultTitle || !session.title)) {
      const title = firstUserMsg.content.trim()
      if (title) {
        session.title = title.slice(0, 100) // 限制标题长度，防止极端情况
      }
    }
  }

  /**
   * 切换置顶状态
   */
  function togglePin(sessionId: string): void {
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session) {
      session.isPinned = !session.isPinned
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
      currentSessionId.value = sessions.value.length > 0 ? sessions.value[0].id : null
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
    localStorage.removeItem(SESSIONS_STORAGE_KEY)
    localStorage.removeItem(CURRENT_SESSION_KEY)
    localStorage.removeItem(LAST_ACTIVE_SESSION_KEY)
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
    renameSession,
    togglePin,
    deleteSession,
    clearAllSessions,
    getOrCreateCurrentSession,
  }
}
