import { describe, expect, it, vi } from 'vitest'
import { SkillRuntimeController } from '@/skill-sources/skill-runtime.controller'
import { JwtAuthGuard } from '@/auth/jwt-auth.guard'
import type { ExecuteHttpSkillRuntimeDto } from '@/skill-sources/skill-runtime.dto'
import type { SkillRuntimeService } from '@/skill-sources/skill-runtime.service'

const GUARDS_METADATA = '__guards__'

describe('SkillRuntimeController', () => {
  it('protects the runtime endpoint with JWT auth', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, SkillRuntimeController) as unknown[]

    expect(guards).toContain(JwtAuthGuard)
  })

  it('delegates runtime execution to the service', async () => {
    const executeHttpRuntime = vi.fn().mockResolvedValue({ ok: true })
    const controller = new SkillRuntimeController({
      executeHttpRuntime,
    } as unknown as SkillRuntimeService)

    const dto: ExecuteHttpSkillRuntimeDto = {
      skillName: 'finance-lookup',
      runtime: {
        type: 'http',
        request: {
          url: 'https://api.example.com/finance',
          method: 'GET',
        },
      },
      arguments: {},
    }

    await expect(controller.executeHttpRuntime(dto)).resolves.toEqual({ ok: true })
    expect(executeHttpRuntime).toHaveBeenCalledWith(dto)
  })
})
