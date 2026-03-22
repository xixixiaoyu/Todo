import { describe, expect, it } from 'vitest'
import {
  hasLegacyReminderOffset,
  resolveScheduleUpdate,
} from '@/features/todo/stores/todo.schedule'

describe('todo.schedule', () => {
  describe('hasLegacyReminderOffset', () => {
    it('returns false for reminder-only schedules', () => {
      expect(hasLegacyReminderOffset(null, new Date('2026-03-18T08:30:00.000Z'))).toBe(false)
    })

    it('returns true for due schedules with a distinct reminder time', () => {
      expect(
        hasLegacyReminderOffset(
          new Date('2026-03-17T09:00:00.000Z'),
          new Date('2026-03-17T08:30:00.000Z'),
        ),
      ).toBe(true)
    })
  })

  describe('resolveScheduleUpdate', () => {
    it('keeps reminder-only schedules when the editor stays in reminder mode', () => {
      expect(
        resolveScheduleUpdate(
          null,
          new Date('2026-03-18T08:30:00.000Z'),
          new Date('2026-03-19T10:15:00.000Z'),
          null,
          {
            scheduleKind: 'reminder',
            keepLegacyReminderOffset: false,
          },
        ),
      ).toStrictEqual({
        dueAt: null,
        remindAt: new Date('2026-03-19T10:15:00.000Z'),
      })
    })

    it('promotes reminder-only schedules to due schedules when the editor switches to due mode', () => {
      expect(
        resolveScheduleUpdate(
          null,
          new Date('2026-03-18T08:30:00.000Z'),
          new Date('2026-03-19T10:15:00.000Z'),
          null,
          {
            scheduleKind: 'due',
            keepLegacyReminderOffset: false,
          },
        ),
      ).toStrictEqual({
        dueAt: new Date('2026-03-19T10:15:00.000Z'),
        remindAt: new Date('2026-03-19T10:15:00.000Z'),
      })
    })

    it('preserves legacy reminder offsets only when explicitly requested', () => {
      expect(
        resolveScheduleUpdate(
          new Date('2026-03-17T09:00:00.000Z'),
          new Date('2026-03-17T08:30:00.000Z'),
          new Date('2026-03-17T10:15:00.000Z'),
          null,
          {
            scheduleKind: 'due',
            keepLegacyReminderOffset: true,
          },
        ),
      ).toStrictEqual({
        dueAt: new Date('2026-03-17T10:15:00.000Z'),
        remindAt: new Date('2026-03-17T09:45:00.000Z'),
      })
    })

    it('resets legacy reminder offsets to the due time when custom reminders are disabled', () => {
      expect(
        resolveScheduleUpdate(
          new Date('2026-03-17T09:00:00.000Z'),
          new Date('2026-03-17T08:30:00.000Z'),
          new Date('2026-03-17T10:15:00.000Z'),
          null,
          {
            scheduleKind: 'due',
            keepLegacyReminderOffset: false,
          },
        ),
      ).toStrictEqual({
        dueAt: new Date('2026-03-17T10:15:00.000Z'),
        remindAt: new Date('2026-03-17T10:15:00.000Z'),
      })
    })
  })
})
