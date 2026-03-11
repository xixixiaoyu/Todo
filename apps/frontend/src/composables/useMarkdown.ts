import { ref, watch } from 'vue'
import DOMPurify from 'dompurify'
import { useTheme } from './useTheme'
import { stableHash, getCurrentTheme } from './markdown/utils'
import { preprocessMarkdown } from './markdown/preprocessor'
import { PURIFY_CONFIG } from './markdown/purify'
import { md } from './markdown/plugins'
import type { MarkdownEnv } from './markdown/plugins'
import { processMermaidQueue, mermaidCodeCache, mermaidSvgMap } from './markdown/mermaid'

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
            const wrapper = document.createElement('div')
            wrapper.innerHTML = html
            const placeholder = wrapper.querySelector(`#${item.id}`)
            if (!placeholder) return

            const cachedWrapper = document.createElement('div')
            cachedWrapper.innerHTML = cachedSvg
            const cachedElement = cachedWrapper.firstElementChild
            if (!cachedElement) return

            placeholder.replaceWith(cachedElement.cloneNode(true))
            html = wrapper.innerHTML
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
