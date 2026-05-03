import { Hono } from 'hono'
import type { WorkspaceStore } from '../store/workspace-store'
import { NotFoundError, ValidationError } from '../server/errors'

/**
 * Workspace 白名单路由
 * - GET    /sidecar/workspaces       列出所有工作目录
 * - POST   /sidecar/workspaces       { path } 添加一个工作目录
 * - DELETE /sidecar/workspaces/:id   移除指定工作目录
 */
export function createWorkspaceRoutes(store: WorkspaceStore): Hono {
  const app = new Hono()

  app.get('/', async (c) => {
    const items = await store.findAll()
    return c.json({
      success: true,
      data: items,
      timestamp: new Date().toISOString(),
    })
  })

  app.post('/', async (c) => {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      throw new ValidationError('Request body must be valid JSON')
    }

    const path =
      typeof body === 'object' && body !== null && 'path' in body
        ? (body as { path: unknown }).path
        : undefined

    if (typeof path !== 'string' || !path.trim()) {
      throw new ValidationError('path must be a non-empty string')
    }

    const ws = await store.add(path)
    return c.json(
      {
        success: true,
        data: ws,
        timestamp: new Date().toISOString(),
      },
      201,
    )
  })

  app.delete('/:id', async (c) => {
    const { id } = c.req.param()
    const removed = await store.remove(id)
    if (!removed) throw new NotFoundError('Workspace', id)
    return c.json({
      success: true,
      data: null,
      timestamp: new Date().toISOString(),
    })
  })

  return app
}
