/**
 * Mermaid 初始化器
 * 负责根据主题配置 mermaid 库
 */
import { loadMermaid } from './loader'
import {
  MERMAID_SHARED_CONFIG,
  MERMAID_DARK_THEME_CSS,
  MERMAID_DARK_THEME_VARS,
  MERMAID_LIGHT_THEME_VARS,
} from './constants'

let mermaidInitialized = false
let currentMermaidTheme: 'default' | 'dark' = 'default'

/**
 * 初始化 Mermaid 库（根据主题配置）
 * 如果已初始化且主题未变化，直接返回已加载的实例
 * @param theme - 主题：default（亮色）或 dark（暗色）
 * @returns 已初始化的 mermaid 实例
 */
export async function initializeMermaid(
  theme: 'default' | 'dark' = 'default',
): Promise<typeof import('mermaid').default> {
  const mermaidInstance = await loadMermaid()

  // 主题无变化时跳过重复初始化
  if (mermaidInitialized && currentMermaidTheme === theme) {
    return mermaidInstance
  }

  const isDark = theme === 'dark'

  mermaidInstance.initialize({
    ...MERMAID_SHARED_CONFIG,
    theme: isDark ? 'dark' : 'default',
    themeCSS: isDark ? MERMAID_DARK_THEME_CSS : '',
    themeVariables: isDark ? MERMAID_DARK_THEME_VARS : MERMAID_LIGHT_THEME_VARS,
  })

  mermaidInitialized = true
  currentMermaidTheme = theme

  return mermaidInstance
}

/**
 * 重置初始化状态（用于测试）
 */
export function resetMermaidInitializer(): void {
  mermaidInitialized = false
  currentMermaidTheme = 'default'
}
