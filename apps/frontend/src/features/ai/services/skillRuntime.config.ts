import type { SkillRuntimeConfig } from '@/features/ai/composables/useSkillRuntimeConfig'
import type { AISkill, AISkillHttpRuntime, AISkillRuntimeSecret } from './types'
import { resolveSkillRuntime } from './skillRuntime.normalize'

/**
 * getSkillRuntimeSecretDefinitions 从已有技能中收集需要用户填写的运行时密钥定义。
 * 注意：web_search 原生工具的密钥已迁移至独立 Tab 组件 AIWebSearchConfig，不再在此注入。
 */

function mergeSkillSecretDefinition(
  current: AISkillRuntimeSecret | undefined,
  next: AISkillRuntimeSecret,
): AISkillRuntimeSecret {
  if (!current) return { ...next }

  return {
    ...current,
    ...(next.label ? { label: next.label } : {}),
    ...(next.placeholder ? { placeholder: next.placeholder } : {}),
    ...(next.hint ? { hint: next.hint } : {}),
    ...(next.envVar ? { envVar: next.envVar } : {}),
    ...(typeof next.required === 'boolean' ? { required: next.required } : {}),
  }
}

export function getSkillRuntimeSecretDefinitions(skills: AISkill[]): AISkillRuntimeSecret[] {
  const merged = new Map<string, AISkillRuntimeSecret>()

  for (const skill of skills) {
    const runtime = resolveSkillRuntime(skill)
    if (!runtime || runtime.type !== 'http' || !runtime.secrets?.length) continue

    for (const secret of runtime.secrets) {
      merged.set(secret.key, mergeSkillSecretDefinition(merged.get(secret.key), secret))
    }
  }

  return Array.from(merged.values())
}

export function createExecutableHttpRuntime(runtime: AISkillHttpRuntime): {
  type: 'http'
  secrets?: Array<{ key: string; required?: boolean }>
  request: AISkillHttpRuntime['request']
} {
  const secrets = runtime.secrets?.map((secret) => ({
    key: secret.key,
    ...(typeof secret.required === 'boolean' ? { required: secret.required } : {}),
  }))

  return {
    type: 'http',
    ...(secrets && secrets.length > 0 ? { secrets } : {}),
    request: {
      url: runtime.request.url,
      ...(runtime.request.method ? { method: runtime.request.method } : {}),
      ...(runtime.request.headers ? { headers: runtime.request.headers } : {}),
      ...(runtime.request.query ? { query: runtime.request.query } : {}),
      ...(runtime.request.body !== undefined ? { body: runtime.request.body } : {}),
      ...(typeof runtime.request.timeoutMs === 'number'
        ? { timeoutMs: runtime.request.timeoutMs }
        : {}),
      ...(runtime.request.responseType ? { responseType: runtime.request.responseType } : {}),
    },
  }
}

export function getMissingRequiredSecretLabels(
  runtime: AISkillHttpRuntime,
  runtimeConfig: SkillRuntimeConfig,
): string[] {
  if (!runtime.secrets?.length) return []

  const missingLabels: string[] = []

  for (const secret of runtime.secrets) {
    if (!secret.required) continue

    const value = runtimeConfig.secrets[secret.key]?.trim()
    if (value) continue

    missingLabels.push(secret.label || secret.key)
  }

  return missingLabels
}

export function pickConfiguredSecrets(
  runtime: AISkillHttpRuntime,
  runtimeConfig: SkillRuntimeConfig,
): Record<string, string> | undefined {
  if (!runtime.secrets?.length) return undefined

  const secrets: Record<string, string> = {}

  for (const secret of runtime.secrets) {
    const value = runtimeConfig.secrets[secret.key]?.trim()
    if (value) {
      secrets[secret.key] = value
      continue
    }

    if (secret.required) {
      throw new Error(`Missing required skill runtime secret: ${secret.label || secret.key}`)
    }
  }

  return Object.keys(secrets).length > 0 ? secrets : undefined
}
