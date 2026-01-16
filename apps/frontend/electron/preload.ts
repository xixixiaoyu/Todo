const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 平台信息
  platform: process.platform,

  // 版本信息
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    unmaximize: () => ipcRenderer.send('window-unmaximize'),
    close: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  },

  // IPC 通信
  send: (channel: string, ...args: unknown[]) => {
    const validChannels = ['toMain']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args)
    }
  },

  receive: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = ['fromMain']
    if (validChannels.includes(channel)) {
      const subscription = (_event: any, ...args: unknown[]) => callback(...args)
      ipcRenderer.on(channel, subscription)
      return () => ipcRenderer.removeListener(channel, subscription)
    }
    return undefined
  },

  invoke: async (channel: string, ...args: unknown[]) => {
    const validChannels = ['dialog:openFile', 'dialog:saveFile']
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, ...args)
    }
    return null
  },
})
