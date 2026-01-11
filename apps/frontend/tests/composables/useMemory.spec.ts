import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMemory, _resetMemory } from '@/composables/useMemory'

vi.mock('@/services/aiService', () => ({
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
    const { getAIStaticResponse } = await import('@/services/aiService')
    const mockGetAIStaticResponse = vi.mocked(getAIStaticResponse)
    mockGetAIStaticResponse.mockResolvedValue({ content: '["Compressed 1", "Compressed 2"]' })

    addMemories(['M1', 'M2', 'M3', 'M4'])
    await compressMemories()

    expect(mockGetAIStaticResponse).toHaveBeenCalled()
    expect(memories.value).toEqual(['Compressed 1', 'Compressed 2'])
  })
})
