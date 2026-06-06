/**
 * Mermaid 相关常量 —— 关键词、方向、主题变量、模板
 */
import type { MermaidConfig } from 'mermaid'

// ---- 语法高亮：mermaid 图表类型关键词 ----
export const MERMAID_DIAGRAM_TYPES = [
  'graph',
  'flowchart',
  'sequenceDiagram',
  'classDiagram',
  'stateDiagram',
  'erDiagram',
  'journey',
  'gantt',
  'pie',
  'requirementDiagram',
  'gitGraph',
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment',
  'mindmap',
  'timeline',
  'zenuml',
  'packet',
  'kanban',
  'architecture',
  'quadrantChart',
  'xychart',
  'block',
  'sankey',
] as const

// ---- 语法高亮：方向关键词 ----
export const MERMAID_DIRECTIONS = ['TB', 'BT', 'RL', 'LR', 'TD'] as const

// ---- 语法高亮：通用语法关键词 ----
export const MERMAID_COMMON_KEYWORDS = [
  'subgraph',
  'end',
  'as',
  'participant',
  'actor',
  'activate',
  'deactivate',
  'note',
  'over',
  'loop',
  'alt',
  'else',
  'opt',
  'par',
  'and',
  'rect',
  'critical',
  'option',
  'break',
  'try',
  'catch',
  'finally',
] as const

// ---- 颜色常量 ----
export const DEFAULT_MERMAID_PRIMARY = '#78958e'
export const DEFAULT_MERMAID_PRIMARY_BORDER = '#698c84'
export const DEFAULT_MERMAID_LINE = '#5c7f77'

// ---- 字体栈 ----
export const MERMAID_FONT_STACK =
  '"LXGW WenKai Screen", "LXGW WenKai", system-ui, -apple-system, sans-serif'

// ---- 暗色主题自定义 CSS ----
export const MERMAID_DARK_THEME_CSS = `
    .label,
    .edgeLabel,
    .cluster-label {
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.72), 0 0 1px rgba(0, 0, 0, 0.9);
      font-weight: 600;
    }

    svg text {
      paint-order: stroke;
      stroke: rgba(12, 12, 12, 0.78);
      stroke-width: 1.1px;
      stroke-linejoin: round;
    }
  `

// ---- 暗色主题变量 ----
export const MERMAID_DARK_THEME_VARS = {
  primaryColor: DEFAULT_MERMAID_PRIMARY,
  primaryTextColor: '#f0f0f0',
  primaryBorderColor: DEFAULT_MERMAID_PRIMARY_BORDER,
  lineColor: DEFAULT_MERMAID_PRIMARY,
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

// ---- 亮色主题变量 ----
export const MERMAID_LIGHT_THEME_VARS = {
  primaryColor: DEFAULT_MERMAID_PRIMARY,
  primaryTextColor: '#3a3a3a',
  primaryBorderColor: DEFAULT_MERMAID_PRIMARY,
  lineColor: DEFAULT_MERMAID_LINE,
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
}

// ---- 共享 Mermaid 配置 ----
export const MERMAID_SHARED_CONFIG: Partial<MermaidConfig> = {
  startOnLoad: false,
  securityLevel: 'strict',
  fontFamily: MERMAID_FONT_STACK,
  fontSize: 14,
  flowchart: {
    useMaxWidth: false,
    htmlLabels: true,
    curve: 'basis',
    padding: 10,
  },
  sequence: {
    useMaxWidth: false,
    showSequenceNumbers: true,
  },
}

// ---- 本地存储 key ----
export const STORAGE_KEY_CODE = 'lumina:mermaid-editor:code'
export const STORAGE_KEY_OPEN = 'lumina:mermaid-editor:isOpen'

// ---- 编辑器默认值 ----
export const DEFAULT_DEBOUNCE_MS = 300
export const MAX_HIGHLIGHT_CHARS = 30000
