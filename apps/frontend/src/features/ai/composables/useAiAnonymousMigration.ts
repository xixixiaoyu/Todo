import { ref } from 'vue'
import {
  emitAiStorageScopeChanged,
  getAiScopedStorageItem,
  getAiStorageScope,
  removeAiScopedStorageItem,
  setAiScopedStorageItem,
} from './aiStorageScope'

const MEMORY_STORAGE_KEY = 'ai-memories'
const MEMORY_ENABLED_KEY = 'ai-memory-enabled'
const MEMORY_THRESHOLD_KEY = 'ai-memory-threshold'
const SESSIONS_STORAGE_KEY = 'ai-chat-sessions'
const CURRENT_SESSION_KEY = 'ai-chat-current-session'
const LAST_ACTIVE_SESSION_KEY = 'ai-chat-last-active-session'
const MAX_MEMORIES = 100
const MAX_MEMORY_CHARS = 200

type SerializedChatSession = Record<string, unknown> & {
  id?: string
  updatedAt?: string
}

export interface AnonymousAiDataSummary {
  memoryCount: number
  sessionCount: number
}

type PendingAnonymousMigration = {
  userId: string | number
  summary: AnonymousAiDataSummary
}

const pendingAnonymousMigration = ref<PendingAnonymousMigration | null>(null)
const availableAnonymousMigration = ref<PendingAnonymousMigration | null>(null)
const promptedScopes = new Set<string>()

function normalizeMemoryEntry(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return null

  return normalized.slice(0, MAX_MEMORY_CHARS)
}

function loadScopedStringArray(baseKey: string, userId: string | number | null): string[] {
  try {
    const raw = getAiScopedStorageItem(baseKey, userId)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => normalizeMemoryEntry(item))
      .filter((item): item is string => !!item)
      .slice(-MAX_MEMORIES)
  } catch {
    return []
  }
}

function loadScopedSessions(userId: string | number | null): SerializedChatSession[] {
  try {
    const raw = getAiScopedStorageItem(SESSIONS_STORAGE_KEY, userId)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is SerializedChatSession => {
      return !!item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'
    })
  } catch {
    return []
  }
}

function findSimilarMemory(content: string, targetMemories: readonly string[]): string | null {
  const normalized = content.trim().toLowerCase()
  if (!normalized) return null

  return (
    targetMemories.find((memory) => {
      const existingNormalized = memory.trim().toLowerCase()
      if (existingNormalized === normalized) return true

      try {
        const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b${escaped}\\b`, 'i')
        return (
          regex.test(existingNormalized) ||
          new RegExp(
            `\\b${existingNormalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            'i',
          ).test(normalized)
        )
      } catch {
        return false
      }
    }) || null
  )
}

function mergeMemories(
  userMemories: readonly string[],
  anonymousMemories: readonly string[],
): string[] {
  const merged = [...userMemories]

  for (const memory of anonymousMemories) {
    if (!findSimilarMemory(memory, merged)) {
      merged.push(memory)
    }
  }

  return merged.slice(-MAX_MEMORIES)
}

function sortSessionsByUpdatedAtDesc(
  sessions: readonly SerializedChatSession[],
): SerializedChatSession[] {
  return [...sessions].sort((left, right) => {
    const leftTime = Date.parse(left.updatedAt || '') || 0
    const rightTime = Date.parse(right.updatedAt || '') || 0
    return rightTime - leftTime
  })
}

function mergeSessions(
  userSessions: readonly SerializedChatSession[],
  anonymousSessions: readonly SerializedChatSession[],
): SerializedChatSession[] {
  const merged = new Map<string, SerializedChatSession>()

  for (const session of userSessions) {
    if (typeof session.id === 'string') {
      merged.set(session.id, session)
    }
  }

  for (const session of anonymousSessions) {
    if (typeof session.id === 'string' && !merged.has(session.id)) {
      merged.set(session.id, session)
    }
  }

  return sortSessionsByUpdatedAtDesc(Array.from(merged.values()))
}

function hasScopedValue(baseKey: string, userId: string | number | null): boolean {
  return getAiScopedStorageItem(baseKey, userId) !== null
}

function clearAnonymousAiData(): void {
  removeAiScopedStorageItem(MEMORY_STORAGE_KEY, null)
  removeAiScopedStorageItem(MEMORY_ENABLED_KEY, null)
  removeAiScopedStorageItem(MEMORY_THRESHOLD_KEY, null)
  removeAiScopedStorageItem(SESSIONS_STORAGE_KEY, null)
  removeAiScopedStorageItem(CURRENT_SESSION_KEY, null)
  removeAiScopedStorageItem(LAST_ACTIVE_SESSION_KEY, null)
}

function clearAnonymousMemoryData(): void {
  removeAiScopedStorageItem(MEMORY_STORAGE_KEY, null)
  removeAiScopedStorageItem(MEMORY_ENABLED_KEY, null)
  removeAiScopedStorageItem(MEMORY_THRESHOLD_KEY, null)
}

function setMigrationState(prompt: PendingAnonymousMigration | null, openPrompt: boolean): void {
  availableAnonymousMigration.value = prompt
  pendingAnonymousMigration.value = openPrompt ? prompt : null
}

function syncAnonymousMemoryStateToUser(
  userId: string | number,
  anonymousMemoryCount: number,
): void {
  if (!hasScopedValue(MEMORY_ENABLED_KEY, userId)) {
    const anonymousEnabled = getAiScopedStorageItem(MEMORY_ENABLED_KEY, null)
    if (anonymousEnabled !== null) {
      setAiScopedStorageItem(MEMORY_ENABLED_KEY, anonymousEnabled, userId)
    } else if (anonymousMemoryCount > 0) {
      setAiScopedStorageItem(MEMORY_ENABLED_KEY, 'true', userId)
    }
  }

  if (!hasScopedValue(MEMORY_THRESHOLD_KEY, userId)) {
    const anonymousThreshold = getAiScopedStorageItem(MEMORY_THRESHOLD_KEY, null)
    if (anonymousThreshold !== null) {
      setAiScopedStorageItem(MEMORY_THRESHOLD_KEY, anonymousThreshold, userId)
    }
  }
}

function updateMigrationStateAfterPartialImport(userId: string | number): void {
  const summary = getAnonymousAiDataSummary()
  if (summary.memoryCount === 0 && summary.sessionCount === 0) {
    setMigrationState(null, false)
    return
  }

  setMigrationState({ userId, summary }, false)
}

export function getAnonymousAiDataSummary(): AnonymousAiDataSummary {
  return {
    memoryCount: loadScopedStringArray(MEMORY_STORAGE_KEY, null).length,
    sessionCount: loadScopedSessions(null).length,
  }
}

export function requestAnonymousAiMigration(userId: string | number | null | undefined): void {
  if (userId === null || userId === undefined) return

  const scope = getAiStorageScope(userId)
  if (promptedScopes.has(scope)) return

  const summary = getAnonymousAiDataSummary()
  if (summary.memoryCount === 0 && summary.sessionCount === 0) return

  promptedScopes.add(scope)
  setMigrationState({ userId, summary }, true)
}

export function dismissAnonymousAiMigrationPrompt(): void {
  pendingAnonymousMigration.value = null
}

export function reopenAnonymousAiMigrationPrompt(): void {
  if (availableAnonymousMigration.value) {
    pendingAnonymousMigration.value = availableAnonymousMigration.value
  }
}

export function useAiAnonymousMigrationPrompt() {
  return {
    availableAnonymousMigration,
    pendingAnonymousMigration,
    dismissAnonymousAiMigrationPrompt,
    reopenAnonymousAiMigrationPrompt,
  }
}

export async function migrateAnonymousAiMemoriesToUser(userId: string | number): Promise<{
  importedMemoryCount: number
  remainingSessionCount: number
}> {
  const anonymousMemories = loadScopedStringArray(MEMORY_STORAGE_KEY, null)
  const userMemories = loadScopedStringArray(MEMORY_STORAGE_KEY, userId)
  const mergedMemories = mergeMemories(userMemories, anonymousMemories)

  if (mergedMemories.length > 0) {
    setAiScopedStorageItem(MEMORY_STORAGE_KEY, JSON.stringify(mergedMemories), userId)
  }

  syncAnonymousMemoryStateToUser(userId, anonymousMemories.length)
  clearAnonymousMemoryData()
  emitAiStorageScopeChanged(userId)
  dismissAnonymousAiMigrationPrompt()
  updateMigrationStateAfterPartialImport(userId)

  return {
    importedMemoryCount: anonymousMemories.length,
    remainingSessionCount: getAnonymousAiDataSummary().sessionCount,
  }
}

export async function migrateAnonymousAiDataToUser(userId: string | number): Promise<{
  importedMemoryCount: number
  importedSessionCount: number
}> {
  const anonymousMemories = loadScopedStringArray(MEMORY_STORAGE_KEY, null)
  const userMemories = loadScopedStringArray(MEMORY_STORAGE_KEY, userId)
  const mergedMemories = mergeMemories(userMemories, anonymousMemories)

  if (mergedMemories.length > 0) {
    setAiScopedStorageItem(MEMORY_STORAGE_KEY, JSON.stringify(mergedMemories), userId)
  }

  syncAnonymousMemoryStateToUser(userId, anonymousMemories.length)

  const anonymousSessions = loadScopedSessions(null)
  const userSessions = loadScopedSessions(userId)
  const mergedSessions = mergeSessions(userSessions, anonymousSessions)

  if (mergedSessions.length > 0) {
    setAiScopedStorageItem(SESSIONS_STORAGE_KEY, JSON.stringify(mergedSessions), userId)
  }

  const anonymousCurrentSessionId = getAiScopedStorageItem(CURRENT_SESSION_KEY, null)
  const userCurrentSessionId = getAiScopedStorageItem(CURRENT_SESSION_KEY, userId)
  const anonymousLastActiveSessionId = getAiScopedStorageItem(LAST_ACTIVE_SESSION_KEY, null)
  const userLastActiveSessionId = getAiScopedStorageItem(LAST_ACTIVE_SESSION_KEY, userId)
  const mergedSessionIds = new Set(
    mergedSessions
      .map((session) => session.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0),
  )

  if (anonymousCurrentSessionId && mergedSessionIds.has(anonymousCurrentSessionId)) {
    setAiScopedStorageItem(CURRENT_SESSION_KEY, anonymousCurrentSessionId, userId)

    if (
      userCurrentSessionId &&
      userCurrentSessionId !== anonymousCurrentSessionId &&
      mergedSessionIds.has(userCurrentSessionId)
    ) {
      setAiScopedStorageItem(LAST_ACTIVE_SESSION_KEY, userCurrentSessionId, userId)
    } else if (
      anonymousLastActiveSessionId &&
      anonymousLastActiveSessionId !== anonymousCurrentSessionId &&
      mergedSessionIds.has(anonymousLastActiveSessionId)
    ) {
      setAiScopedStorageItem(LAST_ACTIVE_SESSION_KEY, anonymousLastActiveSessionId, userId)
    }
  } else if (
    !userCurrentSessionId &&
    anonymousLastActiveSessionId &&
    mergedSessionIds.has(anonymousLastActiveSessionId)
  ) {
    setAiScopedStorageItem(CURRENT_SESSION_KEY, anonymousLastActiveSessionId, userId)
  } else if (userLastActiveSessionId && mergedSessionIds.has(userLastActiveSessionId)) {
    setAiScopedStorageItem(LAST_ACTIVE_SESSION_KEY, userLastActiveSessionId, userId)
  }

  clearAnonymousAiData()
  emitAiStorageScopeChanged(userId)
  setMigrationState(null, false)

  return {
    importedMemoryCount: anonymousMemories.length,
    importedSessionCount: anonymousSessions.length,
  }
}

export function _resetAnonymousAiMigrationPromptState(): void {
  setMigrationState(null, false)
  promptedScopes.clear()
}
