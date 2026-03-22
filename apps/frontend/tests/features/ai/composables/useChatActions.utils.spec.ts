import { describe, it, expect } from 'vitest'
import {
  buildTeachingFallbackQuiz,
  hasRuntimeAuthToken,
  stripTodoIdsFromText,
} from '@/features/ai/composables/useChatActions.utils'

describe('useChatActions.utils', () => {
  it('strips todo ids from different text forms', () => {
    const input = [
      'Task title',
      'ID: 123e4567-e89b-12d3-a456-426614174000',
      '',
      'Nested note （id: temp-abc_123）',
      'Follow up with ID: temp-xyz',
    ].join('\n')

    expect(stripTodoIdsFromText(input)).toBe(
      ['Task title', '', 'Nested note Follow up with'].join('\n'),
    )
  })

  it('builds a fallback teaching quiz from content or default summary', () => {
    const t = (key: string, params?: Record<string, unknown>) => {
      if (key === 'ai.teachingFallbackSummaryDefault') return '默认摘要'
      if (key === 'ai.teachingFallbackQuestion') return `Question: ${params?.summary}`
      if (key === 'ai.teachingFallbackHint') return 'Hint text'
      return key
    }

    const quiz = buildTeachingFallbackQuiz('  任务 需要   拆解  ', 'msg-1', t)
    expect(quiz).toEqual([
      {
        id: 'msg-1-fallback-understand',
        kind: 'short_answer',
        stem: 'Question: 任务 需要 拆解',
        answerHint: 'Hint text',
      },
    ])

    const defaultQuiz = buildTeachingFallbackQuiz('', 'msg-2', t)
    expect(defaultQuiz[0].stem).toBe('Question: 默认摘要')
  })

  it('detects runtime auth from store token or persisted fallback token', () => {
    expect(hasRuntimeAuthToken('access-token', null)).toBe(true)
    expect(hasRuntimeAuthToken('', 'persisted-token')).toBe(true)
    expect(hasRuntimeAuthToken('   ', '   ')).toBe(false)
    expect(hasRuntimeAuthToken(null, null)).toBe(false)
  })
})
