/**
 * Mermaid 交互 barrel 导出（向后兼容）
 *
 * 实际实现已移至 mermaid/interactions.ts
 *
 * 兼容说明：initMermaidInteractions 不再从 feature 层导入 useMermaidEditor。
 * 如需编辑/复制回调，请使用第三个参数 config。
 */
export { initMermaidInteractions, initCodeInteractions } from './mermaid/index'
export type { MermaidInteractionConfig } from './mermaid/index'
