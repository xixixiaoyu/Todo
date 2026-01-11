import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatHistory, _resetChatHistory, _loadSessions } from '@/composables/useChatHistory'
import type { ChatSession } from '@/composables/useChatHistory'

/**
 * 模拟从 localStorage 解析出的会话类型（Date 变为 string）
 */
type SerializedChatSession = Omit<ChatSession, 'createdAt' | 'updatedAt'> & {
  createdAt: string
  updatedAt: string
}

// Mock i18n
vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: (key: string) => key,
    },
  },
}))

describe('useChatHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    _resetChatHistory()
  })

  it('should persist new session after creation and reload', async () => {
    const { createSession } = useChatHistory()

    // 1. 创建新会话
    const session = createSession()
    const sessionId = session.id

    // 触发 watcher
    await vi.runAllTimersAsync()

    // 验证是否保存到 localStorage
    const savedSessions = JSON.parse(
      localStorage.getItem('ai-chat-sessions') || '[]',
    ) as SerializedChatSession[]
    expect(savedSessions.some((s) => s.id === sessionId)).toBe(true)
    expect(localStorage.getItem('ai-chat-current-session')).toBe(sessionId)

    // 2. 模拟页面刷新 (重新加载)
    _resetChatHistory()
    _loadSessions()

    const { currentSessionId } = useChatHistory()
    expect(currentSessionId.value).toBe(sessionId)
  })

  it('should fix the issue: new session persists even if refreshed immediately', async () => {
    const { createSession } = useChatHistory()

    // 1. 创建新会话
    const session = createSession()
    const sessionId = session.id

    // 现在 currentSessionId 的 watcher 是 sync 的，且 createSession 也会立即调用 saveSessions(true)
    expect(localStorage.getItem('ai-chat-current-session')).toBe(sessionId)

    // 验证是否已立即保存到 sessions 列表
    const savedSessions = JSON.parse(
      localStorage.getItem('ai-chat-sessions') || '[]',
    ) as SerializedChatSession[]
    expect(savedSessions.some((s) => s.id === sessionId)).toBe(true)

    // 2. 模拟页面刷新 (重新加载)
    _resetChatHistory()
    _loadSessions()

    const { currentSessionId } = useChatHistory()

    // 现在应该保持一致
    expect(currentSessionId.value).toBe(sessionId)
  })

  it('should save pending changes on beforeunload', () => {
    const { updateSessionMessages, createSession } = useChatHistory()
    const session = createSession()

    // 模拟消息更新（这会触发节流保存）
    updateSessionMessages(session.id, [{ id: '1', role: 'user', content: 'hello' }])

    // 验证此时 localStorage 还没有更新消息（因为节流）
    const savedSessionsBefore = JSON.parse(
      localStorage.getItem('ai-chat-sessions') || '[]',
    ) as SerializedChatSession[]
    const sessionBefore = savedSessionsBefore.find((s) => s.id === session.id)
    expect(sessionBefore?.messages.length).toBe(0)

    // 模拟 beforeunload 事件
    window.dispatchEvent(new Event('beforeunload'))

    // 验证此时 localStorage 已经更新
    const savedSessionsAfter = JSON.parse(
      localStorage.getItem('ai-chat-sessions') || '[]',
    ) as SerializedChatSession[]
    const sessionAfter = savedSessionsAfter.find((s) => s.id === session.id)
    expect(sessionAfter?.messages.length).toBe(1)
  })
})
