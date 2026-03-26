const MATH_BLOCK_ENVIRONMENTS = new Set([
  'equation',
  'equation*',
  'align',
  'align*',
  'aligned',
  'alignat',
  'alignat*',
  'alignedat',
  'gather',
  'gather*',
  'gathered',
  'multline',
  'multline*',
  'split',
  'cases',
  'dcases',
  'matrix',
  'pmatrix',
  'bmatrix',
  'Bmatrix',
  'vmatrix',
  'Vmatrix',
  'smallmatrix',
  'array',
])

function looksLikeMathExpression(content: string): boolean {
  const normalized = content.trim()
  if (!normalized) return false

  return (
    /\\[a-zA-Z]+/.test(normalized) ||
    /[=^_{}]|\\/.test(normalized) ||
    /(?:\d|[A-Za-z])\s*[+\-*/=<>]\s*(?:\d|[A-Za-z])/.test(normalized)
  )
}

function getPreviousNonEmptyLine(source: string, index: number): string | null {
  const lines = source.slice(0, index).split('\n')
  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex -= 1) {
    const line = lines[lineIndex].trim()
    if (line) return line
  }
  return null
}

function getNextNonEmptyLine(source: string, index: number): string | null {
  const lines = source.slice(index).split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line) return line
  }
  return null
}

function isWrappedByBlockDelimiters(source: string, start: number, end: number): boolean {
  const previousLine = getPreviousNonEmptyLine(source, start)
  const nextLine = getNextNonEmptyLine(source, end)

  return previousLine === '$$' || nextLine === '$$'
}

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
    const normalized = String(formula).trim()
    if (!normalized) return match
    return `${prefix}\n\n$$\n${normalized}\n$$\n\n`
  })

  processed = processed.replace(/(^|[^\\])\\\(([\s\S]+?)\\\)/g, (match, prefix, formula) => {
    const rawFormula = String(formula)
    const normalized = rawFormula.trim()
    if (!normalized) return match
    if (rawFormula.includes('\n')) {
      return `${prefix}\n\n$$\n${normalized}\n$$\n\n`
    }
    return `${prefix}$${normalized}$`
  })

  // 3. 兼容裸露的数学环境块：\begin{align}...\end{align}
  processed = processed.replace(
    /(^|\n)([ \t]*\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\3\}[ \t]*)(?=\n|$)/g,
    (match, prefix, block, environment, offset, source) => {
      const envName = String(environment)
      if (!MATH_BLOCK_ENVIRONMENTS.has(envName)) return match

      const blockText = String(block).trim()
      const blockStart = Number(offset) + String(prefix).length
      const blockEnd = blockStart + blockText.length

      if (isWrappedByBlockDelimiters(String(source), blockStart, blockEnd)) return match

      return `${prefix}\n$$\n${blockText}\n$$\n`
    },
  )

  // 4. 保护转义的美元符号 \$ -> __ESC_DOLLAR__
  processed = processed.replace(/\\(\$)/g, '__ESC_DOLLAR__')

  // 5. 修复加粗和斜体中的空格问题
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

  // 6. 规范化带空格的行内公式：$ a + b $
  processed = processed.replace(
    /(^|[^\\$])\$(?!\$)([^$\n]+?)\$(?!\$|\d)/g,
    (match, prefix, formula) => {
      const rawFormula = String(formula)
      const normalized = rawFormula.trim()
      const hasLooseSpacing = rawFormula !== normalized

      if (!hasLooseSpacing || !looksLikeMathExpression(normalized)) return match

      return `${prefix}$${normalized}$`
    },
  )

  // 7. 规范化块级公式 $$...$$
  // 确保 $$ 独占一行或周围有换行，防止解析失败
  processed = processed.replace(/\n?\s*\$\$\s*([\s\S]+?)\s*\$\$\s*\n?/g, (_match, formula) => {
    return `\n\n$$\n${formula.trim()}\n$$\n\n`
  })

  // 8. 还原代码块
  processed = processed.replace(/V_CODE_BLOCK_(\d+)_V/g, (_match, index) => {
    return codeBlocks[parseInt(index, 10)]
  })

  return processed
}
