import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import { createBashRoutes } from '../../src/routes/bash'
import { errorHandler } from '../../src/server/errors'
import { WorkspaceStore } from '../../src/store/workspace-store'

describe('Bash routes', () => {
  let tmpDir: string
  let dataDir: string
  let workspaceStore: WorkspaceStore
  let app: Hono

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'bash-test-'))
    dataDir = join(tmpDir, 'data')
    workspaceStore = new WorkspaceStore(dataDir)
    await workspaceStore.add(tmpDir)

    const bashRoutes = createBashRoutes(workspaceStore)
    app = new Hono()
    app.onError(errorHandler)
    app.route('/', bashRoutes)
  })

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // cleanup failure ok
    }
  })

  it('executes a simple command', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'echo hello' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.stdout).toContain('hello')
  })

  it('blocks dangerous commands', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'sudo rm -rf /' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
  })

  it('blocks rm -rf / pattern', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'rm -rf / --no-preserve-root' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects empty command', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects cwd outside workspace', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'ls', cwd: '/etc' }),
    })
    expect(res.status).toBe(400)
  })

  it('captures stderr for failing commands', async () => {
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'ls /nonexistent' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    // 命令失败时 exitCode 非零，stderr 应包含错误信息
    expect(body.data.exitCode).not.toBe(0)
    expect(body.data.stderr).toBeTruthy()
  })
})
