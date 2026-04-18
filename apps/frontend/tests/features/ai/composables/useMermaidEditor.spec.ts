import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useMermaidEditor } from '@/features/ai/composables/useMermaidEditor'
import * as mermaidRender from '@/composables/markdown/mermaid-render'

vi.mock('@/composables/markdown/mermaid-render', () => ({
  renderMermaidSvg: vi.fn(),
}))

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    theme: { value: 'default' },
  }),
}))

vi.mock('@/composables/markdown/utils', () => ({
  getCurrentTheme: () => 'default',
}))

describe('useMermaidEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('初始状态应该是关闭的且为空', () => {
    const { isOpen, code, svgHtml, error } = useMermaidEditor()
    expect(isOpen.value).toBe(false)
    expect(code.value).toBe('')
    expect(svgHtml.value).toBe('')
    expect(error.value).toBeNull()
  })

  it('openEditor 应该打开编辑器并立即渲染', async () => {
    const mockSvg = '<svg>test</svg>'
    vi.mocked(mermaidRender.renderMermaidSvg).mockResolvedValue({ svg: mockSvg, error: null })

    const { isOpen, code, openEditor, svgHtml } = useMermaidEditor()
    const initialCode = 'graph TD; A-->B'

    openEditor(initialCode)

    expect(isOpen.value).toBe(true)
    expect(code.value).toBe(initialCode)

    // 等待渲染 Promise 完成
    await vi.waitFor(() => {
      expect(svgHtml.value).toBe(mockSvg)
    })

    expect(mermaidRender.renderMermaidSvg).toHaveBeenCalledTimes(1)
  })

  it('updateCode 应该带防抖地渲染新代码', async () => {
    const mockSvg = '<svg>new</svg>'
    vi.mocked(mermaidRender.renderMermaidSvg).mockResolvedValue({ svg: mockSvg, error: null })

    const { openEditor, updateCode, svgHtml } = useMermaidEditor()
    openEditor('old code')

    // 清除 openEditor 触发的第一次渲染调用
    vi.clearAllMocks()

    updateCode('new code')
    expect(mermaidRender.renderMermaidSvg).not.toHaveBeenCalled()

    // 快进时间
    vi.advanceTimersByTime(300)

    await vi.waitFor(() => {
      expect(svgHtml.value).toBe(mockSvg)
    })
    expect(mermaidRender.renderMermaidSvg).toHaveBeenCalledTimes(1)
  })

  it('closeEditor 应该关闭编辑器并清除错误', () => {
    const { isOpen, openEditor, closeEditor, error } = useMermaidEditor()
    openEditor('some code')
    closeEditor()

    expect(isOpen.value).toBe(false)
    expect(error.value).toBeNull()
  })
})
