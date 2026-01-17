/**
 * Wails 运行时工具
 * 用于检测是否在 Wails 环境中并提供类型安全的 Go 方法调用
 */

// 声明 Wails 注入的全局变量
interface WailsRuntime {
  WindowToggleMaximise?: () => void
  [key: string]: unknown
}

declare global {
  interface Window {
    go: Record<string, unknown>
    runtime: WailsRuntime
  }
}

/**
 * 检测当前是否运行在 Wails 环境中
 */
export const isWails = (): boolean => {
  return typeof window !== 'undefined' && (!!window.go || !!window.runtime)
}

/**
 * 包装 Go 方法调用，增加环境检查
 */
export const callGo = async <T>(method: string, ...args: unknown[]): Promise<T> => {
  if (!isWails()) {
    console.warn(`[Wails] Attempted to call ${method} outside of Wails environment`)
    return Promise.reject(new Error('Not in Wails environment'))
  }

  // 方法路径形如 'main.App.Greet'
  const parts = method.split('.')
  let current: unknown = window.go

  for (const part of parts) {
    if (!current || typeof current !== 'object') {
      return Promise.reject(new Error(`Method ${method} not found`))
    }
    current = (current as Record<string, unknown>)[part]
  }

  if (typeof current !== 'function') {
    return Promise.reject(new Error(`${method} is not a function`))
  }

  // 使用 Function.prototype.apply 或直接转型调用
  return (current as (...args: unknown[]) => Promise<T>)(...args)
}

/**
 * 常用系统操作封装
 */
export const system = {
  /**
   * 显示信息对话框
   */
  info: (title: string, message: string) => callGo('main.App.ShowInfoDialog', title, message),

  /**
   * 显示错误对话框
   */
  error: (title: string, message: string) => callGo('main.App.ShowErrorDialog', title, message),

  /**
   * 在浏览器中打开 URL
   */
  openBrowser: (url: string) => callGo('main.App.OpenBrowser', url),

  /**
   * 退出应用
   */
  quit: () => callGo('main.App.Quit'),

  /**
   * 切换窗口最大化
   */
  toggleMaximise: () => {
    if (isWails() && window.runtime?.WindowToggleMaximise) {
      window.runtime.WindowToggleMaximise()
    }
  },
}
