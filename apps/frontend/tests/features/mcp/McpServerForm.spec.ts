import { describe, it, expect, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import McpServerForm from '@/features/mcp/components/McpServerForm.vue'
import {
  McpTransportType,
  type CreateMcpServerDto,
  type McpServerResponse,
} from '@/features/mcp/api/mcp'

// Mock Lucide icons
vi.mock('lucide-vue-next', () => ({
  X: { render: () => h('div') },
  Plus: { render: () => h('div') },
  Trash2: { render: () => h('div') },
  Terminal: { render: () => h('div') },
  Globe: { render: () => h('div') },
  Server: { render: () => h('div') },
  Loader2: { render: () => h('div') },
}))

describe('McpServerForm.vue', () => {
  it('renders correctly for new server', () => {
    const wrapper = mount(McpServerForm)
    expect(wrapper.text()).toContain('Add MCP Server')
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
    const descTextarea = wrapper.find('textarea#description').element as HTMLTextAreaElement

    expect(nameInput.value).toBe('Test Server')
    expect(descTextarea.value).toBe('Test Desc')
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

  it('emits submit event with correct data', async () => {
    const wrapper = mount(McpServerForm)

    await wrapper.find('input#name').setValue('New Server')
    await wrapper.find('input#command').setValue('node')

    // Find the submit button by text
    const submitBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Update Server') || b.text().includes('Create Server'))
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
    await argInput.trigger('keyup.enter')
    await nextTick()

    expect(wrapper.text()).toContain('--debug')

    // Remove it - find the X button within the badge
    const removeBtn = wrapper.find('button .w-3.h-3').element.parentElement
    await (removeBtn as HTMLElement).click()
    await nextTick()

    expect(wrapper.text()).not.toContain('--debug')
  })
})
