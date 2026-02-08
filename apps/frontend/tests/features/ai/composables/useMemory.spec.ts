import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMemory, _resetMemory } from '@/features/ai/composables/useMemory'

vi.mock('@/features/ai/services/aiService', () => ({
  getAIStaticResponse: vi.fn(),
}))

describe('useMemory', () => {
  beforeEach(() => {
    localStorage.clear()
    _resetMemory()
    vi.clearAllMocks()
  })

  it('should initialize with empty memories', () => {
    const { memories } = useMemory()
    expect(memories.value).toEqual([])
  })

  it('should add memories and deduplicate', () => {
    const { memories, addMemories } = useMemory()
    addMemories(['Memory 1', 'Memory 2', 'Memory 1'])
    expect(memories.value).toEqual(['Memory 1', 'Memory 2'])
  })

  it('should limit memories to 100', () => {
    const { memories, addMemories } = useMemory()
    const newMemories = Array.from({ length: 110 }, (_, i) => `Memory ${i}`)
    addMemories(newMemories)
    expect(memories.value.length).toBe(100)
    expect(memories.value[memories.value.length - 1]).toBe('Memory 109')
  })

  it('should remove a memory', () => {
    const { memories, addMemories, removeMemory } = useMemory()
    addMemories(['Memory 1', 'Memory 2'])
    removeMemory(0)
    expect(memories.value).toEqual(['Memory 2'])
  })

  it('should clear all memories', () => {
    const { memories, addMemories, clearMemories } = useMemory()
    addMemories(['Memory 1', 'Memory 2'])
    clearMemories()
    expect(memories.value).toEqual([])
  })

  it('should add a single memory manually', () => {
    const { memories, addMemory } = useMemory()
    addMemory('Manual Memory')
    expect(memories.value).toContain('Manual Memory')
  })

  it('should update a memory', () => {
    const { memories, addMemories, updateMemory } = useMemory()
    addMemories(['Old Memory'])
    updateMemory(0, 'New Memory')
    expect(memories.value[0]).toBe('New Memory')
  })

  it('should not add duplicate memory manually', () => {
    const { memories, addMemory } = useMemory()
    addMemory('Unique')
    addMemory('Unique')
    expect(memories.value).toHaveLength(1)
  })

  it('should detect similar memories and avoid duplication', () => {
    const { memories, addMemory } = useMemory()
    addMemory('User likes TypeScript')
    addMemory('user likes typescript') // Case-insensitive
    expect(memories.value).toHaveLength(1)

    addMemory('likes TypeScript') // Partial match (substring but full word)
    expect(memories.value).toHaveLength(1)

    addMemory('Memory 1')
    addMemory('Memory 10') // Should NOT be considered same as Memory 1
    expect(memories.value).toHaveLength(3)
  })

  it('should respect MAX_MEMORIES when adding manually', () => {
    const { memories, addMemory } = useMemory()
    for (let i = 0; i < 105; i++) {
      addMemory(`Memory ${i}`)
    }
    expect(memories.value).toHaveLength(100)
    expect(memories.value[0]).toBe('Memory 5')
    expect(memories.value[99]).toBe('Memory 104')
  })

  it('should toggle memory enabled status', () => {
    const { isMemoryEnabled, toggleMemory } = useMemory()
    expect(isMemoryEnabled.value).toBe(false) // default false
    toggleMemory(true)
    expect(isMemoryEnabled.value).toBe(true)
    expect(localStorage.getItem('ai-memory-enabled')).toBe('true')
  })

  it('should compress memories using AI', async () => {
    const { memories, addMemories, compressMemories } = useMemory()
    const { getAIStaticResponse } = await import('@/features/ai/services/aiService')
    const mockGetAIStaticResponse = vi.mocked(getAIStaticResponse)
    mockGetAIStaticResponse.mockResolvedValue({ content: '["Compressed 1", "Compressed 2"]' })

    addMemories(['M1', 'M2', 'M3', 'M4'])
    await compressMemories()

    expect(mockGetAIStaticResponse).toHaveBeenCalled()
    expect(memories.value).toEqual(['Compressed 1', 'Compressed 2'])
  })

  describe('Import/Export', () => {
    it('should export all memories as JSON string', () => {
      const { addMemories, exportMemories } = useMemory()
      addMemories(['Memory 1', 'Memory 2'])

      const exported = exportMemories()
      const parsed = JSON.parse(exported)

      expect(parsed).toEqual(['Memory 1', 'Memory 2'])
    })

    it('should import memories in merge mode', () => {
      const { memories, addMemories, importMemories } = useMemory()
      addMemories(['Existing Memory'])

      const importData = JSON.stringify(['New Memory', 'Existing Memory'])
      importMemories(importData, 'merge')

      expect(memories.value).toHaveLength(2)
      expect(memories.value).toContain('Existing Memory')
      expect(memories.value).toContain('New Memory')
    })

    it('should import memories in replace mode', () => {
      const { memories, addMemories, importMemories } = useMemory()
      addMemories(['Old Memory'])

      const importData = JSON.stringify(['New Memory'])
      importMemories(importData, 'replace')

      expect(memories.value).toEqual(['New Memory'])
    })

    it('should throw error for invalid JSON format during import', () => {
      const { importMemories } = useMemory()
      expect(() => importMemories('invalid-json')).toThrow()
    })

    it('should throw error if imported data is not an array', () => {
      const { importMemories } = useMemory()
      const invalidData = JSON.stringify({ key: 'value' })
      expect(() => importMemories(invalidData)).toThrow('Invalid memories format')
    })

    it('should filter out non-string items and empty strings during import', () => {
      const { memories, importMemories } = useMemory()
      const mixedData = JSON.stringify(['Valid', 123, null, '', '  ', { text: 'invalid' }])
      importMemories(mixedData, 'replace')

      expect(memories.value).toEqual(['Valid'])
    })

    it('should respect MAX_MEMORIES during import', () => {
      const { memories, importMemories } = useMemory()
      const largeData = JSON.stringify(Array.from({ length: 150 }, (_, i) => `Memory ${i}`))
      importMemories(largeData, 'replace')

      expect(memories.value).toHaveLength(100)
      expect(memories.value[0]).toBe('Memory 50')
      expect(memories.value[99]).toBe('Memory 149')
    })
  })
})
