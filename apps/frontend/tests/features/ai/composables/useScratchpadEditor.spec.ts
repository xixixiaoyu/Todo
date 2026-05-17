import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useScratchpadEditor } from '@/features/ai/composables/useScratchpadEditor'

describe('useScratchpadEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // 重置单例状态，确保测试隔离
    const { closeEditor } = useScratchpadEditor()
    closeEditor()
  })

  it('初始状态应该是关闭的', () => {
    const { isOpen } = useScratchpadEditor()
    expect(isOpen.value).toBe(false)
  })

  it('openEditor 应该打开编辑器并持久化到 localStorage', () => {
    const { isOpen, openEditor } = useScratchpadEditor()

    openEditor()

    expect(isOpen.value).toBe(true)
    expect(localStorage.getItem('lumina:scratchpad-editor:isOpen')).toBe('true')
  })

  it('closeEditor 应该关闭编辑器并持久化到 localStorage', () => {
    const { isOpen, openEditor, closeEditor } = useScratchpadEditor()

    openEditor()
    expect(isOpen.value).toBe(true)

    closeEditor()

    expect(isOpen.value).toBe(false)
    expect(localStorage.getItem('lumina:scratchpad-editor:isOpen')).toBe('false')
  })

  it('Singleton 模式：多次调用 useScratchpadEditor 应共享同一状态', () => {
    const editor1 = useScratchpadEditor()
    const editor2 = useScratchpadEditor()

    expect(editor1.isOpen).toBe(editor2.isOpen)
    expect(editor1.isOpen.value).toBe(false)

    editor1.openEditor()

    expect(editor1.isOpen.value).toBe(true)
    expect(editor2.isOpen.value).toBe(true)

    editor2.closeEditor()

    expect(editor1.isOpen.value).toBe(false)
    expect(editor2.isOpen.value).toBe(false)
  })

  it('localStorage 持久化键名应保持一致', () => {
    const { openEditor, closeEditor } = useScratchpadEditor()
    const storageKey = 'lumina:scratchpad-editor:isOpen'

    openEditor()
    expect(localStorage.getItem(storageKey)).toBe('true')

    closeEditor()
    expect(localStorage.getItem(storageKey)).toBe('false')
  })
})
