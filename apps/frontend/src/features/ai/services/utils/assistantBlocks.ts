import { z } from 'zod'
import type { ProposedTodoChange } from '@/features/todo/stores/todo'
import type {
  TeachingQuiz,
  TeachingQuizKind,
  StructuredBlockError,
  StructuredBlockKind,
} from '../types'

export interface TaggedBlock {
  start: number
  end: number
  inner: string
}

export function extractTaggedBlocks(
  content: string,
  startTag: string,
  endTag: string,
): TaggedBlock[] {
  const blocks: TaggedBlock[] = []
  let cursor = 0

  while (cursor < content.length) {
    const start = content.indexOf(startTag, cursor)
    if (start === -1) break
    const end = content.indexOf(endTag, start + startTag.length)
    if (end === -1) break

    const inner = content.slice(start + startTag.length, end).trim()
    blocks.push({ start, end: end + endTag.length, inner })
    cursor = end + endTag.length
  }

  return blocks
}

export function stripTaggedBlocks(
  content: string,
  startTag: string,
  endTag: string,
): { text: string; inners: string[]; hasPartialStart: boolean } {
  const blocks = extractTaggedBlocks(content, startTag, endTag)
  if (blocks.length === 0) {
    const partialStart = content.indexOf(startTag)
    if (partialStart !== -1) {
      return {
        text: content.slice(0, partialStart).trim(),
        inners: [],
        hasPartialStart: true,
      }
    }
    return { text: content.trim(), inners: [], hasPartialStart: false }
  }

  let text = ''
  let last = 0
  for (const b of blocks) {
    text += content.slice(last, b.start)
    last = b.end
  }
  text += content.slice(last)

  return { text: text.trim(), inners: blocks.map((b) => b.inner), hasPartialStart: false }
}

export function safeJsonParse(input: string): unknown | undefined {
  try {
    return JSON.parse(input) as unknown
  } catch {
    return undefined
  }
}

export interface ParsedAssistantBlocks {
  cleanText: string
  todoActions?: ProposedTodoChange[]
  teachingQuizzes?: TeachingQuiz[]
  errors: StructuredBlockError[]
  pendingStructuredBlocks: StructuredBlockKind[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeTeachingQuizKind(value: unknown): TeachingQuizKind | null {
  if (value === 'single_choice' || value === 'multi_choice' || value === 'short_answer')
    return value
  return null
}

function normalizeTeachingQuizOption(value: unknown) {
  if (!isRecord(value)) return null
  const id = value.id
  const text = value.text
  if (!isNonEmptyString(id) || !isNonEmptyString(text)) return null
  return { id, text }
}

function normalizeTeachingQuiz(value: unknown): TeachingQuiz | null {
  if (!isRecord(value)) return null
  const id = value.id
  const kind = normalizeTeachingQuizKind(value.kind)
  const stem = value.stem
  if (!isNonEmptyString(id) || !kind || typeof stem !== 'string') return null

  const answerHint = typeof value.answerHint === 'string' ? value.answerHint : undefined
  const optionsRaw = value.options
  const options = Array.isArray(optionsRaw)
    ? optionsRaw.map(normalizeTeachingQuizOption).filter((x): x is NonNullable<typeof x> => !!x)
    : undefined

  const userAnswer = (() => {
    const ua = value.userAnswer
    if (typeof ua === 'string') return ua
    if (Array.isArray(ua) && ua.every((x) => typeof x === 'string')) return ua
    return undefined
  })()

  return {
    id,
    kind,
    stem,
    ...(options && options.length > 0 ? { options } : {}),
    ...(answerHint ? { answerHint } : {}),
    ...(userAnswer !== undefined ? { userAnswer } : {}),
  }
}

function normalizeTeachingQuizzes(parsed: unknown): TeachingQuiz[] | null {
  const quizzes = (() => {
    if (Array.isArray(parsed)) return parsed
    if (isRecord(parsed) && Array.isArray(parsed.quizzes)) return parsed.quizzes
    return null
  })()
  if (!quizzes) return null

  const normalized = quizzes.map(normalizeTeachingQuiz).filter((x): x is TeachingQuiz => !!x)
  if (normalized.length === 0) return null
  return normalized
}

function normalizeTodoActions(parsed: unknown): ProposedTodoChange[] | null {
  const trimmedNonEmpty = z
    .string()
    .transform((s) => s.trim())
    .refine((s) => s.length > 0)

  const todoId = trimmedNonEmpty

  const addActionSchema = z.object({
    type: z.literal('add'),
    id: todoId.optional(),
    data: z
      .object({
        title: trimmedNonEmpty,
        parentId: z.union([todoId, z.null()]).optional(),
      })
      .passthrough(),
  })

  const updateActionSchema = z.object({
    type: z.literal('update'),
    id: todoId.optional(),
    data: z
      .object({
        id: todoId,
        title: trimmedNonEmpty.optional(),
        parentId: z.union([todoId, z.null()]).optional(),
      })
      .passthrough(),
  })

  const idOnlyActionDataSchema = z.object({ id: todoId }).passthrough()

  const deleteActionSchema = z.object({
    type: z.literal('delete'),
    id: todoId.optional(),
    data: idOnlyActionDataSchema,
  })

  const toggleActionSchema = z.object({
    type: z.literal('toggle'),
    id: todoId.optional(),
    data: idOnlyActionDataSchema,
  })

  const pinActionSchema = z.object({
    type: z.literal('pin'),
    id: todoId.optional(),
    data: idOnlyActionDataSchema,
  })

  const todoActionSchema = z.union([
    addActionSchema,
    updateActionSchema,
    deleteActionSchema,
    toggleActionSchema,
    pinActionSchema,
  ])

  const res = z.array(z.unknown()).safeParse(parsed)
  if (!res.success) return null

  const normalized: ProposedTodoChange[] = []

  for (let i = 0; i < res.data.length; i++) {
    const item = res.data[i]
    const parsedItem = todoActionSchema.safeParse(item)
    if (!parsedItem.success) continue

    const action = parsedItem.data
    const id = isNonEmptyString(action.id) ? action.id : `temp-${i + 1}`

    const parentId =
      action.type === 'add' || action.type === 'update'
        ? typeof action.data.parentId === 'string'
          ? action.data.parentId
          : (action.data.parentId ?? undefined)
        : undefined

    normalized.push({
      id,
      type: action.type,
      data: {
        ...action.data,
        ...(action.type === 'add' || action.type === 'update' ? { parentId } : {}),
      } as ProposedTodoChange['data'],
    })
  }

  return normalized.length > 0 ? normalized : null
}

function parseLastValidJsonBlock<T>(
  inners: string[],
  validate: (value: unknown) => T | null,
  errorBlock: StructuredBlockKind,
  errors: StructuredBlockError[],
): T | null {
  for (let i = inners.length - 1; i >= 0; i--) {
    const raw = inners[i]
    const parsed = safeJsonParse(raw)
    if (parsed === undefined) {
      errors.push({ block: errorBlock, code: 'invalid_json', raw })
      continue
    }
    const normalized = validate(parsed)
    if (normalized) return normalized
    errors.push({ block: errorBlock, code: 'invalid_shape', raw })
  }
  errors.push({ block: errorBlock, code: 'no_valid_block' })
  return null
}

export function parseAssistantBlocks(
  content: string,
  options?: { enableTodoActions?: boolean },
): ParsedAssistantBlocks {
  const errors: StructuredBlockError[] = []
  const pendingStructuredBlocks = new Set<StructuredBlockKind>()
  const normalizeText = (input: string) => input.replace(/\n{3,}/g, '\n\n').trim()

  const todoRes = stripTaggedBlocks(content, '[TODO_ACTIONS_START]', '[TODO_ACTIONS_END]')
  if (todoRes.hasPartialStart) {
    errors.push({ block: 'todo_actions', code: 'partial_block' })
    pendingStructuredBlocks.add('todo_actions')
  }
  const todoActions =
    options?.enableTodoActions && todoRes.inners.length > 0
      ? parseLastValidJsonBlock(todoRes.inners, normalizeTodoActions, 'todo_actions', errors) ||
        undefined
      : undefined

  const teachingRes = stripTaggedBlocks(
    todoRes.text,
    '[TEACHING_QUIZ_START]',
    '[TEACHING_QUIZ_END]',
  )
  if (teachingRes.hasPartialStart) {
    errors.push({ block: 'teaching_quiz', code: 'partial_block' })
    pendingStructuredBlocks.add('teaching_quiz')
  }
  const teachingQuizzes =
    teachingRes.inners.length > 0
      ? parseLastValidJsonBlock(
          teachingRes.inners,
          normalizeTeachingQuizzes,
          'teaching_quiz',
          errors,
        ) || undefined
      : undefined

  return {
    cleanText: normalizeText(teachingRes.text),
    ...(todoActions ? { todoActions } : {}),
    ...(teachingQuizzes ? { teachingQuizzes } : {}),
    errors,
    pendingStructuredBlocks: Array.from(pendingStructuredBlocks),
  }
}
