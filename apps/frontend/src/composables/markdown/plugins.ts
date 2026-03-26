import MarkdownIt from 'markdown-it'
import type { Options } from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type Renderer from 'markdown-it/lib/renderer.mjs'
import mdKatex from '@iktakahiro/markdown-it-katex'
import mdHighlight from 'markdown-it-highlightjs'
import hljs from 'highlight.js'
import { getLanguageDisplayName, stableHash } from './utils'
import type { MermaidQueueItem } from './mermaid'

// 注册 mermaid 为普通文本，防止 highlight.js 报错
hljs.registerLanguage('mermaid', () => ({ contains: [] }))

export interface MarkdownEnv {
  mermaidQueue?: MermaidQueueItem[]
  isStreaming?: boolean
  closedMermaidBlocks?: Set<string>
}

/**
 * 创建并配置 MarkdownIt 单例
 */
export const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
})

// 使用插件
md.use(mdKatex, {
  throwOnError: false,
  errorColor: 'hsl(var(--destructive))',
})

md.use(mdHighlight, {
  hljs,
  inline: false,
})

const defaultMathInlineRender = md.renderer.rules.math_inline
const defaultMathBlockRender = md.renderer.rules.math_block

md.renderer.rules.math_inline = (tokens, idx, options, env, self) => {
  const rendered = defaultMathInlineRender
    ? defaultMathInlineRender(tokens, idx, options, env, self)
    : md.utils.escapeHtml(tokens[idx].content)

  return `<span class="math-inline">${rendered}</span>`
}

md.renderer.rules.math_block = (tokens, idx, options, env, self) => {
  const rendered = defaultMathBlockRender
    ? defaultMathBlockRender(tokens, idx, options, env, self)
    : md.utils.escapeHtml(tokens[idx].content)

  return `<div class="math-block">${rendered.trim()}</div>\n`
}

// 自定义链接渲染：新窗口打开并添加类名
const defaultLinkRender =
  md.renderer.rules.link_open ||
  ((tokens: Token[], idx: number, options: Options, _env: MarkdownEnv, self: Renderer) =>
    self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env: MarkdownEnv, self) => {
  tokens[idx].attrPush(['target', '_blank'])
  tokens[idx].attrPush(['rel', 'noopener noreferrer'])
  tokens[idx].attrPush(['class', 'markdown-link'])
  return defaultLinkRender(tokens, idx, options, env, self)
}

// 自定义行内代码渲染
md.renderer.rules.code_inline = (tokens, idx) => {
  const token = tokens[idx]
  return `<code class="inline-code">${md.utils.escapeHtml(token.content)}</code>`
}

// 自定义代码块 (Fence)：处理 Mermaid 和 代码块头
const defaultFence = md.renderer.rules.fence!
md.renderer.rules.fence = (tokens, idx, options, env: MarkdownEnv, self) => {
  const token = tokens[idx]
  const info = token.info ? token.info.trim() : ''
  const lang = info.split(/\s+/g)[0].toLowerCase()
  const content = token.content

  // Mermaid 特殊处理
  if (lang === 'mermaid') {
    const code = content.trim()

    // 只有在非流式输出，或者代码块已完全闭合时才渲染图表
    const isClosed = env.closedMermaidBlocks?.has(code)
    const shouldRenderDiagram = !env.isStreaming || isClosed

    if (shouldRenderDiagram) {
      const hash = stableHash(code)
      const placeholderId = `mermaid-${hash}`

      env.mermaidQueue = env.mermaidQueue || []
      env.mermaidQueue.push({ id: placeholderId, code })

      return `<div id="${placeholderId}" class="mermaid-container" aria-busy="true" data-processed="false"><div class="mermaid-diagram"><div class="mermaid-loading">正在渲染图表...</div></div></div>`
    }
  }

  // 普通代码块渲染（或者未闭合的 Mermaid）
  const displayLanguage = getLanguageDisplayName(lang || 'text')
  const highlighted = defaultFence(tokens, idx, options, env, self)

  return `
    <div class="code-block-container">
      <div class="code-block-header">
        <div class="code-block-header-left">
          <span class="code-language">${displayLanguage}</span>
        </div>
        <button class="code-copy-button" data-code="${encodeURIComponent(content)}" title="复制代码">
          <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          <svg class="check-icon hidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>复制</span>
        </button>
      </div>
      <div class="code-content">${highlighted}</div>
    </div>
  `
}

// 表格样式增强
md.renderer.rules.table_open = () => '<div class="table-container"><table class="markdown-table">'
md.renderer.rules.table_close = () => '</table></div>'
