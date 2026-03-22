import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common'
import type { ExecuteHttpSkillRuntimeDto } from './skill-runtime.dto'
import { fetchWithValidatedRedirects } from './skill-runtime.http'
import {
  isMaterializedObject,
  materializeSkillRuntimeTemplateValue,
  stringifySkillRuntimeScalar,
} from './skill-runtime.materialization'

const DEFAULT_HTTP_TIMEOUT_MS = 15000

@Injectable()
export class SkillRuntimeService {
  async executeHttpRuntime(dto: ExecuteHttpSkillRuntimeDto): Promise<unknown> {
    const context = {
      runtime: dto.runtime,
      argumentsMap: dto.arguments,
      providedSecrets: dto.secrets,
      skillName: dto.skillName,
    }

    const materializedHeaders = dto.runtime.request.headers
      ? materializeSkillRuntimeTemplateValue(dto.runtime.request.headers, context)
      : {}
    const materializedQuery = dto.runtime.request.query
      ? materializeSkillRuntimeTemplateValue(dto.runtime.request.query, context)
      : {}
    const materializedBody =
      dto.runtime.request.body !== undefined
        ? materializeSkillRuntimeTemplateValue(dto.runtime.request.body, context)
        : undefined

    if (!isMaterializedObject(materializedHeaders)) {
      throw new BadRequestException('Skill runtime headers must resolve to an object')
    }
    if (!isMaterializedObject(materializedQuery)) {
      throw new BadRequestException('Skill runtime query must resolve to an object')
    }

    const targetUrl = new URL(dto.runtime.request.url)
    for (const [key, value] of Object.entries(materializedQuery)) {
      targetUrl.searchParams.set(key, stringifySkillRuntimeScalar(value))
    }

    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(materializedHeaders)) {
      headers[key] = stringifySkillRuntimeScalar(value)
    }

    const method = dto.runtime.request.method || 'POST'
    const responseType = dto.runtime.request.responseType || 'json'
    const requestBody =
      method === 'POST' && materializedBody !== undefined
        ? typeof materializedBody === 'string'
          ? materializedBody
          : JSON.stringify(materializedBody)
        : undefined
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      dto.runtime.request.timeoutMs || DEFAULT_HTTP_TIMEOUT_MS,
    )

    try {
      const response = await fetchWithValidatedRedirects({
        url: targetUrl,
        method,
        headers,
        ...(requestBody !== undefined ? { body: requestBody } : {}),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new BadGatewayException(
          `Skill runtime request failed: HTTP ${response.status} ${errorText.slice(0, 300)}`,
        )
      }

      if (responseType === 'text') {
        return response.text()
      }

      return response.json()
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof BadGatewayException) {
        throw error
      }

      const message = error instanceof Error ? error.message : String(error)
      throw new BadGatewayException(`Skill runtime request failed: ${message}`)
    } finally {
      clearTimeout(timeout)
    }
  }
}
