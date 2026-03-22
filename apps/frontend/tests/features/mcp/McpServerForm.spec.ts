import { describe, it, expect, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import McpServerForm from '@/features/mcp/components/McpServerForm.vue'
import {
  McpTransportType,
  type CreateMcpServerDto,
  type McpServerResponse,
} from '@/features/mcp/api/mcp'

// Mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'ai.mcpCreateServer': 'Create MCP Server',
        'ai.mcpEditServer': 'Edit MCP Server',
        'ai.mcpServerName': 'Server Name',
        'ai.mcpServerNamePlaceholder': 'Enter server name',
        'ai.mcpDescription': 'Description',
        'ai.mcpDescriptionPlaceholder': 'Enter description',
        'ai.mcpEnabled': 'Enabled',
        'ai.mcpTransportType': 'Transport Type',
        'ai.mcpStdio': 'Stdio',
        'ai.mcpHttp': 'HTTP',
        'ai.mcpCommand': 'Command',
        'ai.mcpCommandPlaceholder': 'e.g. node',
        'ai.mcpCommandHint': 'Enter command',
        'ai.mcpArguments': 'Arguments',
        'ai.mcpAddArgument': 'Add an argument',
        'ai.mcpEnvVars': 'Environment Variables',
        'ai.mcpUrl': 'URL',
        'ai.mcpUrlPlaceholder': 'e.g. http://localhost:3000',
        'ai.mcpServerUrl': 'Server URL',
        'ai.mcpServerUrlPlaceholder': 'HTTPS Required',
        'ai.mcpAuth': 'Authentication',
        'ai.mcpAuthMethod': 'Auth Method',
        'ai.mcpNoAuth': 'No Auth',
        'ai.mcpNoAuthDescription': 'No auth required',
        'ai.mcpAuthToken': 'Token',
        'ai.mcpAuthApiKey': 'API Key',
        'ai.mcpAuthHeader': 'Header',
        'ai.mcpUrlAuthHint': 'URL already includes auth parameters',
        'ai.mcpStdioDescription': 'Standard Input/Output',
        'ai.mcpHttpDescription': 'HTTP SSE',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.update': 'Update',
        'common.create': 'Create',
      }
      return translations[key] || key
    },
  }),
}))

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  X: { render: () => h('div', { class: 'lucide-x' }) },
  Plus: { render: () => h('div', { class: 'lucide-plus' }) },
  Trash2: { render: () => h('div', { class: 'lucide-trash-2' }) },
  Terminal: { render: () => h('div', { class: 'lucide-terminal' }) },
  Globe: { render: () => h('div', { class: 'lucide-globe' }) },
  Server: { render: () => h('div', { class: 'lucide-server' }) },
  Loader2: { render: () => h('div', { class: 'lucide-loader-2' }) },
  RotateCcw: { render: () => h('div', { class: 'lucide-rotate-ccw' }) },
  CheckCircle2: { render: () => h('div', { class: 'lucide-check-circle-2' }) },
}))

describe('McpServerForm.vue', () => {
  it('renders correctly for new server', () => {
    const wrapper = mount(McpServerForm)
    expect(wrapper.text()).toContain('Create MCP Server')
    expect(wrapper.find('input#name').exists()).toBe(true)
  })

  it('initializes with server data when provided', async () => {
    const server = {
      id: '1',
      name: 'Test Server',
      description: 'Test Desc',
      transport: McpTransportType.STDIO,
      config: { command: 'node', args: ['-v'] },
      enabled: true,
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const wrapper = mount(McpServerForm, {
      props: { server: server as unknown as McpServerResponse },
    })

    // Wait for onMounted and reactivity
    await nextTick()

    const nameInput = wrapper.find('input#name').element as HTMLInputElement
    expect(nameInput.value).toBe('Test Server')
  })

  it('switches transport types', async () => {
    const wrapper = mount(McpServerForm)

    // Default should be STDIO
    const btns = wrapper.findAll('button')
    const stdioBtn = btns.find((b) => b.text().includes('Stdio'))
    const httpBtn = btns.find((b) => b.text().includes('HTTP'))

    await httpBtn?.trigger('click')
    await nextTick()
    expect(wrapper.find('input#url').exists()).toBe(true)

    await stdioBtn?.trigger('click')
    await nextTick()
    expect(wrapper.find('input#command').exists()).toBe(true)
  })

  it('defaults HTTP auth to no auth and omits auth from submit when left empty', async () => {
    const wrapper = mount(McpServerForm)

    const httpBtn = wrapper.findAll('button').find((b) => b.text().includes('HTTP'))

    await httpBtn?.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('No Auth')
    expect(wrapper.text()).toContain('No auth required')

    await wrapper.find('input#name').setValue('HTTP Server')
    await wrapper.find('input#url').setValue('https://mcp.tavily.com/mcp')

    const submitBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Update') || b.text().includes('Create'))
    await submitBtn?.trigger('click')
    await nextTick()

    const emissions = wrapper.emitted('submit')
    const submitData = emissions?.[0][0] as unknown as CreateMcpServerDto

    expect(submitData.transport).toBe(McpTransportType.HTTP)
    expect('auth' in submitData.config ? submitData.config.auth : undefined).toBeUndefined()
  })

  it('shows auth hint when URL already contains auth-like query params', async () => {
    const wrapper = mount(McpServerForm)

    const httpBtn = wrapper.findAll('button').find((b) => b.text().includes('HTTP'))

    await httpBtn?.trigger('click')
    await nextTick()

    await wrapper
      .find('input#url')
      .setValue('https://mcp.tavily.com/mcp?tavilyApiKey=tvly-dev-example')
    await nextTick()

    expect(wrapper.text()).toContain('URL already includes auth parameters')
  })

  it('emits submit event with correct data', async () => {
    const wrapper = mount(McpServerForm)

    await wrapper.find('input#name').setValue('New Server')
    await wrapper.find('input#command').setValue('node')

    // Find the submit button by text
    const submitBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Update') || b.text().includes('Create'))
    await submitBtn?.trigger('click')
    await nextTick()

    expect(wrapper.emitted('submit')).toBeTruthy()
    const emissions = wrapper.emitted('submit')
    const submitData = emissions?.[0][0] as unknown as CreateMcpServerDto
    expect(submitData.name).toBe('New Server')
    expect(submitData.transport).toBe(McpTransportType.STDIO)
  })

  it('manages arguments list', async () => {
    const wrapper = mount(McpServerForm)

    const argInput = wrapper.find('input[placeholder="Add an argument"]')
    await argInput.setValue('--debug')
    await argInput.trigger('keydown.enter')
    await nextTick()

    expect(wrapper.text()).toContain('--debug')

    // Remove it
    const removeBtn = wrapper.find('.lucide-x').element.closest('button')
    await (removeBtn as HTMLButtonElement).click()
    await nextTick()

    expect(wrapper.text()).not.toContain('--debug')
  })
})
