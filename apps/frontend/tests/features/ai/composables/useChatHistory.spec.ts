import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useChatHistory,
  _resetChatHistory,
  _loadSessions,
} from '@/features/ai/composables/useChatHistory'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import { _resetMemory } from '@/features/ai/composables/useMemory'
import {
  buildAiScopedStorageKey,
  emitAiStorageScopeChanged,
} from '@/features/ai/composables/aiStorageScope'

/**
 * 模拟从 localStorage 解析出的会话类型（Date 变为 string）
 */
type SerializedChatSession = Omit<
  ChatSession,
  'createdAt' | 'updatedAt' | 'contextSummaryUpdatedAt'
> & {
  createdAt: string
  updatedAt: string
  contextSummaryUpdatedAt?: string
  isAutoTitle?: boolean
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
    _resetMemory()
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
      localStorage.getItem(buildAiScopedStorageKey('ai-chat-sessions')) || '[]',
    ) as SerializedChatSession[]
    expect(savedSessions.some((s) => s.id === sessionId)).toBe(true)
    expect(localStorage.getItem(buildAiScopedStorageKey('ai-chat-current-session'))).toBe(sessionId)

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
    expect(localStorage.getItem(buildAiScopedStorageKey('ai-chat-current-session'))).toBe(sessionId)

    // 验证是否已立即保存到 sessions 列表
    const savedSessions = JSON.parse(
      localStorage.getItem(buildAiScopedStorageKey('ai-chat-sessions')) || '[]',
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
      localStorage.getItem(buildAiScopedStorageKey('ai-chat-sessions')) || '[]',
    ) as SerializedChatSession[]
    const sessionBefore = savedSessionsBefore.find((s) => s.id === session.id)
    expect(sessionBefore?.messages.length).toBe(0)

    // 模拟 beforeunload 事件
    window.dispatchEvent(new Event('beforeunload'))

    // 验证此时 localStorage 已经更新
    const savedSessionsAfter = JSON.parse(
      localStorage.getItem(buildAiScopedStorageKey('ai-chat-sessions')) || '[]',
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
    // togglePin 会更新时间，因此在同为置顶时，后置顶的会话会排在更前面。
    expect(sessions.value[0].id).toBe(s2.id)
    expect(sessions.value[1].id).toBe(s1.id)
    expect(sessions.value[2].id).toBe(s3.id)
  })

  it('should auto-generate title from first user message only when isAutoTitle is true', () => {
    const { createSession, updateSessionMessages, renameSession } = useChatHistory()
    const session = createSession()

    expect(session.isAutoTitle).toBe(true)

    // 1. 第一次更新消息，自动设置标题
    updateSessionMessages(session.id, [{ id: '1', role: 'user', content: 'First Query' }])
    expect(session.title).toBe('First Query')

    // 2. 手动重命名
    renameSession(session.id, 'Manual Title')
    expect(session.title).toBe('Manual Title')
    expect(session.isAutoTitle).toBe(false)

    // 3. 再次更新消息，不应更新标题
    updateSessionMessages(session.id, [
      { id: '1', role: 'user', content: 'First Query' },
      { id: '2', role: 'assistant', content: 'Answer' },
      { id: '3', role: 'user', content: 'Second Query' },
    ])
    expect(session.title).toBe('Manual Title')
  })

  it('should switch to last active session when deleting current session', async () => {
    const { createSession, switchSession, currentSessionId, lastActiveSessionId, deleteSession } =
      useChatHistory()

    const s1 = createSession()
    await vi.advanceTimersByTimeAsync(10)
    const s2 = createSession()

    switchSession(s1.id)
    switchSession(s2.id)

    expect(currentSessionId.value).toBe(s2.id)
    expect(lastActiveSessionId.value).toBe(s1.id)

    deleteSession(s2.id)

    expect(currentSessionId.value).toBe(s1.id)
  })

  it('should switch to highest-priority session when last active is unavailable', async () => {
    const { createSession, switchSession, togglePin, currentSessionId, deleteSession } =
      useChatHistory()

    const s1 = createSession()
    await vi.advanceTimersByTimeAsync(10)
    const s2 = createSession()
    await vi.advanceTimersByTimeAsync(10)
    const s3 = createSession()

    togglePin(s1.id)
    switchSession(s3.id)

    deleteSession(s2.id)
    expect(currentSessionId.value).toBe(s3.id)

    deleteSession(s3.id)
    expect(currentSessionId.value).toBe(s1.id)
  })

  it('should reload chat sessions when active user changes', () => {
    const user1Sessions = [
      {
        id: 'user-1-session',
        title: 'User 1',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    const user2Sessions = [
      {
        id: 'user-2-session',
        title: 'User 2',
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]

    localStorage.setItem('auth', JSON.stringify({ user: { id: 'user-1' } }))
    localStorage.setItem(
      buildAiScopedStorageKey('ai-chat-sessions', 'user-1'),
      JSON.stringify(user1Sessions),
    )
    localStorage.setItem(
      buildAiScopedStorageKey('ai-chat-current-session', 'user-1'),
      'user-1-session',
    )

    _loadSessions()

    const { currentSessionId } = useChatHistory()
    expect(currentSessionId.value).toBe('user-1-session')

    localStorage.setItem('auth', JSON.stringify({ user: { id: 'user-2' } }))
    localStorage.setItem(
      buildAiScopedStorageKey('ai-chat-sessions', 'user-2'),
      JSON.stringify(user2Sessions),
    )
    localStorage.setItem(
      buildAiScopedStorageKey('ai-chat-current-session', 'user-2'),
      'user-2-session',
    )
    emitAiStorageScopeChanged('user-2')

    expect(currentSessionId.value).toBe('user-2-session')
  })
})
