/**
 * Mermaid 模块公共 API
 *
 * 将原来的 mermaid.ts 拆分为关注点分离的子模块：
 * - constants.ts   → 所有配置常量
 * - loader.ts      → mermaid 库动态加载
 * - initializer.ts → mermaid.initialize() 主题配置
 * - optimizer.ts   → SVG 后处理优化（共享）
 * - renderer.ts    → processMermaidQueue() + renderMermaidSvg()
 * - hljs.ts        → highlight.js 语法高亮定义
 * - interactions.ts → 缩放/拖拽/编辑/复制 交互绑定
 */

// 常量和类型
export {
  MERMAID_DIAGRAM_TYPES,
  MERMAID_DIRECTIONS,
  MERMAID_COMMON_KEYWORDS,
  DEFAULT_MERMAID_PRIMARY,
  DEFAULT_MERMAID_PRIMARY_BORDER,
  DEFAULT_MERMAID_LINE,
  MERMAID_FONT_STACK,
  MERMAID_DARK_THEME_CSS,
  MERMAID_DARK_THEME_VARS,
  MERMAID_LIGHT_THEME_VARS,
  MERMAID_SHARED_CONFIG,
  STORAGE_KEY_CODE,
  STORAGE_KEY_OPEN,
  DEFAULT_DEBOUNCE_MS,
  MAX_HIGHLIGHT_CHARS,
} from './constants'

// 加载器
export { loadMermaid, getLoadedMermaid } from './loader'

// 初始化器
export { initializeMermaid, resetMermaidInitializer } from './initializer'

// SVG 优化器
export { optimizeMermaidSvg } from './optimizer'

// 渲染器
export {
  mermaidCodeCache,
  mermaidSvgMap,
  processMermaidQueue,
  renderMermaidSvg,
  clearMermaidCache,
} from './renderer'
export type { MermaidQueueItem, MermaidRenderResult } from './renderer'

// 语法高亮
export { mermaidLanguage } from './hljs'

// 交互
export { initMermaidInteractions, initCodeInteractions } from './interactions'
export type { MermaidInteractionConfig } from './interactions'
