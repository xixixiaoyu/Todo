/**
 * Mermaid SVG 优化器
 * 对 mermaid 渲染输出的 SVG 字符串进行后处理优化
 */

/**
 * 优化 Mermaid 渲染输出的 SVG 字符串
 * - 添加 preserveAspectRatio 以支持缩放
 * - 移除硬编码背景色，改用透明
 * - 移除某些主题下的幽灵矩形
 * - 修复自闭合标签格式
 *
 * @param svg - mermaid.render() 输出的原始 SVG 字符串
 * @returns 优化后的 SVG 字符串
 */
export function optimizeMermaidSvg(svg: string): string {
  return (
    svg
      // 确保 viewBox 支持缩放
      .replace('<svg', '<svg preserveAspectRatio="xMidYMid meet"')
      // 移除硬编码背景色，适配容器
      .replace(/style="[^"]*background[^"]*"/gi, 'style="background: transparent"')
      // 移除某些主题下的幽灵矩形
      .replace(/<rect[^>]*class="ghost"[^>]*\/>/gi, '')
      .replace(/<rect[^>]*class="ghost"[^>]*><\/rect>/gi, '')
      // 修复自闭合 foreignObject 标签（避免 DOMPurify 移除）
      .replace(/<foreignObject([^>]*)\/>/gi, '<foreignObject$1></foreignObject>')
  )
}
