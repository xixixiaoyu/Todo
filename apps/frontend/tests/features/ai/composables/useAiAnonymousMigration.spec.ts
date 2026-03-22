import { describe, it, expect, beforeEach } from 'vitest'
import {
  _resetAnonymousAiMigrationPromptState,
  dismissAnonymousAiMigrationPrompt,
  getAnonymousAiDataSummary,
  migrateAnonymousAiDataToUser,
  migrateAnonymousAiMemoriesToUser,
  reopenAnonymousAiMigrationPrompt,
  requestAnonymousAiMigration,
  useAiAnonymousMigrationPrompt,
} from '@/features/ai/composables/useAiAnonymousMigration'
import { buildAiScopedStorageKey } from '@/features/ai/composables/aiStorageScope'

describe('useAiAnonymousMigration', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetAnonymousAiMigrationPromptState()
  })

  it('should request migration prompt only when anonymous AI data exists', () => {
    requestAnonymousAiMigration(1)
    expect(useAiAnonymousMigrationPrompt().pendingAnonymousMigration.value).toBeNull()

    localStorage.setItem(buildAiScopedStorageKey('ai-memories', null), JSON.stringify(['Memory A']))
    requestAnonymousAiMigration(1)

    expect(useAiAnonymousMigrationPrompt().pendingAnonymousMigration.value).toEqual({
      userId: 1,
      summary: {
        memoryCount: 1,
        sessionCount: 0,
      },
    })

    dismissAnonymousAiMigrationPrompt()
    reopenAnonymousAiMigrationPrompt()
    expect(useAiAnonymousMigrationPrompt().pendingAnonymousMigration.value).toEqual({
      userId: 1,
      summary: {
        memoryCount: 1,
        sessionCount: 0,
      },
    })
  })

  it('should merge anonymous memories and sessions into user scope', async () => {
    localStorage.setItem(
      buildAiScopedStorageKey('ai-memories', null),
      JSON.stringify(['Guest Memory', 'Shared Memory']),
    )
    localStorage.setItem(buildAiScopedStorageKey('ai-memory-enabled', null), 'true')
    localStorage.setItem(buildAiScopedStorageKey('ai-memory-threshold', null), '25')
    localStorage.setItem(
      buildAiScopedStorageKey('ai-chat-sessions', null),
      JSON.stringify([
        {
          id: 'guest-session',
          title: 'Guest Chat',
          messages: [{ id: 'u1', role: 'user', content: 'hello' }],
          createdAt: new Date('2026-03-20T10:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-03-20T10:05:00.000Z').toISOString(),
        },
      ]),
    )
    localStorage.setItem(buildAiScopedStorageKey('ai-chat-current-session', null), 'guest-session')
    localStorage.setItem(
      buildAiScopedStorageKey('ai-memories', 1),
      JSON.stringify(['User Memory', 'Shared Memory']),
    )
    localStorage.setItem(
      buildAiScopedStorageKey('ai-chat-sessions', 1),
      JSON.stringify([
        {
          id: 'user-session',
          title: 'User Chat',
          messages: [],
          createdAt: new Date('2026-03-21T10:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-03-21T10:05:00.000Z').toISOString(),
        },
      ]),
    )
    localStorage.setItem(buildAiScopedStorageKey('ai-chat-current-session', 1), 'user-session')

    const result = await migrateAnonymousAiDataToUser(1)

    expect(result).toEqual({
      importedMemoryCount: 2,
      importedSessionCount: 1,
    })
    expect(
      JSON.parse(localStorage.getItem(buildAiScopedStorageKey('ai-memories', 1)) || '[]'),
    ).toEqual(['User Memory', 'Shared Memory', 'Guest Memory'])
    expect(localStorage.getItem(buildAiScopedStorageKey('ai-memory-enabled', 1))).toBe('true')
    expect(localStorage.getItem(buildAiScopedStorageKey('ai-memory-threshold', 1))).toBe('25')

    const sessions = JSON.parse(
      localStorage.getItem(buildAiScopedStorageKey('ai-chat-sessions', 1)) || '[]',
    ) as Array<{ id: string }>
    expect(sessions.map((session) => session.id)).toEqual(['user-session', 'guest-session'])
    expect(localStorage.getItem(buildAiScopedStorageKey('ai-chat-current-session', 1))).toBe(
      'guest-session',
    )
    expect(localStorage.getItem(buildAiScopedStorageKey('ai-chat-last-active-session', 1))).toBe(
      'user-session',
    )

    expect(getAnonymousAiDataSummary()).toEqual({
      memoryCount: 0,
      sessionCount: 0,
    })
  })

  it('should import only memories and keep anonymous sessions available for later import', async () => {
    localStorage.setItem(
      buildAiScopedStorageKey('ai-memories', null),
      JSON.stringify(['Guest Memory']),
    )
    localStorage.setItem(
      buildAiScopedStorageKey('ai-chat-sessions', null),
      JSON.stringify([
        {
          id: 'guest-session',
          title: 'Guest Chat',
          messages: [{ id: 'u1', role: 'user', content: 'hello' }],
          createdAt: new Date('2026-03-20T10:00:00.000Z').toISOString(),
          updatedAt: new Date('2026-03-20T10:05:00.000Z').toISOString(),
        },
      ]),
    )
    requestAnonymousAiMigration(1)

    const result = await migrateAnonymousAiMemoriesToUser(1)

    expect(result).toEqual({
      importedMemoryCount: 1,
      remainingSessionCount: 1,
    })
    expect(
      JSON.parse(localStorage.getItem(buildAiScopedStorageKey('ai-memories', 1)) || '[]'),
    ).toEqual(['Guest Memory'])
    expect(getAnonymousAiDataSummary()).toEqual({
      memoryCount: 0,
      sessionCount: 1,
    })
    expect(useAiAnonymousMigrationPrompt().pendingAnonymousMigration.value).toBeNull()

    reopenAnonymousAiMigrationPrompt()
    expect(useAiAnonymousMigrationPrompt().pendingAnonymousMigration.value).toEqual({
      userId: 1,
      summary: {
        memoryCount: 0,
        sessionCount: 1,
      },
    })
  })
})
