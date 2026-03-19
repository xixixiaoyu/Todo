import type { TeachingQuiz } from '@/features/ai/services/aiService'

export function stripTodoIdsFromText(input: string): string {
  const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
  const tempId = 'temp-[A-Za-z0-9_-]+'

  let out = input
  out = out.replace(
    new RegExp(`^\\s*(?:ID|Id|id)\\s*[:：]\\s*(?:${uuid}|${tempId})\\s*$`, 'gm'),
    '',
  )
  out = out.replace(
    new RegExp(`\\s*[（(]\\s*(?:ID|Id|id)\\s*[:：]\\s*(?:${uuid}|${tempId})\\s*[)）]\\s*`, 'g'),
    ' ',
  )
  out = out.replace(new RegExp(`\\b(?:ID|Id|id)\\s*[:：]\\s*(?:${uuid}|${tempId})\\b`, 'g'), '')
  out = out.replace(/\n{3,}/g, '\n\n').trim()
  return out
}

export function buildTeachingFallbackQuiz(
  content: string,
  messageId: string,
  t: (key: string, params?: Record<string, unknown>) => string,
): TeachingQuiz[] {
  const normalized = content.replace(/\s+/g, ' ').trim()
  const summary =
    normalized.length > 0
      ? normalized.slice(0, 120)
      : (t('ai.teachingFallbackSummaryDefault') as string)

  return [
    {
      id: `${messageId}-fallback-understand`,
      kind: 'short_answer',
      stem: t('ai.teachingFallbackQuestion', { summary }) as string,
      answerHint: t('ai.teachingFallbackHint') as string,
    },
  ]
}
