/**
 * Mermaid 渲染器
 * 负责将 Mermaid 代码渲染为 HTML/SVG，并提供缓存管理
 */
import DOMPurify from 'dompurify'
import { stableHash, getCurrentTheme } from '../utils'
import { MERMAID_PURIFY_CONFIG } from '../purify'
import { loadMermaid } from './loader'
import { initializeMermaid } from './initializer'
import { optimizeMermaidSvg } from './optimizer'

// ---- 缓存与状态 ----
export const mermaidCodeCache = new Map<string, string>()
export const mermaidSvgMap = new Map<string, string>()
let mermaidIdCounter = 0

export interface MermaidQueueItem {
  id: string
  code: string
}

/** 渲染结果类型 */
export type MermaidRenderResult = { svg: string; error: null } | { svg: ''; error: string }

/**
 * 构建包含缩放控件和 SVG 的完整 Mermaid 容器 HTML
 */
function buildMermaidContainerHtml(item: MermaidQueueItem, optimizedSvg: string): string {
  const unsafeHtml = `
    <div id="${item.id}" class="mermaid-container" data-processed="true" data-raw="${encodeURIComponent(
      item.code,
    )}">
      <div class="mermaid-zoom-controls">
        <button class="mermaid-zoom-btn" data-action="edit" title="编辑图表">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
        </button>
        <div class="mermaid-zoom-divider"></div>
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

  return DOMPurify.sanitize(unsafeHtml, MERMAID_PURIFY_CONFIG)
}

/**
 * 异步渲染 Mermaid 队列（用于 Markdown 中的多个图表）
 * 将渲染结果写入 mermaidCodeCache 和 mermaidSvgMap
 */
export async function processMermaidQueue(queue: MermaidQueueItem[]): Promise<void> {
  if (!queue || queue.length === 0) return

  const currentTheme = getCurrentTheme()
  await initializeMermaid(currentTheme)
  const mermaidInstance = await loadMermaid()

  for (const item of queue) {
    const cacheKey = `${currentTheme}:${stableHash(item.code)}`

    if (mermaidCodeCache.has(cacheKey)) {
      // 缓存命中，直接填充 svgMap
      mermaidSvgMap.set(item.id, mermaidCodeCache.get(cacheKey)!)
      continue
    }

    try {
      const id = `mermaid-${++mermaidIdCounter}`
      const { svg } = await mermaidInstance.render(id, item.code)
      const optimizedSvg = optimizeMermaidSvg(svg)
      const fullHtml = buildMermaidContainerHtml(item, optimizedSvg)

      mermaidCodeCache.set(cacheKey, fullHtml)
      mermaidSvgMap.set(item.id, fullHtml)
    } catch (e) {
      console.error('Mermaid render error:', e)
      const errorHtml = `<div class="mermaid-error">图表渲染失败: ${e}</div>`
      mermaidSvgMap.set(item.id, errorHtml)
    }
  }
}

/**
 * 轻量级单图渲染函数（供编辑器实时预览使用）
 * 不写入共享缓存，使用独立 ID 避免冲突
 *
 * @param code - Mermaid 代码
 * @param theme - 主题
 * @param signal - 可选的 AbortSignal 用于取消渲染
 */
export async function renderMermaidSvg(
  code: string,
  theme: 'default' | 'dark' = 'default',
  signal?: AbortSignal,
): Promise<MermaidRenderResult> {
  if (!code.trim()) {
    return { svg: '', error: '' }
  }

  try {
    // 检查是否已被取消
    if (signal?.aborted) {
      return { svg: '', error: 'Rendering cancelled' }
    }

    const mermaidInstance = await initializeMermaid(theme)

    // 再次检查取消状态
    if (signal?.aborted) {
      return { svg: '', error: 'Rendering cancelled' }
    }

    const id = `mermaid-editor-${Date.now()}-${Math.floor(Math.random() * 100000)}`
    const { svg } = await mermaidInstance.render(id, code)

    // 最终取消检查
    if (signal?.aborted) {
      return { svg: '', error: 'Rendering cancelled' }
    }

    const optimizedSvg = optimizeMermaidSvg(svg)
    const cleanSvg = DOMPurify.sanitize(optimizedSvg, MERMAID_PURIFY_CONFIG)

    return { svg: cleanSvg, error: null }
  } catch (e) {
    // 忽略因取消导致的错误
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { svg: '', error: 'Rendering cancelled' }
    }

    console.error('Mermaid editor render error:', e)
    return {
      svg: '',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * 清空所有渲染缓存
 */
export function clearMermaidCache(): void {
  mermaidCodeCache.clear()
  mermaidSvgMap.clear()
}
