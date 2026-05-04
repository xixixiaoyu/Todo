import { z } from 'zod'

/**
 * 小说题材枚举
 */
export const NovelGenreSchema = z.enum([
  'fantasy',
  'sci_fi',
  'romance',
  'thriller',
  'wuxia',
  'literary',
  'horror',
  'cyberpunk',
])

/**
 * 小说状态枚举
 */
export const NovelDraftStatusSchema = z.enum(['draft', 'ongoing', 'completed'])

/**
 * 角色身份枚举
 */
export const NovelCharacterRoleSchema = z.enum([
  'protagonist',
  'deuteragonist',
  'antagonist',
  'supporting',
])

/**
 * 世界观分类枚举
 */
export const NovelWorldviewCategorySchema = z.enum([
  'geography',
  'culture',
  'magic_system',
  'technology',
  'politics',
  'history',
])

// ---- DTO: Draft ----

export const CreateNovelDraftSchema = z.object({
  title: z.string().min(1).max(200),
  genre: NovelGenreSchema.optional(),
  tone: z.string().max(100).optional(),
  protagonist: z.string().max(200).optional(),
})

export const UpdateNovelDraftSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  genre: NovelGenreSchema.optional().nullable(),
  tone: z.string().max(100).optional().nullable(),
  protagonist: z.string().max(200).optional().nullable(),
  status: NovelDraftStatusSchema.optional(),
})

// ---- DTO: Chapter ----

export const CreateNovelChapterSchema = z.object({
  chapterIndex: z.number().int().min(1),
  title: z.string().min(1).max(200),
  content: z.string(),
  wordCount: z.number().int().min(0).optional(),
})

export const UpdateNovelChapterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  wordCount: z.number().int().min(0).optional(),
})

// ---- DTO: Character ----

export const UpsertNovelCharacterSchema = z.object({
  characterId: z.string().min(1),
  name: z.string().min(1).max(100),
  role: NovelCharacterRoleSchema,
  traits: z.array(z.string()),
  motivation: z.string().optional(),
  backstory: z.string().optional(),
  firstChapter: z.number().int().min(1),
})

// ---- DTO: Worldview ----

export const UpsertNovelWorldviewSchema = z.object({
  settingId: z.string().min(1),
  category: NovelWorldviewCategorySchema,
  name: z.string().min(1).max(100),
  description: z.string(),
  firstChapter: z.number().int().min(1),
})

// ---- Response types ----

export const NovelDraftResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  genre: z.string().nullable(),
  tone: z.string().nullable(),
  protagonist: z.string().nullable(),
  status: z.string(),
  userId: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  _count: z.object({ chapters: z.number().optional() }).optional(),
})

export const NovelChapterResponseSchema = z.object({
  id: z.string(),
  draftId: z.string(),
  chapterIndex: z.number(),
  title: z.string(),
  content: z.string(),
  wordCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const NovelCharacterResponseSchema = z.object({
  id: z.string(),
  draftId: z.string(),
  characterId: z.string(),
  name: z.string(),
  role: z.string(),
  traits: z.array(z.string()),
  motivation: z.string().nullable(),
  backstory: z.string().nullable(),
  firstChapter: z.number(),
  lastChapter: z.number(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const NovelWorldviewResponseSchema = z.object({
  id: z.string(),
  draftId: z.string(),
  settingId: z.string(),
  category: z.string(),
  name: z.string(),
  description: z.string(),
  firstChapter: z.number(),
  version: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type NovelGenre = z.infer<typeof NovelGenreSchema>
export type NovelDraftStatus = z.infer<typeof NovelDraftStatusSchema>
export type CreateNovelDraft = z.infer<typeof CreateNovelDraftSchema>
export type UpdateNovelDraft = z.infer<typeof UpdateNovelDraftSchema>
export type CreateNovelChapter = z.infer<typeof CreateNovelChapterSchema>
export type UpdateNovelChapter = z.infer<typeof UpdateNovelChapterSchema>
export type UpsertNovelCharacter = z.infer<typeof UpsertNovelCharacterSchema>
export type UpsertNovelWorldview = z.infer<typeof UpsertNovelWorldviewSchema>

// ---- Inferred response types (前端 API 层直接 import，避免手写重复) ----

export type NovelDraftResponse = z.infer<typeof NovelDraftResponseSchema>
export type NovelChapterResponse = z.infer<typeof NovelChapterResponseSchema>
export type NovelCharacterResponse = z.infer<typeof NovelCharacterResponseSchema>
export type NovelWorldviewResponse = z.infer<typeof NovelWorldviewResponseSchema>
