import { describe, it, expect } from 'vitest'
import { resolve, sep } from 'node:path'
import { isPathAllowed, assertPathAllowed } from '../../src/security/workspace-guard'
import { ValidationError } from '../../src/server/errors'

describe('isPathAllowed', () => {
  it('空 target 返回 false', () => {
    expect(isPathAllowed('', ['/tmp'])).toBe(false)
  })

  it('target 等于 root 视为允许', () => {
    const root = resolve('/tmp/work')
    expect(isPathAllowed(root, [root])).toBe(true)
  })

  it('target 在 root 子目录内允许', () => {
    const root = resolve('/tmp/work')
    const child = resolve('/tmp/work/project/src')
    expect(isPathAllowed(child, [root])).toBe(true)
  })

  it('前缀边界：/foo 不能匹配 /foobar', () => {
    const root = resolve('/tmp/foo')
    const target = resolve('/tmp/foobar/file')
    expect(isPathAllowed(target, [root])).toBe(false)
  })

  it('上级目录越界拒绝', () => {
    const root = resolve('/tmp/work')
    const target = resolve('/tmp/other')
    expect(isPathAllowed(target, [root])).toBe(false)
  })

  it('支持 .. 规范化', () => {
    const root = resolve('/tmp/work')
    const traversal = resolve('/tmp/work/a/../../../etc/passwd')
    expect(isPathAllowed(traversal, [root])).toBe(false)
  })

  it('任一 root 匹配即放行', () => {
    const roots = [resolve('/tmp/a'), resolve('/tmp/b')]
    const target = resolve('/tmp/b/sub')
    expect(isPathAllowed(target, roots)).toBe(true)
  })

  it('空 roots 数组返回 false', () => {
    const target = resolve('/tmp/a')
    expect(isPathAllowed(target, [])).toBe(false)
  })

  it('root 为空字符串时被跳过', () => {
    const target = resolve('/tmp/a')
    expect(isPathAllowed(target, ['', resolve('/tmp/a')])).toBe(true)
    expect(isPathAllowed(target, [''])).toBe(false)
  })

  it('相对路径以 process.cwd() 解析', () => {
    const cwd = process.cwd()
    expect(isPathAllowed('sub/file', [cwd])).toBe(true)
    expect(isPathAllowed('sub/file', [resolve(cwd, '..', 'other')])).toBe(false)
  })
})

describe('assertPathAllowed', () => {
  it('空 roots 抛出 ValidationError 提示未配置', () => {
    expect(() => assertPathAllowed('/tmp/a', [])).toThrow(ValidationError)
    expect(() => assertPathAllowed('/tmp/a', [])).toThrow(/no workspace roots configured/)
  })

  it('路径越界抛出 ValidationError 且不泄露 roots', () => {
    const roots = [resolve('/tmp/secret-project')]
    try {
      assertPathAllowed('/tmp/outside', roots, 'MCP cwd')
      throw new Error('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError)
      const msg = (err as Error).message
      expect(msg).toContain('MCP cwd')
      expect(msg).toMatch(/outside the configured workspace allow-list/)
      expect(msg).not.toContain('secret-project')
    }
  })

  it('合法路径不抛错', () => {
    const root = resolve('/tmp/work')
    expect(() => assertPathAllowed(`${root}${sep}child`, [root])).not.toThrow()
  })
})
