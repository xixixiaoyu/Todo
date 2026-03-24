import { describe, expect, it } from 'vitest'
import { RecurrenceRuleSchema, TodoSchema } from './todo.schema'

describe('RecurrenceRuleSchema', () => {
  it('accepts supported recurrence rules', () => {
    const result = RecurrenceRuleSchema.safeParse('WEEKDAYS')
    expect(result.success).toBe(true)
  })

  it('rejects unsupported recurrence rule', () => {
    const result = RecurrenceRuleSchema.safeParse('YEARLY')
    expect(result.success).toBe(false)
  })
})

describe('TodoSchema recurrence fields', () => {
  it('accepts todo with recurrence metadata', () => {
    const now = new Date().toISOString()
    const result = TodoSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Daily standup',
      completed: false,
      order: 0,
      isPinned: false,
      version: 1,
      pomodoroCount: 0,
      dueAt: now,
      remindAt: now,
      recurrenceRule: 'DAILY',
      recurrenceTz: 'Asia/Shanghai',
      recurrenceSpawnedAt: null,
      createdAt: now,
      updatedAt: now,
    })

    expect(result.success).toBe(true)
  })

  it('accepts todo with deferred metadata', () => {
    const now = new Date().toISOString()
    const result = TodoSchema.safeParse({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Read later',
      completed: false,
      order: 0,
      isPinned: false,
      version: 1,
      pomodoroCount: 0,
      createdAt: now,
      updatedAt: now,
      deferredAt: now,
    })

    expect(result.success).toBe(true)
  })
})
