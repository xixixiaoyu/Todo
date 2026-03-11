import { z } from 'zod'

/**
 * Todo 基础架构
 */
export const TodoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(500),
  completed: z.boolean().default(false),
  order: z.number().int().default(0),
  isPinned: z.boolean().default(false),
  parentId: z.string().uuid().nullable().optional(),
  version: z.number().int().default(0),
  pomodoroCount: z.number().int().default(0),
  dueAt: z.date().or(z.string()).nullable().optional(),
  remindAt: z.date().or(z.string()).nullable().optional(),
  remindedAt: z.date().or(z.string()).nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
  completedAt: z.date().or(z.string()).nullable().optional(),
  deletedAt: z.date().or(z.string()).nullable().optional(),
})

/**
 * 同步项 Schema
 */
export const SyncItemSchema = TodoSchema.extend({
  // 可以在这里添加一些同步特有的字段
})

/**
 * 批量同步/合并请求 Schema
 */
export const SyncMergeRequestSchema = z.object({
  todos: z.array(SyncItemSchema),
  lastSyncAt: z
    .date()
    .or(
      z
        .string()
        .min(1)
        .refine((value) => !Number.isNaN(new Date(value).getTime())),
    )
    .optional(),
})

export const SyncConflictSchema = z.object({
  id: z.string().uuid(),
  reason: z.enum(['TOMBSTONED', 'OWNER_MISMATCH', 'VERSION_CONFLICT']),
  serverVersion: z.number().int().optional(),
})

/**
 * 同步响应 Schema
 */
export const SyncResponseSchema = z.object({
  synced: z.array(TodoSchema),
  deletedIds: z.array(z.string()),
  acceptedIds: z.array(z.string().uuid()).optional(),
  conflicts: z.array(SyncConflictSchema).optional(),
  serverTime: z.string(),
})

export type Todo = z.infer<typeof TodoSchema>
export type SyncItem = z.infer<typeof SyncItemSchema>
export type SyncMergeRequest = z.infer<typeof SyncMergeRequestSchema>
export type SyncConflict = z.infer<typeof SyncConflictSchema>
export type SyncResponse = z.infer<typeof SyncResponseSchema>
