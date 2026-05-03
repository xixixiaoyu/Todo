import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { createWorkspaceRoutes } from '../../src/routes/workspaces'
import { WorkspaceStore } from '../../src/store/workspace-store'
import { errorHandler } from '../../src/server/errors'

function buildApp(store: WorkspaceStore): Hono {
  const app = new Hono()
  app.onError(errorHandler)
  app.route('/sidecar/workspaces', createWorkspaceRoutes(store))
  return app
}

describe('workspaces routes', () => {
  let dataDir: string
  let scratch: string
  let store: WorkspaceStore
  let app: Hono

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'lumina-ws-route-data-'))
    scratch = await mkdtemp(join(tmpdir(), 'lumina-ws-route-scratch-'))
    store = new WorkspaceStore(dataDir)
    app = buildApp(store)
  })

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true })
    await rm(scratch, { recursive: true, force: true })
  })

  it('GET /sidecar/workspaces 初始为空数组', async () => {
    const res = await app.request('/sidecar/workspaces')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, data: [] })
    expect(typeof body.timestamp).toBe('string')
  })

  it('POST /sidecar/workspaces 成功新增并返回 201', async () => {
    const target = join(scratch, 'alpha')
    await mkdir(target, { recursive: true })

    const res = await app.request('/sidecar/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: target }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.path).toBe(resolve(target))
    expect(body.data.id).toBeTruthy()
  })

  it('POST 无效 JSON 返回 400', async () => {
    const res = await app.request('/sidecar/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toMatch(/json/i)
  })

  it('POST 缺少 path 字段返回 400', async () => {
    const res = await app.request('/sidecar/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/path/i)
  })

  it('POST 路径不存在返回 400', async () => {
    const res = await app.request('/sidecar/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: join(scratch, 'nowhere') }),
    })
    expect(res.status).toBe(400)
  })

  it('DELETE /sidecar/workspaces/:id 成功返回 200', async () => {
    const target = join(scratch, 'delme')
    await mkdir(target, { recursive: true })
    const created = await store.add(target)

    const res = await app.request(`/sidecar/workspaces/${created.id}`, { method: 'DELETE' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ success: true, data: null })
    expect(await store.findAll()).toEqual([])
  })

  it('DELETE 不存在的 id 返回 404', async () => {
    const res = await app.request('/sidecar/workspaces/does-not-exist', { method: 'DELETE' })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.message).toMatch(/not found/i)
  })

  it('GET 列出已添加条目', async () => {
    const target = join(scratch, 'list-it')
    await mkdir(target, { recursive: true })
    await store.add(target)

    const res = await app.request('/sidecar/workspaces')
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].path).toBe(resolve(target))
  })
})
