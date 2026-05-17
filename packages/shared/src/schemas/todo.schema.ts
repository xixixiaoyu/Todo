import { z } from 'zod'

export const RecurrenceRuleSchema = z.enum(['DAILY', 'WEEKDAYS', 'WEEKLY', 'MONTHLY'])

/**
 * Todo 基础架构
 */
export const TodoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(1000),
  completed: z.boolean().default(false),
  order: z.number().int().default(0),
  isPinned: z.boolean().default(false),
  parentId: z.string().uuid().nullable().optional(),
  version: z.number().int().default(0),
  pomodoroCount: z.number().int().default(0),
  dueAt: z.date().or(z.string()).nullable().optional(),
  remindAt: z.date().or(z.string()).nullable().optional(),
  remindedAt: z.date().or(z.string()).nullable().optional(),
  recurrenceRule: RecurrenceRuleSchema.nullable().optional(),
  recurrenceTz: z.string().min(1).max(64).nullable().optional(),
  recurrenceSpawnedAt: z.date().or(z.string()).nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
  completedAt: z.date().or(z.string()).nullable().optional(),
  deferredAt: z.date().or(z.string()).nullable().optional(),
  deletedAt: z.date().or(z.string()).nullable().optional(),
})

export type Todo = z.infer<typeof TodoSchema>
export type RecurrenceRule = z.infer<typeof RecurrenceRuleSchema>
