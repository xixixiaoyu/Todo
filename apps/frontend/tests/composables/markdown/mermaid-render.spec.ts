import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderMermaidSvg } from '@/composables/markdown/mermaid-render'
import * as initializerModule from '@/composables/markdown/mermaid/initializer'
import * as loaderModule from '@/composables/markdown/mermaid/loader'

// Mock dompurify to pass through HTML unchanged
vi.mock('dompurify', () => ({
  default: {
    sanitize: (html: string) => html,
  },
}))

// Mock the internal module that renderer.ts actually imports
vi.mock('@/composables/markdown/mermaid/initializer', async () => {
  const actual = await vi.importActual<typeof import('@/composables/markdown/mermaid/initializer')>(
    '@/composables/markdown/mermaid/initializer',
  )
  return {
    ...actual,
    initializeMermaid: vi.fn(),
  }
})

vi.mock('@/composables/markdown/mermaid/loader', async () => {
  const actual = await vi.importActual<typeof import('@/composables/markdown/mermaid/loader')>(
    '@/composables/markdown/mermaid/loader',
  )
  return {
    ...actual,
    loadMermaid: vi.fn(),
  }
})

describe('renderMermaidSvg', () => {
  const mockMermaidInstance = {
    render: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(initializerModule.initializeMermaid).mockResolvedValue(
      mockMermaidInstance as unknown as never,
    )
  })

  it('应该能正确渲染有效的 Mermaid 代码', async () => {
    const mockSvg = '<svg id="test">test content</svg>'
    mockMermaidInstance.render.mockResolvedValue({ svg: mockSvg })

    const result = await renderMermaidSvg('graph TD; A-->B', 'default')

    expect(result.error).toBeNull()
    expect(result.svg).toContain('preserveAspectRatio="xMidYMid meet"')
    expect(initializerModule.initializeMermaid).toHaveBeenCalledWith('default')
  })

  it('渲染空代码时应返回空结果', async () => {
    const result = await renderMermaidSvg('', 'default')
    expect(result.svg).toBe('')
    expect(result.error).toBe('')
  })

  it('渲染失败时应捕获并返回错误信息', async () => {
    mockMermaidInstance.render.mockRejectedValue(new Error('Syntax Error'))

    const result = await renderMermaidSvg('invalid code', 'dark')

    expect(result.svg).toBe('')
    expect(result.error).toBe('Syntax Error')
  })
})
