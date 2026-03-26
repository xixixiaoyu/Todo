import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const markdownCss = readFileSync(resolve(process.cwd(), 'src/styles/markdown.css'), 'utf8')

describe('markdown theme styles', () => {
  it('uses theme tokens instead of hardcoded warm surfaces', () => {
    expect(markdownCss).toContain('border: 1px solid hsl(var(--border));')
    expect(markdownCss).toContain('hsl(var(--card));')
    expect(markdownCss).not.toMatch(
      /#(?:e8e4dd|dcd8ce|eeebe4|f4f2eb|faf8f4|fdfcfb|fcfbf9|6b5c4d|4a3f35|5a4c3d|8b8680)/i,
    )
  })

  it('tints markdown tables and blockquotes with the active primary color', () => {
    expect(markdownCss).toContain('background-color: hsl(var(--primary) / 0.04);')
    expect(markdownCss).toContain('border-left: 4px solid hsl(var(--primary));')
    expect(markdownCss).toContain(
      'linear-gradient(0deg, hsl(var(--primary) / 0.08), hsl(var(--primary) / 0.08)),',
    )
  })

  it('keeps primary reading text fully opaque for better stroke clarity', () => {
    expect(markdownCss).toContain(
      '@apply text-[15px] font-medium leading-[1.75] subpixel-antialiased;',
    )
    expect(markdownCss).toContain('.markdown-table td {\n  @apply px-5 py-3 text-left font-medium;')
    expect(markdownCss).not.toContain('color: hsl(var(--foreground) / 0.92);')
    expect(markdownCss).not.toContain('color: hsl(var(--foreground) / 0.9);')
    expect(markdownCss).not.toContain('color: hsl(var(--foreground) / 0.88);')
  })

  it('uses theme-tinted strong text without background highlights', () => {
    expect(markdownCss).toContain('.markdown-content strong {\n  @apply font-extrabold;')
    expect(markdownCss).toContain('color: hsl(var(--primary-hover));')
    expect(markdownCss).toContain('@supports (color: color-mix(in oklab, black, white)) {')
    expect(markdownCss).toContain(
      'color: color-mix(in oklab, hsl(var(--foreground)) 38%, hsl(var(--primary-hover)) 62%);',
    )
    expect(markdownCss).toContain(
      'color: color-mix(in oklab, hsl(var(--foreground)) 30%, hsl(var(--primary)) 70%);',
    )
    expect(markdownCss).not.toContain('box-decoration-break: clone;')
    expect(markdownCss).not.toContain(
      '.markdown-content strong {\n  @apply font-extrabold;\n  color: hsl(var(--primary-hover));\n  background:',
    )
  })

  it('styles task lists as checklist items instead of default bullets', () => {
    expect(markdownCss).toContain(
      '.markdown-content .task-list-item {\n  @apply relative list-none pl-8;',
    )
    expect(markdownCss).toContain('.markdown-content .task-list-item > p:first-child {')
    expect(markdownCss).toContain('.markdown-content .task-list-item > .task-list-marker,')
    expect(markdownCss).toContain(
      '.markdown-content .task-list-item > p:first-child > .task-list-marker {',
    )
    expect(markdownCss).toContain('color: hsl(var(--primary-foreground));')
  })
})
