declare module 'markdown-it-katex' {
  import { MarkdownIt } from 'markdown-it'
  const katex: (md: MarkdownIt, options?: Record<string, unknown>) => void
  export default katex
}

declare module '@iktakahiro/markdown-it-katex' {
  import { MarkdownIt } from 'markdown-it'
  const katex: (md: MarkdownIt, options?: Record<string, unknown>) => void
  export default katex
}
