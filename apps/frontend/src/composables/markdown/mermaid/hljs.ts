/**
 * Mermaid 语法高亮定义（highlight.js 语言扩展）
 */
import type { HLJSApi, LanguageFn } from 'highlight.js'
import { MERMAID_DIAGRAM_TYPES, MERMAID_DIRECTIONS, MERMAID_COMMON_KEYWORDS } from './constants'

/**
 * highlight.js 的 Mermaid 语法定义
 * 用于编辑器中的代码着色和聊天中的代码块高亮
 */
export const mermaidLanguage: LanguageFn = (hljs: HLJSApi) => {
  const allKeywords = [
    ...MERMAID_DIAGRAM_TYPES,
    ...MERMAID_COMMON_KEYWORDS,
    ...MERMAID_DIRECTIONS,
  ].join(' ')

  return {
    name: 'mermaid',
    aliases: ['mmd', 'mermaid'],
    case_insensitive: false,
    keywords: {
      keyword: allKeywords,
    },
    contains: [
      // Mermaid 注释：%%
      {
        className: 'comment',
        begin: /%%/,
        end: /$/,
        relevance: 0,
      },
      // 字符串
      hljs.QUOTE_STRING_MODE,
      {
        className: 'string',
        begin: '"',
        end: '"',
      },
      // 括号等标点
      {
        className: 'type',
        begin: /\[|\]|\(|\)|\{|\}/,
      },
      // 连接线和箭头
      {
        className: 'operator',
        begin: /-->|--|==>|==|--x|--o|->|->>|-->>|\.->|-\s*\./,
      },
      // 节点定义（冒号前的标识符）
      {
        className: 'variable',
        begin: /[a-zA-Z0-9_-]+(?=\s*[:（(（[|{])/,
      },
    ],
  }
}
