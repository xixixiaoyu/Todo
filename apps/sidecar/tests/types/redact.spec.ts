import { describe, it, expect } from 'vitest'
import { McpTransportType } from '@lumina/shared'
import type { StdioConfig } from '@lumina/shared'
import { REDACTED, redactServerConfig, toServerResponse } from '../../src/types'
import type { LocalHttpConfig, McpServerConfig } from '../../src/types'

function baseServer(
  transport: McpTransportType,
  config: StdioConfig | LocalHttpConfig,
): McpServerConfig {
  return {
    id: 'srv-1',
    name: 'demo',
    description: null,
    transport,
    config,
    enabled: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  }
}

describe('redactServerConfig - stdio', () => {
  it('env 存在时全部键的值替换为占位符', () => {
    const input: StdioConfig = {
      command: 'node',
      args: ['server.js'],
      env: { FOO: 'secret-1', BAR: 'secret-2' },
    }
    const out = redactServerConfig(input) as StdioConfig
    expect(out.command).toBe('node')
    expect(out.args).toEqual(['server.js'])
    expect(out.env).toEqual({ FOO: REDACTED, BAR: REDACTED })
  })

  it('env 不存在时保持 undefined', () => {
    const input: StdioConfig = { command: 'echo', args: [] }
    const out = redactServerConfig(input) as StdioConfig
    expect(out.env).toBeUndefined()
  })

  it('不修改原对象（返回新对象）', () => {
    const input: StdioConfig = {
      command: 'node',
      args: [],
      env: { K: 'v' },
    }
    const out = redactServerConfig(input) as StdioConfig
    expect(out).not.toBe(input)
    expect(input.env).toEqual({ K: 'v' })
  })
})

describe('redactServerConfig - http', () => {
  it('bearer token 被替换', () => {
    const input: LocalHttpConfig = {
      url: 'https://api.example.com',
      auth: { type: 'bearer', token: 'super-secret' },
    }
    const out = redactServerConfig(input) as LocalHttpConfig
    expect(out.auth?.type).toBe('bearer')
    expect(out.auth?.token).toBe(REDACTED)
  })

  it('api_key 被替换，apiKeyHeader 保留', () => {
    const input: LocalHttpConfig = {
      url: 'https://api.example.com',
      auth: { type: 'api_key', apiKey: 'k-1', apiKeyHeader: 'X-My-Key' },
    }
    const out = redactServerConfig(input) as LocalHttpConfig
    expect(out.auth?.apiKey).toBe(REDACTED)
    expect(out.auth?.apiKeyHeader).toBe('X-My-Key')
  })

  it('oauth token 被替换', () => {
    const input: LocalHttpConfig = {
      url: 'https://api.example.com',
      auth: { type: 'oauth', token: 'oauth-token' },
    }
    const out = redactServerConfig(input) as LocalHttpConfig
    expect(out.auth?.token).toBe(REDACTED)
  })

  it('headers 中的敏感头按模式打码', () => {
    const input: LocalHttpConfig = {
      url: 'https://api.example.com',
      headers: {
        Authorization: 'Bearer abc',
        authorization: 'Bearer def',
        cookie: 'sid=xxx',
        'X-Api-Key': 'key-123',
        'Proxy-Authorization': 'Basic yyy',
        'X-Custom': 'keep',
      },
    }
    const out = redactServerConfig(input) as LocalHttpConfig
    expect(out.headers?.Authorization).toBe(REDACTED)
    expect(out.headers?.authorization).toBe(REDACTED)
    expect(out.headers?.cookie).toBe(REDACTED)
    expect(out.headers?.['X-Api-Key']).toBe(REDACTED)
    expect(out.headers?.['Proxy-Authorization']).toBe(REDACTED)
    expect(out.headers?.['X-Custom']).toBe('keep')
  })

  it('auth 不存在时保持 undefined', () => {
    const input: LocalHttpConfig = { url: 'https://api.example.com' }
    const out = redactServerConfig(input) as LocalHttpConfig
    expect(out.auth).toBeUndefined()
  })
})

describe('toServerResponse', () => {
  it('默认启用脱敏（等价 redact=true）', () => {
    const server = baseServer(McpTransportType.HTTP, {
      url: 'https://x',
      auth: { type: 'bearer', token: 'leak-me' },
    })
    const resp = toServerResponse(server)
    const cfg = resp.config as LocalHttpConfig
    expect(cfg.auth?.token).toBe(REDACTED)
  })

  it('显式 redact=false 返回原始配置（用于连接流程）', () => {
    const server = baseServer(McpTransportType.HTTP, {
      url: 'https://x',
      auth: { type: 'bearer', token: 'leak-me' },
    })
    const resp = toServerResponse(server, { redact: false })
    const cfg = resp.config as LocalHttpConfig
    expect(cfg.auth?.token).toBe('leak-me')
  })

  it('保留基础字段不变', () => {
    const server = baseServer(McpTransportType.STDIO, {
      command: 'node',
      args: [],
      env: { SECRET: 'x' },
    })
    const resp = toServerResponse(server)
    expect(resp.id).toBe(server.id)
    expect(resp.name).toBe(server.name)
    expect(resp.enabled).toBe(server.enabled)
    expect(resp.transport).toBe(McpTransportType.STDIO)
    expect(resp.createdAt).toBe(server.createdAt)
    expect(resp.updatedAt).toBe(server.updatedAt)
  })
})
