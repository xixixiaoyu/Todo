import { vi } from 'vitest'

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
