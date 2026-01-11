import { ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import type { Options } from 'markdown-it'
import type Token from 'markdown-it/lib/token.mjs'
import type Renderer from 'markdown-it/lib/renderer.mjs'
import mdKatex from 'markdown-it-katex'
import mdHighlight from 'markdown-it-highlightjs'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import { useTheme } from './useTheme'

// Mermaid 单例和加载状态
let mermaid: typeof import('mermaid').default | null = null
let mermaidLoadPromise: Promise<typeof import('mermaid').default> | null = null
let mermaidInitialized = false
let currentMermaidTheme: 'default' | 'dark' = 'default'

// 缓存与状态
const mermaidCodeCache = new Map<string, string>()
const mermaidSvgMap = new Map<string, string>()
let mermaidIdCounter = 0

interface MermaidQueueItem {
  id: string
  code: string
}

interface MarkdownEnv {
  mermaidQueue?: MermaidQueueItem[]
  isStreaming?: boolean
  closedMermaidBlocks?: Set<string>
}

/**
 * 获取语言显示名称
 */
function getLanguageDisplayName(lang: string): string {
  const displayNames: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    cpp: 'C++',
    c: 'C',
    csharp: 'C#',
    go: 'Go',
    rust: 'Rust',
    ruby: 'Ruby',
    php: 'PHP',
    swift: 'Swift',
    kotlin: 'Kotlin',
    scala: 'Scala',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    less: 'Less',
    json: 'JSON',
    yaml: 'YAML',
    xml: 'XML',
    sql: 'SQL',
    shell: 'Shell',
    bash: 'Bash',
    powershell: 'PowerShell',
    dockerfile: 'Dockerfile',
    markdown: 'Markdown',
    vue: 'Vue',
    react: 'React',
    text: 'Text',
  }
  return displayNames[lang.toLowerCase()] || lang.toUpperCase()
}

/**
 * 简单哈希函数
 */
function stableHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/**
 * 获取当前主题
 */
function getCurrentTheme(): 'default' | 'dark' {
  if (typeof window === 'undefined') return 'default'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'default'
}

/**
 * 动态加载 Mermaid
 */
async function loadMermaid() {
  if (mermaid) return mermaid
  if (mermaidLoadPromise) return await mermaidLoadPromise

  mermaidLoadPromise = (async () => {
    if (typeof window !== 'undefined') {
      // 这里的类型断言是为了解决 mermaid 内部依赖 process 的问题
      const win = window as unknown as { process: Record<string, unknown> }
      win.process = {
        browser: true,
        env: { DEBUG: '', NODE_ENV: 'production' },
        platform: 'browser',
        version: 'v18.0.0',
      }
    }
    const mermaidModule = await import('mermaid')
    mermaid =
      (mermaidModule as { default?: typeof import('mermaid').default }).default ||
      (mermaidModule as unknown as typeof import('mermaid').default)
    return mermaid!
  })()

  return await mermaidLoadPromise
}

/**
 * 初始化 Mermaid
 */
async function initializeMermaid(theme: 'default' | 'dark' = 'default') {
  const mermaidInstance = await loadMermaid()
  if (mermaidInitialized && currentMermaidTheme === theme) return mermaidInstance

  const fontStack = '"LXGW WenKai", system-ui, -apple-system, sans-serif'
  const isDark = theme === 'dark'

  mermaidInstance.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose', // 允许内联样式以保证渲染效果
    fontFamily: fontStack,
    fontSize: 14,
    flowchart: {
      useMaxWidth: false,
      htmlLabels: true,
      curve: 'basis', // 使用更平滑的曲线
      padding: 15,
    },
    sequence: {
      useMaxWidth: false,
      showSequenceNumbers: true,
    },
    themeVariables: isDark
      ? {
          primaryColor: '#c9b896',
          primaryTextColor: '#f0f0f0',
          primaryBorderColor: '#8b8680',
          lineColor: '#c9b896',
          secondaryColor: '#3a3a3a',
          tertiaryColor: '#2a2a2a',
          mainBkg: '#1e1e1e',
          nodeBorder: '#8b8680',
          clusterBkg: '#2a2a2a',
          clusterBorder: '#3a3a3a',
          defaultLinkColor: '#c9b896',
          titleColor: '#f0f0f0',
          edgeLabelBackground: '#1e1e1e',
          nodeTextColor: '#f0f0f0',
        }
      : {
          primaryColor: '#c9b896',
          primaryTextColor: '#3a3a3a',
          primaryBorderColor: '#c9b896',
          lineColor: '#8b8680',
          secondaryColor: '#faf8f4',
          tertiaryColor: '#f5f3ed',
          mainBkg: '#ffffff',
          nodeBorder: '#c9b896',
          clusterBkg: '#f5f3ed',
          clusterBorder: '#e8e4dd',
          defaultLinkColor: '#8b8680',
          titleColor: '#3a3a3a',
          edgeLabelBackground: '#ffffff',
          nodeTextColor: '#3a3a3a',
        },
  })

  mermaidInitialized = true
  currentMermaidTheme = theme
  return mermaidInstance
}

/**
 * 创建并配置 MarkdownIt 单例
 */
const md = new MarkdownIt({
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

/**
 * DOMPurify 安全配置
 */
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'br',
    'hr',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'a',
    'strong',
    'em',
    'del',
    'ins',
    'img',
    'figure',
    'figcaption',
    'div',
    'span',
    'button',
    'svg',
    'path',
    'g',
    'rect',
    'circle',
    'line',
    'polygon',
    'polyline',
    'text',
    'tspan',
    'defs',
    'marker',
    'style',
    'foreignObject',
    'use',
    'math',
    'annotation',
    'semantics',
    'mrow',
    'ms',
    'mstyle',
    'mover',
    'munder',
    'munderover',
    'msup',
    'msub',
    'msubsup',
    'mfrac',
    'msqrt',
    'mroot',
    'mfenced',
    'menclose',
    'mphantom',
    'merror',
    'mpadded',
    'mspace',
    'mtable',
    'mtr',
    'mtd',
    'maligngroup',
    'malignmark',
    'mi',
    'mn',
    'mo',
  ],
  ALLOWED_ATTR: [
    'href',
    'title',
    'target',
    'rel',
    'src',
    'alt',
    'width',
    'height',
    'class',
    'id',
    'style',
    'data-code',
    'data-action',
    'data-raw',
    'viewBox',
    'xmlns',
    'd',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-dasharray',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'stroke-opacity',
    'fill-opacity',
    'opacity',
    'transform',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'points',
    'preserveAspectRatio',
    'font-size',
    'font-family',
    'text-anchor',
    'dominant-baseline',
    'aria-busy',
    'aria-label',
    'aria-hidden',
    'marker-end',
    'marker-start',
    'refX',
    'refY',
    'markerWidth',
    'markerHeight',
    'orient',
    'markerUnits',
    'xlink:href',
    'xmlns:xlink',
    'stroke-dashoffset',
    'stroke-miterlimit',
    'vector-effect',
  ],
  // 额外允许的 SVG 和 MathML 标签（补丁）
  ADD_TAGS: [
    'foreignObject',
    'math',
    'annotation',
    'semantics',
    'mrow',
    'mi',
    'mn',
    'mo',
    'msup',
    'msub',
    'desc',
    'title',
    'use',
    'symbol',
    'style',
    'defs',
    'marker',
    'pattern',
    'linearGradient',
    'radialGradient',
    'stop',
  ],
  // 额外允许的属性（补丁）
  ADD_ATTR: [
    'xmlns:xlink',
    'xlink:href',
    'data-raw',
    'data-code',
    'aria-busy',
    'aria-processed',
    'viewBox',
    'preserveAspectRatio',
    'refX',
    'refY',
    'markerWidth',
    'markerHeight',
    'orient',
    'markerUnits',
    'stroke-dasharray',
    'stroke-dashoffset',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-miterlimit',
    'vector-effect',
  ],
  FORCE_BODY: true, // 强制保留完整的 SVG 结构
}

/**
 * 预处理 Markdown：修复 AI 输出的常见格式问题
 */
function preprocessMarkdown(text: unknown): string {
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

  // 2. 保护转义的美元符号 \$ -> __ESC_DOLLAR__
  processed = processed.replace(/\\(\$)/g, '__ESC_DOLLAR__')

  // 3. 修复加粗和斜体中的空格问题
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

  // 4. 规范化块级公式 $$...$$
  // 确保 $$ 独占一行或周围有换行，防止解析失败
  processed = processed.replace(/\n?\s*\$\$\s*([\s\S]+?)\s*\$\$\s*\n?/g, (_match, formula) => {
    return `\n\n$$\n${formula.trim()}\n$$\n\n`
  })

  // 5. 还原代码块
  processed = processed.replace(/V_CODE_BLOCK_(\d+)_V/g, (_match, index) => {
    return codeBlocks[parseInt(index)]
  })

  return processed
}

/**
 * 渲染 Markdown 核心方法
 */
export function useMarkdown() {
  const isRendering = ref(false)
  const { theme } = useTheme()

  // 监听主题变化，清理缓存
  watch(theme, () => {
    mermaidCodeCache.clear()
    mermaidSvgMap.clear()
  })

  /**
   * 异步渲染 Mermaid 队列
   */
  async function processMermaidQueue(queue: MermaidQueueItem[]) {
    if (!queue || queue.length === 0) return

    const currentTheme = getCurrentTheme()
    await initializeMermaid(currentTheme)
    const mermaidInstance = await loadMermaid()

    for (const item of queue) {
      const cacheKey = `${currentTheme}:${stableHash(item.code)}`
      let fullHtml = mermaidCodeCache.get(cacheKey)

      if (!fullHtml) {
        try {
          const id = `mermaid-${++mermaidIdCounter}`
          const { svg } = await mermaidInstance.render(id, item.code)
          // 优化 SVG 字符串：
          // 1. 确保 viewBox 存在以支持缩放
          // 2. 移除硬编码的背景色，改用透明以适配容器
          // 3. 保留 style 标签，这是 Mermaid 渲染的关键
          const optimizedSvg = svg
            .replace('<svg', '<svg preserveAspectRatio="xMidYMid meet"')
            .replace(/style="[^"]*background[^"]*"/gi, 'style="background: transparent"')
            .replace(/<rect[^>]*class="ghost"[^>]*><\/rect>/gi, '') // 移除某些主题下的幽灵矩形

          fullHtml = `
            <div id="${item.id}" class="mermaid-container" data-processed="true" data-raw="${encodeURIComponent(
              item.code,
            )}">
              <div class="mermaid-zoom-controls">
                <button class="mermaid-zoom-btn" data-action="copy" title="复制源码">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                </button>
                <div class="mermaid-zoom-divider"></div>
                <button class="mermaid-zoom-btn" data-action="in" title="放大">+</button>
                <button class="mermaid-zoom-btn" data-action="out" title="缩小">−</button>
                <button class="mermaid-zoom-btn" data-action="reset" title="重置">⌂</button>
              </div>
              <div class="mermaid-diagram">${optimizedSvg}</div>
            </div>
          `
          mermaidCodeCache.set(cacheKey, fullHtml)
        } catch (e) {
          console.error('Mermaid render error:', e)
          fullHtml = `<div class="mermaid-error">图表渲染失败: ${e}</div>`
        }
      }
      mermaidSvgMap.set(item.id, fullHtml!)
    }
  }

  /**
   * 渲染 Markdown 核心方法
   */
  async function renderMarkdown(markdown: unknown, isStreaming = false): Promise<string> {
    if (!markdown) return ''

    // 强制转换为字符串，防止非字符串类型导致 replace 等方法报错
    const safeMarkdown = String(markdown)

    try {
      isRendering.value = true
      // 1. 预处理 Markdown (包含公式修复和加粗修复)
      const preprocessed = preprocessMarkdown(safeMarkdown)

      // 2. 识别已闭合的 Mermaid 代码块
      const closedMermaidBlocks = new Set<string>()
      if (isStreaming) {
        // 使用正则查找所有闭合的代码块内容
        const matches = safeMarkdown.matchAll(/```mermaid\s*\n([\s\S]*?)\n```/g)
        for (const match of matches) {
          closedMermaidBlocks.add(match[1].trim())
        }
      }

      // 3. 渲染 Markdown
      const env: MarkdownEnv = {
        mermaidQueue: [],
        isStreaming,
        closedMermaidBlocks,
      }
      let html = md.render(preprocessed, env)

      // 4. 恢复转义的美元符号
      html = html.replace(/__ESC_DOLLAR__/g, '$')

      // 4. XSS 清理：先清理基础 HTML，保护占位符
      html = DOMPurify.sanitize(html, PURIFY_CONFIG)

      // 5. 如果存在待渲染的图表，执行异步渲染
      if (env.mermaidQueue && env.mermaidQueue.length > 0) {
        // 先尝试从缓存中直接替换，减少闪烁
        const currentTheme = getCurrentTheme()
        env.mermaidQueue.forEach((item) => {
          const cacheKey = `${currentTheme}:${stableHash(item.code)}`
          const cachedSvg = mermaidCodeCache.get(cacheKey)
          if (cachedSvg) {
            // 使用非贪婪匹配，确保只替换当前 ID 的容器
            const placeholderRegex = new RegExp(`<div id="${item.id}"[^>]*>[\\s\\S]*?<\\/div>`, 'g')
            html = html.replace(placeholderRegex, cachedSvg)
          }
        })

        // 执行异步渲染（处理新图表或更新缓存）
        await processMermaidQueue(env.mermaidQueue)
      }

      return html
    } catch (error) {
      console.error('Markdown rendering error:', error)
      return `<p class="markdown-error">渲染失败: ${error}</p>`
    } finally {
      isRendering.value = false
    }
  }

  return {
    isRendering,
    renderMarkdown,
    getMermaidSvgMap: () => mermaidSvgMap,
    clearMermaidCache: () => {
      mermaidCodeCache.clear()
      mermaidSvgMap.clear()
    },
  }
}
