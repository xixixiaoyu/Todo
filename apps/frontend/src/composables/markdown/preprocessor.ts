/**
 * 预处理 Markdown：修复 AI 输出的常见格式问题
 */
export function preprocessMarkdown(text: unknown): string {
  if (!text) return ''

  // 强制确保 text 为字符串
  const safeText = String(text)

  // 1. 保护代码块，避免预处理干扰代码内容
  const codeBlocks: string[] = []
  let processed = safeText.replace(/(```[\s\S]*?```|`[^`\n]+?`)/g, (match) => {
    const placeholder = `V_CODE_BLOCK_${codeBlocks.length}_V`
    codeBlocks.push(match)
    return placeholder
  })

  // 2. 兼容标准 LaTeX 定界符：\(...\) / \[...\]
  processed = processed.replace(/(^|[^\\])\\\[\s*([\s\S]+?)\s*\\\]/g, (match, prefix, formula) => {
    const normalized = formula.trim()
    if (!normalized) return match
    return `${prefix}\n\n$$\n${normalized}\n$$\n\n`
  })

  processed = processed.replace(/(^|[^\\])\\\(([^`\n]+?)\\\)/g, (match, prefix, formula) => {
    const normalized = formula.trim()
    if (!normalized) return match
    return `${prefix}$${normalized}$`
  })

  // 3. 保护转义的美元符号 \$ -> __ESC_DOLLAR__
  processed = processed.replace(/\\(\$)/g, '__ESC_DOLLAR__')

  // 4. 修复加粗和斜体中的空格问题
  // 我们直接将其转换为 HTML 标签，以绕过 markdown-it 严格的 CJK 边界（flanking）解析规则
  // 处理 ** text ** -> <strong>text</strong>
  processed = processed.replace(/\*\*([^\n]+?)\*\*/g, (match, content) => {
    if (!content.trim()) return match
    return `<strong>${content.trim()}</strong>`
  })
  // 处理 __ text __ -> <strong>text</strong>
  processed = processed.replace(/__([^\n]+?)__/g, (match, content) => {
    if (!content.trim()) return match
    return `<strong>${content.trim()}</strong>`
  })

  // 5. 规范化块级公式 $$...$$
  // 确保 $$ 独占一行或周围有换行，防止解析失败
  processed = processed.replace(/\n?\s*\$\$\s*([\s\S]+?)\s*\$\$\s*\n?/g, (_match, formula) => {
    return `\n\n$$\n${formula.trim()}\n$$\n\n`
  })

  // 6. 还原代码块
  processed = processed.replace(/V_CODE_BLOCK_(\d+)_V/g, (_match, index) => {
    return codeBlocks[parseInt(index, 10)]
  })

  return processed
}
