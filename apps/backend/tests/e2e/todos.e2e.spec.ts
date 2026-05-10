import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'crypto'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { unwrapApiResponse } from '@lumina/shared'
import type { ApiResponse, AuthResponse, SyncResponse, Todo } from '@lumina/shared'
import { createE2eApp } from './test-app'

const ajaxHeaders = {
  'content-type': 'application/json',
  'x-requested-with': 'XMLHttpRequest',
}

describe('Todos e2e', () => {
  let app: NestFastifyApplication
  let inject: <T = unknown>(opts: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'
    url: string
    headers?: Record<string, string>
    payload?: unknown
  }) => Promise<{ statusCode: number; body: ApiResponse<T> | Record<string, unknown> }>

  beforeAll(async () => {
    const res = await createE2eApp()
    app = res.app
    inject = res.inject
  })

  afterAll(async () => {
    await app.close()
  })

  it('should create, trash, restore and permanently delete a todo via API', async () => {
    const registerRes = await inject<AuthResponse>({
      method: 'POST',
      url: '/api/auth/register',
      headers: ajaxHeaders,
      payload: { email: 'todo@example.com', name: 'Todo User', password: 'password123' },
    })

    const { accessToken } = unwrapApiResponse(registerRes.body as ApiResponse<AuthResponse>)
    const authHeadersWithBody = {
      ...ajaxHeaders,
      authorization: `Bearer ${accessToken}`,
    }
    const authHeadersNoBody = {
      'x-requested-with': 'XMLHttpRequest',
      authorization: `Bearer ${accessToken}`,
    }

    const id = randomUUID()
    const createdAt = new Date('2026-01-01T00:00:00.000Z').toISOString()
    const updatedAt1 = new Date('2026-01-01T00:00:01.000Z').toISOString()

    const createRes = await inject<SyncResponse>({
      method: 'POST',
      url: '/api/todos/sync',
      headers: authHeadersWithBody,
      payload: {
        todos: [
          {
            id,
            title: 'First',
            completed: false,
            order: 0,
            isPinned: false,
            parentId: null,
            version: 0,
            pomodoroCount: 0,
            dueAt: null,
            remindAt: null,
            remindedAt: null,
            completedAt: null,
            deletedAt: null,
            createdAt,
            updatedAt: updatedAt1,
          },
        ],
      },
    })

    expect(createRes.statusCode).toBe(201)
    const synced1 = unwrapApiResponse(createRes.body as ApiResponse<SyncResponse>).synced
    expect(synced1).toHaveLength(1)
    expect(synced1[0]!.id).toBe(id)
    expect(synced1[0]!.version).toBe(1)

    const listRes = await inject<Todo[]>({
      method: 'GET',
      url: '/api/todos',
      headers: { authorization: `Bearer ${accessToken}` },
    })

    expect(listRes.statusCode).toBe(200)
    expect(unwrapApiResponse(listRes.body as ApiResponse<Todo[]>)).toHaveLength(1)

    const updatedAt2 = new Date('2026-01-01T00:00:02.000Z').toISOString()
    const deletedAt = new Date('2026-01-01T00:00:03.000Z').toISOString()

    const trashRes = await inject<SyncResponse>({
      method: 'POST',
      url: '/api/todos/sync',
      headers: authHeadersWithBody,
      payload: {
        todos: [
          {
            ...synced1[0],
            deletedAt,
            updatedAt: updatedAt2,
            version: synced1[0]!.version,
          },
        ],
        lastSyncAt: createdAt,
      },
    })

    expect(trashRes.statusCode).toBe(201)

    const listAfterTrashRes = await inject<Todo[]>({
      method: 'GET',
      url: '/api/todos',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(unwrapApiResponse(listAfterTrashRes.body as ApiResponse<Todo[]>)).toHaveLength(0)

    const trashListRes = await inject<Todo[]>({
      method: 'GET',
      url: '/api/todos/trash',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(unwrapApiResponse(trashListRes.body as ApiResponse<Todo[]>)).toHaveLength(1)

    const restoreRes = await inject<Todo | null>({
      method: 'POST',
      url: `/api/todos/${id}/restore`,
      headers: authHeadersNoBody,
    })

    expect(restoreRes.statusCode).toBe(201)
    const restored = unwrapApiResponse(restoreRes.body as ApiResponse<Todo | null>)
    expect(restored && restored.deletedAt).toBeNull()

    const listAfterRestoreRes = await inject<Todo[]>({
      method: 'GET',
      url: '/api/todos',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(unwrapApiResponse(listAfterRestoreRes.body as ApiResponse<Todo[]>)).toHaveLength(1)

    const updatedAt3 = new Date('2026-01-01T00:00:04.000Z').toISOString()
    const deletedAt2 = new Date('2026-01-01T00:00:05.000Z').toISOString()

    const trashAgainRes = await inject<SyncResponse>({
      method: 'POST',
      url: '/api/todos/sync',
      headers: authHeadersWithBody,
      payload: {
        todos: [
          {
            ...(restored as Todo),
            deletedAt: deletedAt2,
            updatedAt: updatedAt3,
            version: (restored as Todo).version,
          },
        ],
        lastSyncAt: createdAt,
      },
    })

    expect(trashAgainRes.statusCode).toBe(201)

    const permanentRes = await inject<{ id: string } | null>({
      method: 'DELETE',
      url: `/api/todos/${id}/permanent`,
      headers: authHeadersNoBody,
    })

    expect(permanentRes.statusCode).toBe(200)
    expect(unwrapApiResponse(permanentRes.body as ApiResponse<{ id: string } | null>)).toEqual({
      id,
    })

    const syncAfterPermanentRes = await inject<SyncResponse>({
      method: 'POST',
      url: '/api/todos/sync',
      headers: authHeadersWithBody,
      payload: {
        todos: [],
        lastSyncAt: '1970-01-01T00:00:00.000Z',
      },
    })

    const { deletedIds } = unwrapApiResponse(
      syncAfterPermanentRes.body as ApiResponse<SyncResponse>,
    )
    expect(deletedIds).toContain(id)
  })
})
