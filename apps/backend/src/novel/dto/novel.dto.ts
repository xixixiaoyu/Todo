import { createZodDto } from 'nestjs-zod'
import {
  CreateNovelDraftSchema,
  UpdateNovelDraftSchema,
  CreateNovelChapterSchema,
  UpdateNovelChapterSchema,
  UpsertNovelCharacterSchema,
  UpsertNovelWorldviewSchema,
} from '@lumina/shared'

export class CreateNovelDraftDto extends createZodDto(CreateNovelDraftSchema) {}
export class UpdateNovelDraftDto extends createZodDto(UpdateNovelDraftSchema) {}
export class CreateNovelChapterDto extends createZodDto(CreateNovelChapterSchema) {}
export class UpdateNovelChapterDto extends createZodDto(UpdateNovelChapterSchema) {}
export class UpsertNovelCharacterDto extends createZodDto(UpsertNovelCharacterSchema) {}
export class UpsertNovelWorldviewDto extends createZodDto(UpsertNovelWorldviewSchema) {}
