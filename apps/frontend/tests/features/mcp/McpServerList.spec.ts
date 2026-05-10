import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import McpServerList from '@/features/mcp/components/McpServerList.vue'
import { McpTransportType } from '@/features/mcp/api/mcp'
import type { McpServerResponse } from '@/features/mcp/api/mcp'

const mockStore = {
  connectionStates: {} as Record<string, boolean>,
  connectingStates: {} as Record<string, boolean>,
  serverErrors: {} as Record<string, string | null>,
  connectServer: vi.fn(),
  toggleActive: vi.fn(),
  deleteServer: vi.fn(),
}

vi.mock('@/features/mcp/stores/mcp', () => ({
  useMcpStore: () => mockStore,
}))

vi.mock('@/composables/useGsap', () => ({
  useGsap: () => ({
    gsap: {
      from: vi.fn(),
    },
    ctx: {
      add: (cb: () => void) => cb(),
    },
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('lucide-vue-next', () => ({
  Activity: { template: '<span />' },
  Globe: { template: '<span />' },
  Loader2: { template: '<span />' },
  Plus: { template: '<span />' },
  RotateCcw: { template: '<span />' },
  Settings2: { template: '<span />' },
  Terminal: { template: '<span />' },
  Trash2: { template: '<span />' },
  Wrench: { template: '<span />' },
}))

const baseServer: McpServerResponse = {
  id: 's1',
  name: 'Tavily',
  description: null,
  transport: McpTransportType.HTTP,
  config: {
    url: 'https://mcp.tavily.com/mcp',
  },
  enabled: true,
  userId: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('McpServerList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.connectionStates = {}
    mockStore.connectingStates = {}
    mockStore.serverErrors = {}
  })

  it('shows connect-on-use status for enabled but idle servers', () => {
    const wrapper = mount(McpServerList, {
      props: {
        servers: [baseServer],
        mcpEnabled: true,
      },
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    expect(wrapper.text()).toContain('ai.mcpConnectOnUse')
  })
})
