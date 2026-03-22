import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import McpSettingsManager from '@/features/mcp/components/McpSettingsManager.vue'

const fetchServers = vi.fn()

vi.mock('@/features/mcp/stores/mcp', () => ({
  useMcpStore: () => ({
    servers: [],
    isLoading: false,
    fetchServers,
    updateServer: vi.fn(),
    createServer: vi.fn(),
    getTools: vi.fn(),
  }),
}))

const mockConfig = ref({
  mcpEnabled: true,
})

const updateConfig = vi.fn()

vi.mock('@/features/ai/composables/useAIConfig', () => ({
  useAIConfig: () => ({
    config: mockConfig,
    updateConfig,
  }),
}))

const isAuthenticated = ref(true)

vi.mock('@/features/auth/stores/auth', () => ({
  useAuthStore: () => ({
    get isAuthenticated() {
      return isAuthenticated.value
    },
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('lucide-vue-next', () => ({
  Wrench: { template: '<span />' },
  X: { template: '<span />' },
  Terminal: { template: '<span />' },
  Loader2: { template: '<span />' },
  Plus: { template: '<span />' },
  Puzzle: { template: '<span />' },
}))

describe('McpSettingsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isAuthenticated.value = true
    mockConfig.value = { mcpEnabled: true }
  })

  it('fetches server configs without auto-connecting on mount', () => {
    mount(McpSettingsManager, {
      global: {
        stubs: {
          ScrollArea: {
            template: '<div><slot /></div>',
          },
          McpServerList: {
            template: '<div />',
          },
          McpServerForm: {
            template: '<div />',
          },
          Transition: false,
        },
      },
    })

    expect(fetchServers).toHaveBeenCalledWith({ autoConnect: false })
  })

  it('skips fetching when the user is not authenticated', () => {
    isAuthenticated.value = false

    mount(McpSettingsManager, {
      global: {
        stubs: {
          ScrollArea: {
            template: '<div><slot /></div>',
          },
          McpServerList: {
            template: '<div />',
          },
          McpServerForm: {
            template: '<div />',
          },
          Transition: false,
        },
      },
    })

    expect(fetchServers).not.toHaveBeenCalled()
  })
})
