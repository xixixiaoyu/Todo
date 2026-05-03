import { resolve, sep } from 'node:path'
import { ValidationError } from '../server/errors'

/**
 * 返回 target 规范化后的绝对路径是否被任一 root 覆盖。
 *
 * 规则：
 * - target 必须先 path.resolve()（相对路径视为相对 process.cwd()）
 * - root 必须先 path.resolve()
 * - target 在 root 下 = target === root 或 target 以 root + sep 开头
 *   （防止 `/foo` 误判为 `/foobar` 的子目录）
 *
 * 注意：此函数仅做字符串层面的规范化比较，**不会解析符号链接**。
 * 若需要防软链接逃逸，调用方应先 fs.realpath() 再传入。
 */
export function isPathAllowed(target: string, roots: readonly string[]): boolean {
  if (!target) return false
  const absTarget = resolve(target)

  for (const root of roots) {
    if (!root) continue
    const absRoot = resolve(root)
    if (absTarget === absRoot) return true
    if (absTarget.startsWith(absRoot + sep)) return true
  }
  return false
}

/**
 * 断言路径合法，否则抛出 ValidationError。
 * 信息不透出具体 roots 内容，避免敏感路径泄露给错误日志。
 */
export function assertPathAllowed(target: string, roots: readonly string[], ctx = 'path'): void {
  if (roots.length === 0) {
    throw new ValidationError(
      `${ctx} not allowed: no workspace roots configured. Add one via POST /sidecar/workspaces first.`,
    )
  }
  if (!isPathAllowed(target, roots)) {
    throw new ValidationError(`${ctx} is outside the configured workspace allow-list`)
  }
}
