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

  it('should handle multiple bold blocks', () => {
    const input = '** bold 1 ** and ** bold 2 **'
    const output = preprocessMarkdown(input)

    expect(output).toContain('<strong>bold 1</strong>')
    expect(output).toContain('<strong>bold 2</strong>')
  })
})
