import { createZodDto } from 'nestjs-zod'
import { SyncMergeRequestSchema } from '@my-app/shared'

export class SyncMergeDto extends createZodDto(SyncMergeRequestSchema) {}
