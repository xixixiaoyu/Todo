import { ref } from 'vue'
import { marked, type Renderer, type Tokens } from 'marked'
import hljs from 'highlight.js'
import katex from 'katex'
import DOMPurify from 'dompurify'

// Mermaid 单例和加载状态
let mermaid: typeof import('mermaid').default | null = null
let mermaidLoadPromise: Promise<typeof import('mermaid').default> | null = null
let mermaidInitialized = false
let currentMermaidTheme: 'default' | 'dark' = 'default'

// 缓存
const mermaidCodeCache = new Map<string, string>()
const mermaidSvgMap = new Map<string, string>()
let mermaidIdCounter = 0

// 拖拽状态
let isDragging = false
let dragTarget: HTMLElement | null = null
let dragStartX = 0
let dragStartY = 0
let currentTranslateX = 0
let currentTranslateY = 0
const pendingTransform = { x: 0, y: 0 }
let animationFrameId: number | null = null

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
    // 设置全局变量解决 debug 模块问题
    if (typeof window !== 'undefined') {
      ;(window as unknown as Record<string, unknown>).process = {
        browser: true,
        env: { DEBUG: '', NODE_ENV: 'production' },
        platform: 'browser',
        version: 'v18.0.0',
      }
    }

    const mermaidModule = await import('mermaid')
    mermaid = mermaidModule.default || mermaidModule
    return mermaid
  })()

  return await mermaidLoadPromise
}

/**
 * 初始化 Mermaid
 */
async function initializeMermaid(theme: 'default' | 'dark' = 'default') {
  const mermaidInstance = await loadMermaid()

  // 如果已初始化且主题相同，跳过
  if (mermaidInitialized && currentMermaidTheme === theme) {
    return mermaidInstance
  }

  const fontStack = '"LXGW WenKai", system-ui, -apple-system, sans-serif'
  const isDark = theme === 'dark'

  mermaidInstance.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose',
    fontFamily: fontStack,
    fontSize: 14,
    flowchart: {
      useMaxWidth: false,
      htmlLabels: true,
      curve: 'linear',
      padding: 20,
      nodeSpacing: 60,
      rankSpacing: 80,
    },
    sequence: {
      useMaxWidth: false,
      diagramMarginX: 20,
      diagramMarginY: 20,
      actorMargin: 60,
      width: 180,
      height: 50,
    },
    gantt: {
      useMaxWidth: false,
      barHeight: 24,
      barGap: 6,
      topPadding: 40,
      leftPadding: 80,
      fontSize: 14,
    },
    themeVariables: isDark
      ? {
          primaryColor: '#c9b896',
          primaryTextColor: '#f5f5f5',
          primaryBorderColor: '#8b8680',
          lineColor: '#8b8680',
          secondaryColor: '#3a3a3a',
          tertiaryColor: '#2a2a2a',
          background: '#1a1a1a',
          mainBkg: '#2a2a2a',
          nodeBorder: '#8b8680',
          clusterBkg: '#2a2a2a',
          clusterBorder: '#8b8680',
          titleColor: '#f5f5f5',
          edgeLabelBackground: '#2a2a2a',
        }
      : {
          primaryColor: '#c9b896',
          primaryTextColor: '#3a3a3a',
          primaryBorderColor: '#c9b896',
          lineColor: '#8b8680',
          secondaryColor: '#faf8f4',
          tertiaryColor: '#f5f3ed',
          background: '#ffffff',
          mainBkg: '#faf8f4',
          nodeBorder: '#c9b896',
          clusterBkg: '#faf8f4',
          clusterBorder: '#c9b896',
          titleColor: '#3a3a3a',
          edgeLabelBackground: '#faf8f4',
        },
  })

  mermaidInitialized = true
  currentMermaidTheme = theme
  return mermaidInstance
}

/**
 * 修复 Mermaid 语法问题
 */
function fixMermaidSyntax(code: string): string {
  let fixed = code.replace(/^\s*[\r\n]+/, '').replace(/[\r\n]+\s*$/, '')

  // 修复常见问题
  fixed = fixed
    .replace(/-->/g, ' --> ')
    .replace(/\s+-->\s+/g, ' --> ')
    .replace(/(\w)\s*\[\s*/g, '$1[')
    .replace(/\s*\]\s*(\w)/g, ']$1')

  return fixed
}

/**
 * 预处理 LaTeX 数学公式
 */
function preprocessMathFormulas(markdown: string): string {
  // 保护代码块
  const codeBlocks: string[] = []
  let processed = markdown.replace(/```[\s\S]*?```|`[^`]+`/g, (match) => {
    codeBlocks.push(match)
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`
  })

  // 块级公式 $$...$$
  processed = processed.replace(/\$\$([^$]+)\$\$/g, (_, formula) => {
    try {
      const html = katex.renderToString(formula.trim(), {
        displayMode: true,
        throwOnError: false,
        trust: true,
      })
      return `<div class="math-block">${html}</div>`
    } catch (e) {
      console.warn('KaTeX block error:', e)
      return `<div class="math-block math-error">公式渲染失败: ${formula}</div>`
    }
  })

  // 行内公式 $...$
  processed = processed.replace(/\$([^$\n]+)\$/g, (_, formula) => {
    try {
      const html = katex.renderToString(formula.trim(), {
        displayMode: false,
        throwOnError: false,
        trust: true,
      })
      return `<span class="math-inline">${html}</span>`
    } catch (e) {
      console.warn('KaTeX inline error:', e)
      return `<span class="math-inline math-error">${formula}</span>`
    }
  })

  // 恢复代码块
  processed = processed.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
    return codeBlocks[parseInt(index)]
  })

  return processed
}

/**
 * 预处理 Mermaid 图表
 */
async function preprocessMermaidDiagrams(markdown: string): Promise<string> {
  const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g
  const matches = [...markdown.matchAll(mermaidRegex)]

  if (matches.length === 0) return markdown

  const currentTheme = getCurrentTheme()
  await initializeMermaid(currentTheme)

  let processedMarkdown = markdown

  for (const match of matches) {
    let diagramCode = match[1]
    diagramCode = fixMermaidSyntax(diagramCode)
    const normalizedCode = diagramCode.trim()

    // 生成缓存键
    const cacheKey = `${currentTheme}:${stableHash(normalizedCode)}`

    let fullHtml = mermaidCodeCache.get(cacheKey)

    if (!fullHtml) {
      try {
        const mermaidInstance = await loadMermaid()
        const id = `mermaid-${++mermaidIdCounter}`
        const { svg } = await mermaidInstance.render(id, normalizedCode)

        // 优化 SVG
        const optimizedSvg = svg
          .replace('<svg', '<svg preserveAspectRatio="xMidYMid meet"')
          .replace(/style="[^"]*background[^"]*"/gi, 'style="background: transparent"')

        fullHtml = `<div class="mermaid-container">
          <div class="mermaid-zoom-controls">
            <button class="mermaid-zoom-btn" data-action="in" title="放大">+</button>
            <button class="mermaid-zoom-btn" data-action="out" title="缩小">−</button>
            <button class="mermaid-zoom-btn" data-action="reset" title="重置">⌂</button>
          </div>
          <div class="mermaid-diagram">${optimizedSvg}</div>
        </div>`

        mermaidCodeCache.set(cacheKey, fullHtml)
      } catch (error) {
        console.error('Mermaid render error:', error)
        fullHtml = `<div class="mermaid-error">图表渲染失败: ${error}</div>`
      }
    }

    // 生成占位符
    const placeholderId = `mermaid-placeholder-${++mermaidIdCounter}`
    mermaidSvgMap.set(placeholderId, fullHtml)

    const placeholderHtml = `
      <div id="${placeholderId}" class="mermaid-container" aria-busy="true">
        <div class="mermaid-diagram">
          <div class="mermaid-loading">Mermaid 图表加载中…</div>
        </div>
      </div>
    `

    processedMarkdown = processedMarkdown.replace(match[0], placeholderHtml)
  }

  return processedMarkdown
}

/**
 * 更新拖拽变换
 */
function updateDragTransform() {
  if (dragTarget) {
    const diagram = dragTarget.querySelector('.mermaid-diagram') as HTMLElement
    if (diagram) {
      diagram.style.setProperty('--mermaid-translate-x', `${pendingTransform.x}px`)
      diagram.style.setProperty('--mermaid-translate-y', `${pendingTransform.y}px`)
    }
  }
  animationFrameId = null
}

// 全局事件监听（只注册一次）
if (typeof window !== 'undefined') {
  // 缩放按钮点击
  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('.mermaid-zoom-btn')
    if (!button) return

    const action = button.getAttribute('data-action')
    const container = button.closest('.mermaid-container') as HTMLElement
    if (!container) return

    const diagram = container.querySelector('.mermaid-diagram') as HTMLElement
    if (!diagram) return

    const currentScale = parseFloat(diagram.style.getPropertyValue('--mermaid-scale') || '1')

    let newScale = currentScale
    switch (action) {
      case 'in':
        newScale = Math.min(currentScale * 1.2, 5.0)
        break
      case 'out':
        newScale = Math.max(currentScale / 1.2, 0.2)
        break
      case 'reset':
        newScale = 1
        diagram.style.setProperty('--mermaid-translate-x', '0px')
        diagram.style.setProperty('--mermaid-translate-y', '0px')
        break
    }

    diagram.style.setProperty('--mermaid-scale', newScale.toString())
  })

  // 代码复制按钮
  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest('.copy-button')
    if (!button) return

    const code = button.getAttribute('data-code')
    if (!code) return

    navigator.clipboard.writeText(decodeURIComponent(code)).then(() => {
      const originalText = button.textContent
      button.textContent = '已复制!'
      button.classList.add('copied')
      setTimeout(() => {
        button.textContent = originalText
        button.classList.remove('copied')
      }, 2000)
    })
  })

  // 拖拽功能
  document.addEventListener('mousedown', (event) => {
    const svgElement = (event.target as HTMLElement).closest('svg')
    const container = (event.target as HTMLElement).closest('.mermaid-container')
    if (svgElement && container) {
      isDragging = true
      dragTarget = container as HTMLElement
      dragStartX = event.clientX
      dragStartY = event.clientY

      const diagram = container.querySelector('.mermaid-diagram') as HTMLElement
      if (diagram) {
        const translateX = diagram.style.getPropertyValue('--mermaid-translate-x')
        const translateY = diagram.style.getPropertyValue('--mermaid-translate-y')
        currentTranslateX = parseFloat(translateX) || 0
        currentTranslateY = parseFloat(translateY) || 0
      }

      event.preventDefault()
    }
  })

  document.addEventListener('mousemove', (event) => {
    if (!isDragging || !dragTarget) return

    const deltaX = event.clientX - dragStartX
    const deltaY = event.clientY - dragStartY

    pendingTransform.x = currentTranslateX + deltaX
    pendingTransform.y = currentTranslateY + deltaY

    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(updateDragTransform)
    }
  })

  document.addEventListener('mouseup', () => {
    if (isDragging && dragTarget) {
      const diagram = dragTarget.querySelector('.mermaid-diagram') as HTMLElement
      if (diagram) {
        currentTranslateX = pendingTransform.x
        currentTranslateY = pendingTransform.y
      }
    }
    isDragging = false
    dragTarget = null
  })
}

/**
 * 创建自定义渲染器
 */
function createRenderer(): Renderer {
  const renderer = new marked.Renderer()

  // 代码块渲染
  renderer.code = function ({ text, lang }: Tokens.Code) {
    const language = lang || 'text'
    const displayLanguage = getLanguageDisplayName(language)

    let highlightedCode: string
    if (lang && hljs.getLanguage(lang)) {
      highlightedCode = hljs.highlight(text, { language: lang }).value
    } else {
      highlightedCode = hljs.highlightAuto(text).value
    }

    return `
      <div class="code-block-container">
        <div class="code-block-header">
          <span class="code-language">${displayLanguage}</span>
          <button class="copy-button" data-code="${encodeURIComponent(text)}">复制</button>
        </div>
        <pre class="code-content"><code class="hljs language-${language}">${highlightedCode}</code></pre>
      </div>
    `
  }

  // 行内代码
  renderer.codespan = function ({ text }: Tokens.Codespan) {
    return `<code class="inline-code">${text}</code>`
  }

  // 链接（新窗口打开）
  renderer.link = function ({ href, title, text }: Tokens.Link) {
    const titleAttr = title ? ` title="${title}"` : ''
    return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer" class="markdown-link">${text}</a>`
  }

  // 表格
  renderer.table = function ({ header, rows }: Tokens.Table) {
    const headerHtml = header.map((cell) => `<th>${cell.text}</th>`).join('')
    const bodyHtml = rows
      .map((row) => `<tr>${row.map((cell) => `<td>${cell.text}</td>`).join('')}</tr>`)
      .join('')

    return `
      <div class="table-container">
        <table class="markdown-table">
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
    `
  }

  // 引用块
  renderer.blockquote = function ({ text }: Tokens.Blockquote) {
    return `<blockquote class="markdown-blockquote">${text}</blockquote>`
  }

  return renderer
}

/**
 * Markdown 渲染 Composable
 */
export function useMarkdown() {
  const isRendering = ref(false)

  const renderer = createRenderer()

  // 配置 marked
  marked.setOptions({
    renderer,
    gfm: true,
    breaks: true,
  })

  /**
   * 渲染 Markdown
   */
  async function renderMarkdown(markdown: string): Promise<string> {
    if (!markdown) return ''

    isRendering.value = true

    try {
      // 1. 预处理 LaTeX 数学公式
      let processedMarkdown = preprocessMathFormulas(markdown)

      // 2. 预处理 Mermaid 图表
      processedMarkdown = await preprocessMermaidDiagrams(processedMarkdown)

      // 3. 使用 marked 解析
      const html = await marked.parse(processedMarkdown)

      // 4. 使用 DOMPurify 清理
      const cleanHtml = DOMPurify.sanitize(html, {
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
          'viewBox',
          'xmlns',
          'd',
          'fill',
          'stroke',
          'stroke-width',
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
          'marker-end',
          'marker-start',
          'refX',
          'refY',
          'markerWidth',
          'markerHeight',
          'orient',
          'markerUnits',
        ],
        ADD_TAGS: ['foreignObject'],
        ADD_ATTR: ['xmlns:xlink', 'xlink:href'],
      })

      return cleanHtml
    } catch (error) {
      console.error('Markdown rendering error:', error)
      return `<p class="markdown-error">渲染失败: ${error}</p>`
    } finally {
      isRendering.value = false
    }
  }

  /**
   * 获取 Mermaid SVG 映射（用于注入）
   */
  function getMermaidSvgMap(): Map<string, string> {
    return mermaidSvgMap
  }

  /**
   * 清除 Mermaid 缓存（主题切换时调用）
   */
  function clearMermaidCache(): void {
    mermaidCodeCache.clear()
    mermaidInitialized = false
  }

  return {
    renderMarkdown,
    getMermaidSvgMap,
    clearMermaidCache,
    isRendering,
  }
}
