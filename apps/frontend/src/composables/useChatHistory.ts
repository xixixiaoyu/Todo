import { ref, computed, watch } from 'vue'
import { generateId } from '@/services/aiService'
import type { ChatMessage } from '@/services/aiService'

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

const SESSIONS_STORAGE_KEY = 'ai-chat-sessions'
const CURRENT_SESSION_KEY = 'ai-chat-current-session'
const SAVE_THROTTLE_MS = 500

// 全局单例状态
const sessions = ref<ChatSession[]>([])
const currentSessionId = ref<string | null>(null)
let saveTimer: ReturnType<typeof setTimeout> | null = null

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
      currentSessionId.value = sessions.value[0].id
    }
  } catch {
    console.warn('加载会话历史失败')
  }
}

/**
 * 保存会话列表到 localStorage（节流）
 */
function saveSessions(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions.value))
      if (currentSessionId.value) {
        localStorage.setItem(CURRENT_SESSION_KEY, currentSessionId.value)
      }
    } catch {
      console.warn('保存会话历史失败')
    }
  }, SAVE_THROTTLE_MS)
}

// 初始化加载
if (typeof window !== 'undefined') {
  loadSessions()
}

// 监听变化自动保存
watch([sessions, currentSessionId], saveSessions, { deep: true })

/**
 * 导出重置函数用于测试
 */
export function _reset() {
  sessions.value = []
  currentSessionId.value = null
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

/**
 * 会话历史管理 composable
 */
export function useChatHistory() {
  // 当前会话
  const currentSession = computed(
    () => sessions.value.find((s) => s.id === currentSessionId.value) ?? null,
  )

  // 会话列表（按更新时间倒序）
  const sortedSessions = computed(() =>
    [...sessions.value].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
  )

  // 是否有会话
  const hasSession = computed(() => sessions.value.length > 0)

  /**
   * 创建新会话
   */
  function createSession(): ChatSession {
    const newSession: ChatSession = {
      id: generateId(),
      title: '新对话',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    sessions.value.unshift(newSession)
    currentSessionId.value = newSession.id
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

    // 如果是第一条用户消息，更新标题
    const firstUserMsg = messages.find((m) => m.role === 'user')
    if (firstUserMsg && session.title === '新对话') {
      session.title =
        firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')
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
  }

  /**
   * 删除所有会话
   */
  function deleteAllSessions(): void {
    sessions.value = []
    currentSessionId.value = null
    localStorage.removeItem(SESSIONS_STORAGE_KEY)
    localStorage.removeItem(CURRENT_SESSION_KEY)
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
    hasSession,

    // 方法
    createSession,
    switchSession,
    updateSessionMessages,
    renameSession,
    deleteSession,
    deleteAllSessions,
    getOrCreateCurrentSession,
  }
}
