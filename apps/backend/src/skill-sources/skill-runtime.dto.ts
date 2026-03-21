import { z } from 'zod'
import { createZodDto } from 'nestjs-zod'

export type SkillRuntimeTemplateValue =
  | string
  | number
  | boolean
  | null
  | SkillRuntimeValueBinding
  | SkillRuntimeTemplateValue[]
  | { [key: string]: SkillRuntimeTemplateValue }

export interface SkillRuntimeValueBinding {
  $source: 'arg' | 'secret'
  key: string
  default?: SkillRuntimeTemplateValue
  required?: boolean
  prefix?: string
  suffix?: string
}

export interface SkillRuntimeExecutionSecret {
  key: string
  required?: boolean
}

const SkillRuntimeHttpMethodSchema = z.enum(['GET', 'POST'])
const SkillRuntimeResponseTypeSchema = z.enum(['json', 'text'])

const SkillRuntimeValueBindingSchema: z.ZodType<SkillRuntimeValueBinding> = z.lazy(() =>
  z
    .object({
      $source: z.enum(['arg', 'secret']),
      key: z.string().trim().min(1).max(255),
      default: SkillRuntimeTemplateValueSchema.optional(),
      required: z.boolean().optional(),
      prefix: z.string().trim().max(200).optional(),
      suffix: z.string().trim().max(200).optional(),
    })
    .strict(),
)

export const SkillRuntimeTemplateValueSchema: z.ZodType<SkillRuntimeTemplateValue> = z.lazy(() =>
  z.union([
    z.string().max(4000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    SkillRuntimeValueBindingSchema,
    z.array(SkillRuntimeTemplateValueSchema).max(100),
    z.record(z.string().trim().min(1).max(255), SkillRuntimeTemplateValueSchema),
  ]),
)

const SkillRuntimeExecutionSecretSchema: z.ZodType<SkillRuntimeExecutionSecret> = z
  .object({
    key: z.string().trim().min(1).max(100),
    required: z.boolean().optional(),
  })
  .strict()

export const HttpSkillRuntimeSchema = z
  .object({
    type: z.literal('http'),
    secrets: z.array(SkillRuntimeExecutionSecretSchema).max(20).optional(),
    request: z
      .object({
        url: z.string().trim().url().max(2000),
        method: SkillRuntimeHttpMethodSchema.optional(),
        headers: z
          .record(z.string().trim().min(1).max(255), SkillRuntimeTemplateValueSchema)
          .optional(),
        query: z
          .record(z.string().trim().min(1).max(255), SkillRuntimeTemplateValueSchema)
          .optional(),
        body: SkillRuntimeTemplateValueSchema.optional(),
        timeoutMs: z.number().int().min(1000).max(30000).optional(),
        responseType: SkillRuntimeResponseTypeSchema.optional(),
      })
      .strict(),
  })
  .strict()

export const ExecuteHttpSkillRuntimeRequestSchema = z
  .object({
    skillName: z.string().trim().min(1).max(200),
    runtime: HttpSkillRuntimeSchema,
    arguments: z.record(z.string().trim().min(1).max(255), z.unknown()).default({}),
    secrets: z.record(z.string().trim().min(1).max(100), z.string().max(5000)).optional(),
  })
  .strict()

export class ExecuteHttpSkillRuntimeDto extends createZodDto(
  ExecuteHttpSkillRuntimeRequestSchema,
) {}

export type HttpSkillRuntime = z.infer<typeof HttpSkillRuntimeSchema>
