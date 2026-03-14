import { describe, expect, it } from 'vitest'
import { McpTransportType, UpdateMcpServerSchema } from './mcp.schema'

describe('UpdateMcpServerSchema', () => {
  it('accepts partial updates that do not touch runtime config', () => {
    const result = UpdateMcpServerSchema.safeParse({
      name: 'updated name',
      enabled: false,
    })

    expect(result.success).toBe(true)
  })

  it('rejects config-only updates', () => {
    const result = UpdateMcpServerSchema.safeParse({
      config: {
        url: 'https://example.com/mcp',
      },
    })

    expect(result.success).toBe(false)
  })

  it('rejects transport-only updates', () => {
    const result = UpdateMcpServerSchema.safeParse({
      transport: McpTransportType.HTTP,
    })

    expect(result.success).toBe(false)
  })

  it('accepts runtime config updates when transport and config match', () => {
    const result = UpdateMcpServerSchema.safeParse({
      transport: McpTransportType.HTTP,
      config: {
        url: 'https://example.com/mcp',
      },
    })

    expect(result.success).toBe(true)
  })
})
