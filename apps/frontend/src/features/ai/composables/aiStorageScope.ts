const AUTH_STORAGE_KEY = 'auth'
const ANONYMOUS_SCOPE = 'anonymous'

export const AI_STORAGE_SCOPE_CHANGE_EVENT = 'ai:storage-scope-changed'

function normalizeAiUserId(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized || null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return null
}

function parseStoredAuth(): Record<string, unknown> | null {
  try {
    const authData = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!authData) return null

    const parsed = JSON.parse(authData) as Record<string, unknown>
    const state =
      parsed.state && typeof parsed.state === 'object'
        ? (parsed.state as Record<string, unknown>)
        : parsed.auth && typeof parsed.auth === 'object'
          ? (parsed.auth as Record<string, unknown>)
          : parsed

    return state
  } catch {
    return null
  }
}

export function getCurrentAiUserId(): string | null {
  const state = parseStoredAuth()
  const user =
    state?.user && typeof state.user === 'object' ? (state.user as Record<string, unknown>) : null
  return normalizeAiUserId(user?.id)
}

export function getAiStorageScope(userId: string | number | null = getCurrentAiUserId()): string {
  const normalizedUserId = normalizeAiUserId(userId)
  return normalizedUserId ? `user:${normalizedUserId}` : ANONYMOUS_SCOPE
}

export function buildAiScopedStorageKey(
  baseKey: string,
  userId: string | number | null = getCurrentAiUserId(),
): string {
  return `${baseKey}::${getAiStorageScope(userId)}`
}

export function getAiScopedStorageItem(
  baseKey: string,
  userId: string | number | null = getCurrentAiUserId(),
): string | null {
  const scopedKey = buildAiScopedStorageKey(baseKey, userId)
  const scopedValue = localStorage.getItem(scopedKey)
  if (scopedValue !== null) return scopedValue

  const legacyValue = localStorage.getItem(baseKey)
  if (legacyValue === null) return null

  localStorage.setItem(scopedKey, legacyValue)
  localStorage.removeItem(baseKey)
  return legacyValue
}

export function setAiScopedStorageItem(
  baseKey: string,
  value: string,
  userId: string | number | null = getCurrentAiUserId(),
): void {
  localStorage.setItem(buildAiScopedStorageKey(baseKey, userId), value)
  localStorage.removeItem(baseKey)
}

export function removeAiScopedStorageItem(
  baseKey: string,
  userId: string | number | null = getCurrentAiUserId(),
): void {
  localStorage.removeItem(buildAiScopedStorageKey(baseKey, userId))
  localStorage.removeItem(baseKey)
}

export function emitAiStorageScopeChanged(
  userId: string | number | null = getCurrentAiUserId(),
): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent(AI_STORAGE_SCOPE_CHANGE_EVENT, {
      detail: { scope: getAiStorageScope(userId) },
    }),
  )
}
