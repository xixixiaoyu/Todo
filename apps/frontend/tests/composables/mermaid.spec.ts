import { describe, it, expect, vi, beforeEach } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

describe('mermaid rendering', () => {
  it('should initialize mermaid with strict security defaults', async () => {
    const initialize = vi.fn()

    vi.doMock('mermaid', () => ({
      default: {
        initialize,
        render: vi.fn(),
      },
    }))

    const { initializeMermaid } = await import('@/composables/markdown/mermaid')
    await initializeMermaid('default')

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        securityLevel: 'strict',
        flowchart: expect.objectContaining({
          htmlLabels: false,
        }),
      }),
    )
  })

  it('should sanitize rendered svg html', async () => {
    const initialize = vi.fn()
    const render = vi.fn(async () => ({
      svg: '<svg><script>alert(1)</script><text>ok</text></svg>',
    }))

    vi.doMock('mermaid', () => ({
      default: {
        initialize,
        render,
      },
    }))

    const { processMermaidQueue, mermaidSvgMap } = await import('@/composables/markdown/mermaid')
    await processMermaidQueue([{ id: 'm1', code: 'graph TD; A-->B' }])

    const html = mermaidSvgMap.get('m1')
    expect(html).toBeTruthy()
    expect(html).not.toContain('<script>')
    expect(html).toContain('mermaid-container')
  })
})
