import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useChatHistory,
  _resetChatHistory,
  _loadSessions,
} from '@/features/ai/composables/useChatHistory'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'

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

  it('should toggle pin status', async () => {
    const { createSession, togglePin, sessions } = useChatHistory()
    const session = createSession()

    // 初始状态
    expect(session.isPinned).toBeFalsy()

    // 切换置顶
    togglePin(session.id)
    expect(sessions.value[0].isPinned).toBe(true)

    // 再次切换
    togglePin(session.id)
    expect(sessions.value[0].isPinned).toBe(false)
  })

  it('should sort sessions by pin status and then by updatedAt', async () => {
    const { createSession, togglePin, sessions } = useChatHistory()

    // 创建三个会话
    const s1 = createSession()
    await vi.advanceTimersByTimeAsync(1000)
    const s2 = createSession()
    await vi.advanceTimersByTimeAsync(1000)
    const s3 = createSession()

    // 初始排序：s3, s2, s1 (按创建/更新时间倒序)
    expect(sessions.value[0].id).toBe(s3.id)
    expect(sessions.value[1].id).toBe(s2.id)
    expect(sessions.value[2].id).toBe(s1.id)

    // 置顶 s1
    togglePin(s1.id)
    // 排序：s1 (置顶), s3, s2
    expect(sessions.value[0].id).toBe(s1.id)
    expect(sessions.value[1].id).toBe(s3.id)
    expect(sessions.value[2].id).toBe(s2.id)

    // 置顶 s2
    togglePin(s2.id)
    // 排序：s2 (最新置顶), s1 (置顶), s3
    // 注意：s2 的 updatedAt 会因为 togglePin 而更新吗？
    // 在我的实现中，togglePin 并没有显式更新 updatedAt。
    // 但是 sortedSessions 的排序逻辑是：优先 isPinned，然后是 updatedAt。
    // 如果 s2 和 s1 都置顶了，那么 s2 的 updatedAt (更晚) 会让它排在 s1 前面。
    expect(sessions.value[0].id).toBe(s2.id)
    expect(sessions.value[1].id).toBe(s1.id)
    expect(sessions.value[2].id).toBe(s3.id)
  })
})
