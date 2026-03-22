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

  it('keeps strong text understated with a primary-tinted underline emphasis', () => {
    expect(markdownCss).toContain('.markdown-content strong {\n  @apply font-bold;')
    expect(markdownCss).toContain('color: hsl(var(--foreground));')
    expect(markdownCss).toContain(
      'transparent 58%,\n    hsl(var(--primary) / 0.22) 58%,\n    hsl(var(--primary) / 0.22) 92%,\n    transparent 92%',
    )
    expect(markdownCss).toContain('box-decoration-break: clone;')
    expect(markdownCss).toContain(
      'transparent 56%,\n    hsl(var(--primary) / 0.28) 56%,\n    hsl(var(--primary) / 0.28) 94%,\n    transparent 94%',
    )
    expect(markdownCss).not.toContain('rounded-[0.4rem]')
    expect(markdownCss).not.toContain('text-shadow: 0 1px 0 hsl(var(--background) / 0.55);')
  })
})
