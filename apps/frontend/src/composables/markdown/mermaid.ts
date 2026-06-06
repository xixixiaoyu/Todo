/**
 * Mermaid 模块 barrel 导出（向后兼容）
 *
 * 实际实现已拆分到 mermaid/ 子目录：
 * - mermaid/loader.ts — 动态加载
 * - mermaid/initializer.ts — 主题初始化
 * - mermaid/optimizer.ts — SVG 后处理
 * - mermaid/renderer.ts — 渲染队列 + 缓存
 * - mermaid/hljs.ts — 语法高亮
 * - mermaid/interactions.ts — 交互绑定
 */
export {
  loadMermaid,
  initializeMermaid,
  optimizeMermaidSvg,
  processMermaidQueue,
  renderMermaidSvg,
  clearMermaidCache,
  mermaidCodeCache,
  mermaidSvgMap,
  STORAGE_KEY_CODE,
  STORAGE_KEY_OPEN,
  DEFAULT_DEBOUNCE_MS,
  MAX_HIGHLIGHT_CHARS,
} from './mermaid/index'
export type { MermaidQueueItem, MermaidRenderResult } from './mermaid/index'
