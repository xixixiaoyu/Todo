import { z } from 'zod'

/**
 * 测验题型枚举
 */
export const TeachingQuizKindSchema = z.enum(['single_choice', 'multi_choice', 'short_answer'])

/**
 * 测验结果枚举
 */
export const TeachingAssessmentResultSchema = z.enum(['correct', 'partial', 'incorrect'])

/**
 * 掌握度等级枚举
 */
export const TeachingMasteryLevelSchema = z.enum(['novice', 'developing', 'proficient'])

// ---- DTO: Quiz Record ----

export const SaveQuizRecordSchema = z.object({
  quizId: z.string().min(1),
  stem: z.string().min(1),
  kind: TeachingQuizKindSchema,
  userAnswer: z.union([z.string(), z.array(z.string())]),
  result: TeachingAssessmentResultSchema,
  mastery: TeachingMasteryLevelSchema,
  feedback: z.string(),
  nextFocus: z.string().optional(),
})

export const BatchSaveQuizRecordSchema = z.object({
  quizzes: z.array(SaveQuizRecordSchema).min(1).max(50),
})

// ---- DTO: Learning Progress ----

export const UpsertLearningProgressSchema = z.object({
  concept: z.string().min(1).max(200),
  masteryLevel: TeachingMasteryLevelSchema,
  quizCount: z.number().int().min(0).optional(),
  correctCount: z.number().int().min(0).optional(),
})

export const BatchUpsertLearningProgressSchema = z.object({
  items: z.array(UpsertLearningProgressSchema).min(1).max(50),
})

// ---- Response types ----

export const QuizRecordResponseSchema = z.object({
  id: z.string(),
  userId: z.number(),
  quizId: z.string(),
  stem: z.string(),
  kind: z.string(),
  userAnswer: z.unknown(),
  result: z.string(),
  mastery: z.string(),
  feedback: z.string(),
  nextFocus: z.string().nullable(),
  createdAt: z.string(),
})

export const LearningProgressResponseSchema = z.object({
  id: z.string(),
  userId: z.number(),
  concept: z.string(),
  masteryLevel: z.string(),
  lastQuizAt: z.string(),
  quizCount: z.number(),
  correctCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const TeachingOverviewResponseSchema = z.object({
  totalQuizzes: z.number(),
  correctRate: z.number(),
  concepts: z.array(LearningProgressResponseSchema),
})

// ---- Inferred types ----

export type TeachingQuizKind = z.infer<typeof TeachingQuizKindSchema>
export type TeachingAssessmentResult = z.infer<typeof TeachingAssessmentResultSchema>
export type TeachingMasteryLevel = z.infer<typeof TeachingMasteryLevelSchema>
export type SaveQuizRecord = z.infer<typeof SaveQuizRecordSchema>
export type BatchSaveQuizRecord = z.infer<typeof BatchSaveQuizRecordSchema>
export type UpsertLearningProgress = z.infer<typeof UpsertLearningProgressSchema>
export type BatchUpsertLearningProgress = z.infer<typeof BatchUpsertLearningProgressSchema>

// ---- Inferred response types (前端 API 层直接 import，避免手写重复) ----

export type QuizRecordResponse = z.infer<typeof QuizRecordResponseSchema>
export type LearningProgressResponse = z.infer<typeof LearningProgressResponseSchema>
export type TeachingOverviewResponse = z.infer<typeof TeachingOverviewResponseSchema>
