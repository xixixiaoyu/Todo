import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import i18n from '@/i18n'
import { useChatHistory, _resetChatHistory } from '@/composables/useChatHistory'
import { type ChatMessage } from '@/services/aiService'

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}

  return {
    getItem(key: string): string | null {
      return store[key] || null
    },
    setItem(key: string, value: string): void {
      store[key] = value.toString()
    },
    removeItem(key: string): void {
      delete store[key]
    },
    clear(): void {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

describe('useChatHistory', () => {
  beforeEach(() => {
    // 重置全局状态
    _resetChatHistory()
    // 清除所有现有数据
    localStorage.clear()

    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2023, 0, 1)) // 设置固定时间以便测试日期
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should initialize with empty sessions', () => {
      const { sessions, currentSession, hasSession } = useChatHistory()

      expect(sessions.value).toEqual([])
      expect(currentSession.value).toBeNull()
      expect(hasSession.value).toBe(false)
    })
  })

  describe('createSession', () => {
    it('should create a new session', () => {
      const { sessions, currentSession, createSession } = useChatHistory()

      const newSession = createSession()

      expect(sessions.value).toHaveLength(1)
      expect(currentSession.value).toEqual(newSession)
      expect(newSession.id).toBeDefined()
      expect(newSession.title).toBe(i18n.global.t('ai.newChat'))
      expect(newSession.messages).toEqual([])
      expect(newSession.createdAt).toBeInstanceOf(Date)
      expect(newSession.updatedAt).toBeInstanceOf(Date)
    })

    it('should set the new session as current', () => {
      const { currentSession, currentSessionId, createSession } = useChatHistory()

      const newSession = createSession()

      expect(currentSession.value).toEqual(newSession)
      expect(currentSessionId.value).toBe(newSession.id)
    })
  })

  describe('updateSessionMessages', () => {
    it('should update messages for a specific session', () => {
      const { sessions, createSession, updateSessionMessages } = useChatHistory()

      const session = createSession()
      const originalUpdatedAt = session.updatedAt.getTime()
      const newMessages: ChatMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date() },
        { id: 'msg-2', role: 'assistant', content: 'Hi', createdAt: new Date() },
      ]

      // advance timer to ensure updatedAt will be different
      vi.advanceTimersByTime(100)
      updateSessionMessages(session.id, newMessages)

      expect(sessions.value[0].messages).toEqual(newMessages)
      expect(sessions.value[0].updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt) // Should be updated
    })

    it('should update session title if it is the default and first user message exists', () => {
      const { sessions, createSession, updateSessionMessages } = useChatHistory()

      const session = createSession()
      const messages: ChatMessage[] = [
        { id: 'msg-1', role: 'user', content: 'Initial user message', createdAt: new Date() },
        { id: 'msg-2', role: 'assistant', content: 'Response', createdAt: new Date() },
      ]

      updateSessionMessages(session.id, messages)

      expect(sessions.value[0].title).toBe('Initial user message')
    })

    it('should use full message as title', () => {
      const { sessions, createSession, updateSessionMessages } = useChatHistory()

      const session = createSession()
      const longContent = 'A'.repeat(50) // Create a long string
      const messages: ChatMessage[] = [
        { id: 'msg-1', role: 'user', content: longContent, createdAt: new Date() },
      ]

      updateSessionMessages(session.id, messages)

      expect(sessions.value[0].title).toBe(longContent)
    })
  })

  describe('renameSession', () => {
    it('should update session title', () => {
      const { sessions, createSession, renameSession } = useChatHistory()

      const session = createSession()
      renameSession(session.id, 'New Title')

      expect(sessions.value[0].title).toBe('New Title')
    })
  })

  describe('getOrCreateCurrentSession', () => {
    it('should return current session if exists', () => {
      const { getOrCreateCurrentSession, createSession } = useChatHistory()

      const session = createSession()
      const returnedSession = getOrCreateCurrentSession()

      expect(returnedSession).toEqual(session)
    })

    it('should create a new session if none exists', () => {
      const { getOrCreateCurrentSession, currentSession } = useChatHistory()

      const returnedSession = getOrCreateCurrentSession()

      expect(returnedSession).toEqual(currentSession.value)
      expect(returnedSession).toBeDefined()
    })
  })

  describe('auto-save', () => {
    it('should save sessions to localStorage after changes', () => {
      const { createSession } = useChatHistory()

      const session = createSession()

      // Wait for the throttle timeout
      vi.advanceTimersByTime(600)

      const saved = localStorage.getItem('ai-chat-sessions')
      expect(saved).toBeTruthy()
      const parsed = JSON.parse(saved!)
      expect(parsed).toHaveLength(1)
      expect(parsed[0].id).toBe(session.id)
    })

    it('should save current session ID to localStorage', () => {
      const { createSession } = useChatHistory()

      const session = createSession()

      // Wait for the throttle timeout
      vi.advanceTimersByTime(600)

      const saved = localStorage.getItem('ai-chat-current-session')
      expect(saved).toBe(session.id)
    })
  })

  describe('lastActiveSessionId', () => {
    it('should update lastActiveSessionId when currentSessionId changes', async () => {
      const { createSession, switchSession, lastActiveSessionId } = useChatHistory()

      createSession() // session1
      await nextTick()
      const session2 = createSession()
      await nextTick()

      // 初始状态：创建 session2 后，session1 成为上一个激活的
      const session1Id = lastActiveSessionId.value
      expect(session1Id).not.toBeNull()

      switchSession(session1Id!)
      await nextTick()
      expect(lastActiveSessionId.value).toBe(session2.id)

      switchSession(session2.id)
      await nextTick()
      expect(lastActiveSessionId.value).toBe(session1Id)
    })

    it('should clear lastActiveSessionId when the last active session is deleted', async () => {
      const { createSession, deleteSession, lastActiveSessionId } = useChatHistory()

      createSession() // session1
      await nextTick()
      const session1Id = lastActiveSessionId.value // This might still be null if only 1 session exists

      const session2 = createSession()
      await nextTick()
      const lastId = lastActiveSessionId.value
      expect(lastId).not.toBeNull()

      deleteSession(lastId!)
      await nextTick()
      expect(lastActiveSessionId.value).toBeNull()
    })
  })
})
