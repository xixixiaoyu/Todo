import { app, BrowserWindow, session, shell, ipcMain, Menu, Tray, nativeImage } from 'electron'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// ESM 兼容：手动定义 __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

// 开发环境下禁用安全警告
if (VITE_DEV_SERVER_URL) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true'
}

// 禁用 GPU 加速以提高某些旧系统的稳定性（可选）
app.disableHardwareAcceleration()

// Windows 单例锁
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as Electron.MenuItemConstructorOptions] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: () => {
            void shell.openExternal('https://github.com/yunmu/Todo')
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function createTray() {
  // 托盘图标路径
  const iconPath = VITE_DEV_SERVER_URL
    ? join(__dirname, '../public/logo.png')
    : join(__dirname, '../dist/logo.png')

  try {
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    tray = new Tray(icon)

    const contextMenu = Menu.buildFromTemplate([
      { label: '显示主界面', click: () => mainWindow?.show() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ])

    tray.setToolTip('极简待办')
    tray.setContextMenu(contextMenu)
    tray.on('double-click', () => mainWindow?.show())
  } catch (error) {
    console.error('Failed to create tray:', error)
  }
}

function registerIpcHandlers() {
  ipcMain.on('window-minimize', () => mainWindow?.minimize())
  ipcMain.on('window-maximize', () => mainWindow?.maximize())
  ipcMain.on('window-unmaximize', () => mainWindow?.unmaximize())
  ipcMain.on('window-close', () => mainWindow?.close())
  ipcMain.handle('window-is-maximized', () => mainWindow?.isMaximized())
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hidden',
    // Windows 窗口控制按钮叠加层
    ...(isWin
      ? {
          titleBarOverlay: {
            color: '#ffffff00',
            symbolColor: '#333333',
            height: 40,
          },
        }
      : {}),
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  // 窗口准备好后再显示，避免白屏闪烁
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 外部链接用默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // 增强安全性：限制非预期导航
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url)
    if (VITE_DEV_SERVER_URL) {
      const devUrl = new URL(VITE_DEV_SERVER_URL)
      if (parsedUrl.origin !== devUrl.origin && parsedUrl.protocol !== 'file:') {
        event.preventDefault()
      }
    } else if (parsedUrl.protocol !== 'file:') {
      event.preventDefault()
    }
  })

  // 开发环境加载 dev server，生产环境加载打包文件
  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    void mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

void app.whenReady().then(() => {
  // 设置 Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = VITE_DEV_SERVER_URL
      ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ws://localhost:* http://localhost:*; img-src 'self' data: blob:"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:"

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    })
  })

  createMenu()
  createTray()
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  mainWindow = null
  if (!isMac) {
    app.quit()
  }
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
