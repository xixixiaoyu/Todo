import { createZodDto } from 'nestjs-zod'
import { SyncMergeRequestSchema } from '@lumina/shared'

export class SyncMergeDto extends createZodDto(SyncMergeRequestSchema) {}
