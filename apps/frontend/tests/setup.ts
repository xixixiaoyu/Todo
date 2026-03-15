import { beforeEach, vi } from 'vitest'

function extractStringArgs(args: unknown[]): string[] {
  return args.filter((arg): arg is string => typeof arg === 'string')
}

function shouldSuppressFrontendTestLog(args: unknown[]): boolean {
  const textArgs = extractStringArgs(args)
  if (textArgs.length === 0) return false

  return textArgs.some(
    (text) =>
      text.includes("KaTeX doesn't work in quirks mode") ||
      text.startsWith('[INFO] common.pomodoro:') ||
      text.startsWith('Retrying ') ||
      text.includes('AI breakdown JSON parse failed, falling back to line splitting') ||
      text.includes('Failed to trigger haptic feedback'),
  )
}

const originalWarn = console.warn.bind(console)
console.warn = (...args: unknown[]) => {
  if (shouldSuppressFrontendTestLog(args)) {
    return
  }
  originalWarn(...args)
}

const originalError = console.error.bind(console)
console.error = (...args: unknown[]) => {
  if (shouldSuppressFrontendTestLog(args)) {
    return
  }
  originalError(...args)
}

function createLocalStorageMock() {
  let store: Record<string, string> = {}

  const storage = {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value)
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }

  Object.defineProperty(storage, 'length', {
    get: () => Object.keys(store).length,
  })

  return storage
}

const localStorageMock = createLocalStorageMock()
const pendingRafTimers = new Set<number>()

vi.stubGlobal('localStorage', localStorageMock as unknown as Storage)
vi.stubGlobal('fetch', vi.fn())
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  const timerId = window.setTimeout(() => {
    pendingRafTimers.delete(timerId)
    if (typeof globalThis.requestAnimationFrame !== 'function') return
    cb(Date.now())
  }, 0)
  pendingRafTimers.add(timerId)
  return timerId
})
vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  pendingRafTimers.delete(id)
  window.clearTimeout(id)
})

if (!document.doctype) {
  const doctype = document.implementation.createDocumentType('html', '', '')
  document.insertBefore(doctype, document.documentElement)
}

beforeEach(() => {
  pendingRafTimers.forEach((timerId) => {
    window.clearTimeout(timerId)
  })
  pendingRafTimers.clear()

  localStorageMock.getItem.mockClear()
  localStorageMock.setItem.mockClear()
  localStorageMock.removeItem.mockClear()
  localStorageMock.clear.mockClear()
  localStorageMock.key.mockClear()
  localStorageMock.clear()

  const fetchValue = fetch as unknown as { mockReset?: () => void; mockClear?: () => void }
  fetchValue.mockReset?.()
  fetchValue.mockClear?.()
})

// Mock MCP API globally
vi.mock('@/features/mcp/api/mcp', () => ({
  mcpApi: {
    getAllTools: vi.fn().mockResolvedValue([]),
    getServers: vi.fn().mockResolvedValue([]),
    createServer: vi.fn().mockResolvedValue({}),
    updateServer: vi.fn().mockResolvedValue({}),
    deleteServer: vi.fn().mockResolvedValue({}),
    getTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({}),
  },
  McpTransportType: {
    STDIO: 'stdio',
    HTTP: 'http',
  },
}))

// Mock window.matchMedia if needed
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
