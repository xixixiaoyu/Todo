import { BadRequestException } from '@nestjs/common'
import type {
  HttpSkillRuntime,
  SkillRuntimeTemplateValue,
  SkillRuntimeValueBinding,
} from './skill-runtime.dto'

export type SkillRuntimeMaterializedValue =
  | string
  | number
  | boolean
  | null
  | SkillRuntimeMaterializedValue[]
  | { [key: string]: SkillRuntimeMaterializedValue }

export interface SkillRuntimeMaterializationContext {
  runtime: HttpSkillRuntime
  argumentsMap: Record<string, unknown>
  providedSecrets?: Record<string, string>
  skillName: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isRuntimeBinding(value: SkillRuntimeTemplateValue): value is SkillRuntimeValueBinding {
  return isRecord(value) && (value.$source === 'arg' || value.$source === 'secret')
}

function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  const segments = path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)

  let current: unknown = source
  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0) return undefined
      current = current[index]
      continue
    }

    if (!isRecord(current)) return undefined
    current = current[segment]
  }

  return current
}

function resolveSecretValue(
  secretKey: string,
  providedSecrets: Record<string, string> | undefined,
): string | undefined {
  const providedValue = providedSecrets?.[secretKey]?.trim()
  if (providedValue) return providedValue
  return undefined
}

function materializeResolvedValue(
  value: unknown,
  context: SkillRuntimeMaterializationContext,
): SkillRuntimeMaterializedValue | undefined {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => materializeResolvedValue(item, context))
      .filter((item): item is SkillRuntimeMaterializedValue => item !== undefined)

    return items
  }

  if (!isRecord(value)) return undefined

  const objectEntries = Object.entries(value)
    .map(([key, entryValue]) => {
      const materialized = materializeResolvedValue(entryValue, context)
      return materialized === undefined ? null : [key, materialized]
    })
    .filter((entry): entry is [string, SkillRuntimeMaterializedValue] => !!entry)

  return Object.fromEntries(objectEntries)
}

function resolveBindingValue(params: {
  binding: SkillRuntimeValueBinding
  context: SkillRuntimeMaterializationContext
}): SkillRuntimeMaterializedValue | undefined {
  const { binding, context } = params
  const { runtime, argumentsMap, providedSecrets, skillName } = context

  const rawValue =
    binding.$source === 'arg'
      ? getNestedValue(argumentsMap, binding.key)
      : resolveSecretValue(binding.key, providedSecrets)

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    if (binding.default !== undefined) {
      return materializeSkillRuntimeTemplateValue(binding.default, context)
    }

    const secretDefinition = runtime.secrets?.find((item) => item.key === binding.key)
    if (binding.required || secretDefinition?.required) {
      throw new BadRequestException(
        `Missing required runtime ${binding.$source} "${binding.key}" for skill "${skillName}"`,
      )
    }

    return undefined
  }

  if (!binding.prefix && !binding.suffix) {
    return materializeResolvedValue(rawValue, context)
  }

  const materializedRaw = materializeResolvedValue(rawValue, context)
  if (materializedRaw === undefined) return undefined

  return `${binding.prefix || ''}${stringifySkillRuntimeScalar(materializedRaw)}${binding.suffix || ''}`
}

export function isMaterializedObject(
  value: SkillRuntimeMaterializedValue | undefined,
): value is Record<string, SkillRuntimeMaterializedValue> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function materializeSkillRuntimeTemplateValue(
  value: SkillRuntimeTemplateValue,
  context: SkillRuntimeMaterializationContext,
): SkillRuntimeMaterializedValue | undefined {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    const items = value
      .map((item) => materializeSkillRuntimeTemplateValue(item, context))
      .filter((item): item is SkillRuntimeMaterializedValue => item !== undefined)

    return items
  }

  if (isRuntimeBinding(value)) {
    return resolveBindingValue({
      binding: value,
      context,
    })
  }

  if (!isRecord(value)) return undefined

  const objectEntries = Object.entries(value)
    .map(([key, entryValue]) => {
      const materialized = materializeSkillRuntimeTemplateValue(
        entryValue as SkillRuntimeTemplateValue,
        context,
      )
      return materialized === undefined ? null : [key, materialized]
    })
    .filter((entry): entry is [string, SkillRuntimeMaterializedValue] => !!entry)

  return Object.fromEntries(objectEntries)
}

export function stringifySkillRuntimeScalar(value: SkillRuntimeMaterializedValue): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null) return 'null'
  return JSON.stringify(value)
}
