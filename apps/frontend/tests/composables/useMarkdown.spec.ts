import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useMarkdown } from '@/composables/useMarkdown'

// Mock useTheme
vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    theme: ref('light'),
    effectiveTheme: ref('light'),
  }),
}))

describe('useMarkdown', () => {
  const { renderMarkdown } = useMarkdown()

  it('should render preprocessed bold output', async () => {
    const input = '到了** 你本机的 Git 数据仓库 (Local Repository) **中'
    const output = await renderMarkdown(input)

    expect(output).toContain('<strong>你本机的 Git 数据仓库 (Local Repository)</strong>')
  })

  it('should not break inline code and apply class', async () => {
    const input = '这是 `** inline code **` 文本'
    const output = await renderMarkdown(input)

    expect(output).toContain('<code class="inline-code">** inline code **</code>')
  })

  it('should handle non-string inputs gracefully', async () => {
    const outputNum = await renderMarkdown(123)
    expect(outputNum).toContain('123')

    const outputObj = await renderMarkdown({ a: 1 })
    expect(outputObj).toContain('[object Object]')

    const outputNull = await renderMarkdown(null)
    expect(outputNull).toBe('')
  })

  it('should render inline latex formulas from standard delimiters', async () => {
    const output = await renderMarkdown('勾股定理：\\(a^2 + b^2 = c^2\\)')

    expect(output).toContain('class="math-inline"')
    expect(output).toContain('class="katex"')
    expect(output).toContain('katex-html')
  })

  it('should render block latex formulas from standard delimiters', async () => {
    const output = await renderMarkdown('推导如下：\n\\[\nE = mc^2\n\\]\n结束')

    expect(output).toContain('class="math-block"')
    expect(output).toContain('class="katex-display"')
  })
})
