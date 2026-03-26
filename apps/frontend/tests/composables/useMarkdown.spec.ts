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

  it('should render bare latex environments as block formulas', async () => {
    const output = await renderMarkdown(
      '推导如下：\n\\begin{aligned}\na&=b+c \\\\\nd&=e+f\n\\end{aligned}\n结束',
    )

    expect(output).toContain('class="math-block"')
    expect(output).toContain('class="katex-display"')
    expect(output).toContain('katex-html')
  })

  it('should render spaced inline dollar formulas', async () => {
    const output = await renderMarkdown('结果是 $ a^2 + b^2 = c^2 $')

    expect(output).toContain('class="math-inline"')
    expect(output).toContain('class="katex"')
  })

  it('should render fenced math blocks as formulas', async () => {
    const output = await renderMarkdown('```math\n\\int_0^1 x^2 \\, dx\n```')

    expect(output).toContain('class="math-block"')
    expect(output).toContain('class="katex-display"')
  })

  it('should keep unsupported math-like fenced blocks as code', async () => {
    const output = await renderMarkdown('```asciimath\nsqrt(3^2+4^2)=5\n```')

    expect(output).toContain('code-block-container')
    expect(output).not.toContain('class="math-block"')
  })
})
