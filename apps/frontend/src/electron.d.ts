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

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
