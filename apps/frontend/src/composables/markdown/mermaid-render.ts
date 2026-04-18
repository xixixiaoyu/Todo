import { initializeMermaid } from './mermaid'
import DOMPurify from 'dompurify'
import { MERMAID_PURIFY_CONFIG } from './purify'

export type MermaidRenderResult = { svg: string; error: null } | { svg: ''; error: string }

/**
 * 轻量渲染函数，供编辑器实时预览使用
 * 不会写入共享缓存，使用独立的 ID 避免冲突
 */
export async function renderMermaidSvg(
  code: string,
  theme: 'default' | 'dark',
): Promise<MermaidRenderResult> {
  if (!code.trim()) {
    return { svg: '', error: '' }
  }

  try {
    const mermaidInstance = await initializeMermaid(theme)
    const id = `mermaid-editor-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    // 渲染 SVG
    const { svg } = await mermaidInstance.render(id, code)

    // 复用 processMermaidQueue 中的优化逻辑
    const optimizedSvg = svg
      .replace('<svg', '<svg preserveAspectRatio="xMidYMid meet"')
      .replace(/style="[^"]*background[^"]*"/gi, 'style="background: transparent"')
      .replace(/<rect[^>]*class="ghost"[^>]*><\/rect>/gi, '')

    // 安全过滤
    const cleanSvg = DOMPurify.sanitize(optimizedSvg, MERMAID_PURIFY_CONFIG)

    return { svg: cleanSvg, error: null }
  } catch (e) {
    console.error('Mermaid editor render error:', e)
    return {
      svg: '',
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
