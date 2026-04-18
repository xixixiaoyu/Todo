import type { HLJSApi, LanguageFn } from 'highlight.js'

/**
 * highlight.js 的 Mermaid 语法定义
 * 用于编辑器中的代码着色
 */
export const mermaidLanguage: LanguageFn = (hljs: HLJSApi) => {
  const KEYWORDS = [
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
  ]

  const DIRECTIONS = ['TB', 'BT', 'RL', 'LR', 'TD']

  const COMMON_KEYWORDS = [
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
  ]

  return {
    name: 'mermaid',
    aliases: ['mmd', 'mermaid'],
    case_insensitive: false,
    keywords: {
      keyword: [...KEYWORDS, ...COMMON_KEYWORDS, ...DIRECTIONS].join(' '),
    },
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        begin: '"',
        end: '"',
      },
      {
        className: 'type',
        begin: /\[|\]|\(|\)|\{|\}/,
      },
      {
        className: 'operator',
        begin: /-->|--|==>|==|--x|--o|->|->>|-->>/,
      },
      {
        className: 'variable',
        begin: /[a-zA-Z0-9_-]+(?=:)/,
      },
    ],
  }
}
