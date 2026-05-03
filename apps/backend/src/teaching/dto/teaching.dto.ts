import { createZodDto } from 'nestjs-zod'
import {
  SaveQuizRecordSchema,
  BatchSaveQuizRecordSchema,
  UpsertLearningProgressSchema,
  BatchUpsertLearningProgressSchema,
} from '@lumina/shared'

export class SaveQuizRecordDto extends createZodDto(SaveQuizRecordSchema) {}
export class BatchSaveQuizRecordDto extends createZodDto(BatchSaveQuizRecordSchema) {}
export class UpsertLearningProgressDto extends createZodDto(UpsertLearningProgressSchema) {}
export class BatchUpsertLearningProgressDto extends createZodDto(
  BatchUpsertLearningProgressSchema,
) {}
