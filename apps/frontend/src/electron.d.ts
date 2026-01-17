export interface ElectronAPI {
  platform: string
  versions: {
    node: string
    chrome: string
    electron: string
  }
  window: {
    minimize: () => void
    maximize: () => void
    unmaximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }
  send: (channel: string, ...args: unknown[]) => void
  receive: (channel: string, callback: (...args: unknown[]) => void) => (() => void) | undefined
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
}

export interface WailsRuntime {
  WindowMinimize: () => void
  WindowMaximize: () => void
  WindowUnmaximize: () => void
  WindowToggleMaximise: () => void
  WindowSetTitle: (title: string) => void
  Quit: () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
    go?: unknown
    runtime: WailsRuntime
  }
}

export {}
