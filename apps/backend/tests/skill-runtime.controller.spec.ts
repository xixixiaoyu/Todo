import { describe, expect, it, vi } from 'vitest'
import { SkillRuntimeController } from '@/skill-sources/skill-runtime.controller'
import type { ExecuteHttpSkillRuntimeDto } from '@/skill-sources/skill-runtime.dto'
import type { SkillRuntimeService } from '@/skill-sources/skill-runtime.service'

describe('SkillRuntimeController', () => {
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
