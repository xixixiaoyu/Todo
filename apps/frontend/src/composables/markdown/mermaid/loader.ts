/**
 * Mermaid 动态加载器
 * 负责按需加载 mermaid 库并提供浏览器 polyfill
 */
let mermaid: typeof import('mermaid').default | null = null
let mermaidLoadPromise: Promise<typeof import('mermaid').default> | null = null

/**
 * 动态加载 Mermaid 库（单例，惰性初始化）
 * 首次调用时执行 import('mermaid') 并为浏览器环境设置必要的 polyfill
 */
export async function loadMermaid(): Promise<typeof import('mermaid').default> {
  if (mermaid) return mermaid
  if (mermaidLoadPromise) return await mermaidLoadPromise

  mermaidLoadPromise = (async () => {
    // 浏览器环境 polyfill：mermaid 内部依赖 process 对象
    if (typeof window !== 'undefined') {
      const win = window as unknown as { process: Record<string, unknown> }
      win.process = {
        browser: true,
        env: { DEBUG: '', NODE_ENV: 'production' },
        platform: 'browser',
        version: 'v18.0.0',
      }
    }

    const mermaidModule = await import('mermaid')
    mermaid =
      (mermaidModule as { default?: typeof import('mermaid').default }).default ||
      (mermaidModule as unknown as typeof import('mermaid').default)
    return mermaid!
  })()

  return await mermaidLoadPromise
}

/**
 * 获取已加载的 mermaid 实例（不触发加载）
 */
export function getLoadedMermaid(): typeof import('mermaid').default | null {
  return mermaid
}
