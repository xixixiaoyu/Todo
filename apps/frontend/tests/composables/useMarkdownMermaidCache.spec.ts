import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useMarkdown } from '@/composables/useMarkdown'
import { stableHash } from '@/composables/markdown/utils'

const {
  mockProcessMermaidQueue,
  mockMermaidCodeCache,
  mockMermaidSvgMap,
}: {
  mockProcessMermaidQueue: ReturnType<typeof vi.fn>
  mockMermaidCodeCache: Map<string, string>
  mockMermaidSvgMap: Map<string, string>
} = vi.hoisted(() => ({
  mockProcessMermaidQueue: vi.fn(async () => undefined),
  mockMermaidCodeCache: new Map<string, string>(),
  mockMermaidSvgMap: new Map<string, string>(),
}))

vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    theme: ref('light'),
    effectiveTheme: ref('light'),
  }),
}))

vi.mock('@/composables/markdown/mermaid', () => ({
  processMermaidQueue: mockProcessMermaidQueue,
  mermaidCodeCache: mockMermaidCodeCache,
  mermaidSvgMap: mockMermaidSvgMap,
}))

describe('useMarkdown mermaid cache replacement', () => {
  beforeEach(() => {
    mockProcessMermaidQueue.mockClear()
    mockMermaidCodeCache.clear()
    mockMermaidSvgMap.clear()
  })

  it('should replace mermaid placeholder without trailing broken div tags', async () => {
    const code = 'graph TD; A-->B'
    const cacheKey = `default:${stableHash(code)}`
    const cachedHtml =
      '<div class="mermaid-container" data-processed="true"><div class="mermaid-diagram"><svg><text>cached</text></svg></div></div>'
    mockMermaidCodeCache.set(cacheKey, cachedHtml)

    const { renderMarkdown } = useMarkdown()
    const output = await renderMarkdown(`\`\`\`mermaid\n${code}\n\`\`\``)

    expect(output).toContain('cached')
    expect(output).toContain('mermaid-container')
    expect(output.trim()).toBe(cachedHtml)
    expect(mockProcessMermaidQueue).toHaveBeenCalledTimes(1)
  })
})
