import { describe, expect, it } from 'vitest'
import { isSocketAuthError, isTransientSocketError } from '@/composables/useSocket.errors'

describe('useSocket error helpers', () => {
  it('should detect auth-related socket failures', () => {
    expect(isSocketAuthError({ message: 'Unauthorized' })).toBe(true)
    expect(isSocketAuthError({ message: 'JWT expired' })).toBe(true)
    expect(isSocketAuthError({ message: 'timeout' })).toBe(false)
  })

  it('should detect transient transport failures', () => {
    expect(isTransientSocketError({ message: 'timeout' })).toBe(true)
    expect(isTransientSocketError({ message: 'transport close' })).toBe(true)
    expect(isTransientSocketError({ type: 'Transport Error' })).toBe(true)
    expect(isTransientSocketError({ message: 'forbidden room' })).toBe(false)
  })
})
