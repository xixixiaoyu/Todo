import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useMarkdown } from '@/composables/useMarkdown'

// Mock useTheme
vi.mock('@/composables/useTheme', () => ({
  useTheme: () => ({
    theme: ref('light'),
  }),
}))

describe('useMarkdown', () => {
  const { renderMarkdown } = useMarkdown()

  it('should fix bold with spaces', async () => {
    const input = '到了** 你本机的 Git 数据仓库 (Local Repository) **中'
    const output = await renderMarkdown(input)
    expect(output).toContain('<strong>你本机的 Git 数据仓库 (Local Repository)</strong>')
  })

  it('should fix bold with leading space', async () => {
    const input = '这是** 加粗**文本'
    const output = await renderMarkdown(input)
    expect(output).toContain('<strong>加粗</strong>')
  })

  it('should fix bold with trailing space', async () => {
    const input = '这是**加粗 **文本'
    const output = await renderMarkdown(input)
    expect(output).toContain('<strong>加粗</strong>')
  })

  it('should not break bold without spaces', async () => {
    const input = '这是**加粗**文本'
    const output = await renderMarkdown(input)
    expect(output).toContain('<strong>加粗</strong>')
  })

  it('should not break code blocks', async () => {
    const input = '```\n** code block should not be touched **\n```'
    const output = await renderMarkdown(input)
    // 检查是否包含原始内容，忽略 HTML 标签
    const plainText = output.replace(/<[^>]+>/g, '')
    expect(plainText).toContain('** code block should not be touched **')
  })

  it('should not break inline code and apply class', async () => {
    const input = '这是 `** inline code **` 文本'
    const output = await renderMarkdown(input)
    expect(output).toContain('<code class="inline-code">** inline code **</code>')
  })

  it('should handle multiple bold blocks', async () => {
    const input = '** bold 1 ** and ** bold 2 **'
    const output = await renderMarkdown(input)
    expect(output).toContain('<strong>bold 1</strong>')
    expect(output).toContain('<strong>bold 2</strong>')
  })

  it('should handle non-string inputs gracefully', async () => {
    const outputNum = await renderMarkdown(123)
    expect(outputNum).toContain('123')

    const outputObj = await renderMarkdown({ a: 1 })
    expect(outputObj).toContain('[object Object]')

    const outputNull = await renderMarkdown(null)
    expect(outputNull).toBe('')
  })
})
