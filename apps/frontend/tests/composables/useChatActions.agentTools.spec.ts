import { describe, it, expect, beforeEach } from 'vitest'
import {
  buildAgentLocalToolHandlers,
  AGENT_TOOL_DEFINITIONS,
} from '@/features/ai/composables/useChatActions.agentTools'
import { AGENT_TOOL_NAMES } from '@lumina/shared'

describe('buildAgentLocalToolHandlers', () => {
  let sidecarState: { port: number | null; token: string | null; isAvailable: boolean }
  let backendState: { sessionId: string | null; authToken: string }
  let handlers: Map<string, (args: Record<string, unknown>) => string | Promise<string>>

  beforeEach(() => {
    sidecarState = {
      port: 9999,
      token: 'test-token',
      isAvailable: true,
    }
    backendState = {
      sessionId: 'test-session-id',
      authToken: 'test-backend-token',
    }
    handlers = buildAgentLocalToolHandlers({
      sidecar: sidecarState,
      backend: backendState,
    })
  })

  it('returns handlers for all active agent tool names', () => {
    const expected = Object.values(AGENT_TOOL_NAMES).filter((n) => n !== AGENT_TOOL_NAMES.TASK)
    for (const name of expected) {
      expect(handlers.has(name)).toBe(true)
    }
  })

  it('throws when sidecar is not available', async () => {
    const offlineHandlers = buildAgentLocalToolHandlers({
      sidecar: { port: null, token: null, isAvailable: false },
      backend: backendState,
    })

    const handler = offlineHandlers.get(AGENT_TOOL_NAMES.READ_FILE)
    expect(handler).toBeDefined()
    await expect(handler!({ filePath: '/tmp/test.txt' })).rejects.toThrow()
  })
})

describe('AGENT_TOOL_DEFINITIONS', () => {
  it('has valid AI tool definitions', () => {
    expect(AGENT_TOOL_DEFINITIONS.length).toBeGreaterThan(0)
    for (const tool of AGENT_TOOL_DEFINITIONS) {
      expect(tool.type).toBe('function')
      expect(tool.function.name).toBeTruthy()
      expect(tool.function.description).toBeTruthy()
      expect(tool.function.parameters).toBeDefined()
      expect(tool.function.parameters.type).toBe('object')
    }
  })

  it('has all required tools', () => {
    const names = AGENT_TOOL_DEFINITIONS.map((t) => t.function.name)
    // TASK tool is not yet implemented; excluded from current tool list
    const expected = Object.values(AGENT_TOOL_NAMES).filter((n) => n !== AGENT_TOOL_NAMES.TASK)
    for (const name of expected) {
      expect(names).toContain(name)
    }
  })
})
