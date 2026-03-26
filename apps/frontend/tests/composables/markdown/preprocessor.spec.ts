import { describe, it, expect } from 'vitest'
import { preprocessMarkdown } from '@/composables/markdown/preprocessor'

describe('preprocessMarkdown', () => {
  it('should fix bold with spaces', () => {
    const input = '到了** 你本机的 Git 数据仓库 (Local Repository) **中'
    const output = preprocessMarkdown(input)

    expect(output).toContain('<strong>你本机的 Git 数据仓库 (Local Repository)</strong>')
  })

  it('should fix bold with leading space', () => {
    const input = '这是** 加粗**文本'
    const output = preprocessMarkdown(input)

    expect(output).toContain('<strong>加粗</strong>')
  })

  it('should fix bold with trailing space', () => {
    const input = '这是**加粗 **文本'
    const output = preprocessMarkdown(input)

    expect(output).toContain('<strong>加粗</strong>')
  })

  it('should not break bold without spaces', () => {
    const input = '这是**加粗**文本'
    const output = preprocessMarkdown(input)

    expect(output).toContain('<strong>加粗</strong>')
  })

  it('should not break code blocks', () => {
    const input = '```\n** code block should not be touched **\n```'
    const output = preprocessMarkdown(input)

    expect(output).toContain('** code block should not be touched **')
  })

  it('should normalize inline latex delimiters', () => {
    const input = '这是 \\(a^2 + b^2 = c^2\\) 公式'
    const output = preprocessMarkdown(input)

    expect(output).toContain('$a^2 + b^2 = c^2$')
  })

  it('should normalize block latex delimiters', () => {
    const input = '推导如下：\n\\[\nE = mc^2\n\\]\n结束'
    const output = preprocessMarkdown(input)

    expect(output).toContain('$$\nE = mc^2\n$$')
  })

  it('should normalize multiline inline latex delimiters as block math', () => {
    const input = '推导如下：\\(\na^2 + b^2 = c^2\n\\)'
    const output = preprocessMarkdown(input)

    expect(output).toContain('$$\na^2 + b^2 = c^2\n$$')
  })

  it('should normalize bare latex environments as block math', () => {
    const input = '推导如下：\n\\begin{aligned}\na&=b+c \\\\\nd&=e+f\n\\end{aligned}\n结束'
    const output = preprocessMarkdown(input)

    expect(output).toContain('$$\n\\begin{aligned}')
    expect(output).toContain('\\end{aligned}\n$$')
  })

  it('should normalize spaced inline dollar formulas', () => {
    const input = '结果是 $ a^2 + b^2 = c^2 $'
    const output = preprocessMarkdown(input)

    expect(output).toContain('$a^2 + b^2 = c^2$')
  })

  it('should keep non-math dollar text unchanged', () => {
    const input = '售价是 $ 5 元 $'
    const output = preprocessMarkdown(input)

    expect(output).toContain('$ 5 元 $')
  })

  it('should preserve latex delimiters inside code blocks', () => {
    const input = '```\n\\(a^2 + b^2 = c^2\\)\n```'
    const output = preprocessMarkdown(input)

    expect(output).toContain('\\(a^2 + b^2 = c^2\\)')
    expect(output).not.toContain('$a^2 + b^2 = c^2$')
  })

  it('should handle multiple bold blocks', () => {
    const input = '** bold 1 ** and ** bold 2 **'
    const output = preprocessMarkdown(input)

    expect(output).toContain('<strong>bold 1</strong>')
    expect(output).toContain('<strong>bold 2</strong>')
  })
})
