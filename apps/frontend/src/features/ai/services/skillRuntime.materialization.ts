import type { AISkillRuntimeTemplateValue, AISkillRuntimeValueBinding } from './types'

export interface SkillRuntimeSecretDefinition {
  key: string
  required?: boolean
}

export interface SkillRuntimeMaterializationContext {
  runtime: {
    secrets?: SkillRuntimeSecretDefinition[]
  }
  argumentsMap: Record<string, unknown>
  providedSecrets?: Record<string, string>
  skillName: string
}

export type SkillRuntimeMaterializedValue =
  | string
  | number
  | boolean
  | null
  | SkillRuntimeMaterializedValue[]
  | { [key: string]: SkillRuntimeMaterializedValue }

const OMITTED_RUNTIME_VALUE = Symbol('omitted-runtime-value')

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isRuntimeBinding(value: AISkillRuntimeTemplateValue): value is AISkillRuntimeValueBinding {
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
): SkillRuntimeMaterializedValue | typeof OMITTED_RUNTIME_VALUE {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => materializeResolvedValue(item))
      .filter((item): item is SkillRuntimeMaterializedValue => item !== OMITTED_RUNTIME_VALUE)
  }

  if (!isRecord(value)) return OMITTED_RUNTIME_VALUE

  const entries = Object.entries(value)
    .map(([key, entryValue]) => {
      const materialized = materializeResolvedValue(entryValue)
      return materialized === OMITTED_RUNTIME_VALUE ? null : [key, materialized]
    })
    .filter((entry): entry is [string, SkillRuntimeMaterializedValue] => !!entry)

  return Object.fromEntries(entries)
}

function stringifyResolvedValue(value: SkillRuntimeMaterializedValue): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value === null) return 'null'
  return JSON.stringify(value)
}

function materializeBindingValue(
  binding: AISkillRuntimeValueBinding,
  context: SkillRuntimeMaterializationContext,
): SkillRuntimeMaterializedValue | typeof OMITTED_RUNTIME_VALUE {
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
      throw new Error(
        `Missing required runtime ${binding.$source} "${binding.key}" for skill "${skillName}"`,
      )
    }

    return OMITTED_RUNTIME_VALUE
  }

  const materializedRaw = materializeResolvedValue(rawValue)
  if (materializedRaw === OMITTED_RUNTIME_VALUE) return OMITTED_RUNTIME_VALUE

  if (!binding.prefix && !binding.suffix) {
    return materializedRaw
  }

  return `${binding.prefix || ''}${stringifyResolvedValue(materializedRaw)}${binding.suffix || ''}`
}

function materializeArgsBindingValue(
  binding: AISkillRuntimeValueBinding,
  argumentsMap: Record<string, unknown>,
): SkillRuntimeMaterializedValue | typeof OMITTED_RUNTIME_VALUE {
  const rawValue = binding.$source === 'arg' ? getNestedValue(argumentsMap, binding.key) : undefined

  if (rawValue === undefined || rawValue === null || rawValue === '') {
    if (binding.default !== undefined) {
      return materializeSkillRuntimeArgsTemplateValue(binding.default, argumentsMap)
    }

    if (binding.required) {
      throw new Error(`Missing required runtime ${binding.$source}: ${binding.key}`)
    }

    return OMITTED_RUNTIME_VALUE
  }

  const materializedRaw = materializeResolvedValue(rawValue)
  if (materializedRaw === OMITTED_RUNTIME_VALUE) return OMITTED_RUNTIME_VALUE

  if (!binding.prefix && !binding.suffix) {
    return materializedRaw
  }

  return `${binding.prefix || ''}${stringifyResolvedValue(materializedRaw)}${binding.suffix || ''}`
}

export function isMaterializedObject(
  value: SkillRuntimeMaterializedValue | typeof OMITTED_RUNTIME_VALUE | undefined,
): value is Record<string, SkillRuntimeMaterializedValue> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isOmittedSkillRuntimeValue(
  value: SkillRuntimeMaterializedValue | typeof OMITTED_RUNTIME_VALUE | undefined,
): value is typeof OMITTED_RUNTIME_VALUE {
  return value === OMITTED_RUNTIME_VALUE
}

export function materializeSkillRuntimeTemplateValue(
  value: AISkillRuntimeTemplateValue,
  context: SkillRuntimeMaterializationContext,
): SkillRuntimeMaterializedValue | typeof OMITTED_RUNTIME_VALUE {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => materializeSkillRuntimeTemplateValue(item, context))
      .filter((item): item is SkillRuntimeMaterializedValue => item !== OMITTED_RUNTIME_VALUE)
  }

  if (isRuntimeBinding(value)) {
    return materializeBindingValue(value, context)
  }

  if (!isRecord(value)) return OMITTED_RUNTIME_VALUE

  const entries = Object.entries(value)
    .map(([key, entryValue]) => {
      const materialized = materializeSkillRuntimeTemplateValue(
        entryValue as AISkillRuntimeTemplateValue,
        context,
      )
      return materialized === OMITTED_RUNTIME_VALUE ? null : [key, materialized]
    })
    .filter((entry): entry is [string, SkillRuntimeMaterializedValue] => !!entry)

  return Object.fromEntries(entries)
}

export function materializeSkillRuntimeArgsTemplateValue(
  value: AISkillRuntimeTemplateValue,
  argumentsMap: Record<string, unknown>,
): SkillRuntimeMaterializedValue | typeof OMITTED_RUNTIME_VALUE {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => materializeSkillRuntimeArgsTemplateValue(item, argumentsMap))
      .filter((item): item is SkillRuntimeMaterializedValue => item !== OMITTED_RUNTIME_VALUE)
  }

  if (isRuntimeBinding(value)) {
    return materializeArgsBindingValue(value, argumentsMap)
  }

  if (!isRecord(value)) return OMITTED_RUNTIME_VALUE

  const entries = Object.entries(value)
    .map(([key, entryValue]) => {
      const materialized = materializeSkillRuntimeArgsTemplateValue(
        entryValue as AISkillRuntimeTemplateValue,
        argumentsMap,
      )
      return materialized === OMITTED_RUNTIME_VALUE ? null : [key, materialized]
    })
    .filter((entry): entry is [string, SkillRuntimeMaterializedValue] => !!entry)

  return Object.fromEntries(entries)
}

export function stringifySkillRuntimeScalar(value: SkillRuntimeMaterializedValue): string {
  return stringifyResolvedValue(value)
}
