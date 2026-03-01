import { stableHash, getCurrentTheme } from './utils'
import DOMPurify from 'dompurify'
import { MERMAID_PURIFY_CONFIG } from './purify'

// Mermaid 单例和加载状态
let mermaid: typeof import('mermaid').default | null = null
let mermaidLoadPromise: Promise<typeof import('mermaid').default> | null = null
let mermaidInitialized = false
let currentMermaidTheme: 'default' | 'dark' = 'default'

// 缓存与状态
export const mermaidCodeCache = new Map<string, string>()
export const mermaidSvgMap = new Map<string, string>()
let mermaidIdCounter = 0

export interface MermaidQueueItem {
  id: string
  code: string
}

/**
 * 动态加载 Mermaid
 */
export async function loadMermaid() {
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
export async function initializeMermaid(theme: 'default' | 'dark' = 'default') {
  const mermaidInstance = await loadMermaid()
  if (mermaidInitialized && currentMermaidTheme === theme) return mermaidInstance

  const fontStack = '"LXGW WenKai Screen", "LXGW WenKai", system-ui, -apple-system, sans-serif'
  const isDark = theme === 'dark'

  mermaidInstance.initialize({
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'strict',
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
 * 异步渲染 Mermaid 队列
 */
export async function processMermaidQueue(queue: MermaidQueueItem[]) {
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

        const unsafeHtml = `
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

        fullHtml = DOMPurify.sanitize(unsafeHtml, MERMAID_PURIFY_CONFIG)
        mermaidCodeCache.set(cacheKey, fullHtml)
      } catch (e) {
        console.error('Mermaid render error:', e)
        fullHtml = `<div class="mermaid-error">图表渲染失败: ${e}</div>`
      }
    }
    mermaidSvgMap.set(item.id, fullHtml!)
  }
}
