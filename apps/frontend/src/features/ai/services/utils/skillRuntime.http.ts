import { httpClient } from '@/api'
import { unwrapApiResponse } from '@lumina/shared'
import type { ApiResponse } from '@lumina/shared'
import type { AISkillHttpRuntime } from '../types'

const DEFAULT_HTTP_TIMEOUT_MS = 15000

interface ExecuteSkillHttpRuntimeSecret {
  key: string
  required?: boolean
}

interface ExecuteSkillHttpRuntime {
  type: 'http'
  secrets?: ExecuteSkillHttpRuntimeSecret[]
  request: AISkillHttpRuntime['request']
}

export interface ExecuteSkillHttpRuntimeRequest {
  skillName: string
  runtime: ExecuteSkillHttpRuntime
  arguments: Record<string, unknown>
  secrets?: Record<string, string>
}

export async function callSkillHttpRuntime(
  payload: ExecuteSkillHttpRuntimeRequest,
): Promise<unknown> {
  const { data } = await httpClient.post<ApiResponse<unknown>>('/skills/runtime/http', payload, {
    timeout: payload.runtime.request.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS,
  })

  return unwrapApiResponse(data)
}
