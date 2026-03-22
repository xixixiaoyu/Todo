import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const themeCss = readFileSync(resolve(process.cwd(), 'src/styles/theme.css'), 'utf8')

describe('theme defaults', () => {
  it('uses the tuned celadon fallback tokens in light mode', () => {
    expect(themeCss).toContain('--primary: var(--user-primary, 166 18% 53%);')
    expect(themeCss).toContain('--primary-hover: var(--user-primary-hover, 166 18% 47%);')
    expect(themeCss).toContain('--primary-rgb: var(--user-primary-rgb, 114, 157, 147);')
  })

  it('uses the tuned celadon fallback tokens in dark mode', () => {
    expect(themeCss).toContain('--primary: var(--user-primary-dark, 166 18% 71%);')
    expect(themeCss).toContain('--primary-hover: var(--user-primary-hover-dark, 166 18% 76%);')
    expect(themeCss).toContain('--primary-rgb: var(--user-primary-rgb-dark, 168, 194, 188);')
  })
})
