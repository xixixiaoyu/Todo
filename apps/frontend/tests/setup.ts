import { beforeEach, vi } from 'vitest'

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

vi.stubGlobal('localStorage', localStorageMock as unknown as Storage)
vi.stubGlobal('fetch', vi.fn())
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  return window.setTimeout(() => cb(Date.now()), 0)
})
vi.stubGlobal('cancelAnimationFrame', (id: number) => {
  window.clearTimeout(id)
})

beforeEach(() => {
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
