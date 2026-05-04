import { Injectable, Inject, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AIPresetSync } from '@lumina/shared'

/**
 * AI Preset 同步服务
 * 全量替换策略 + apiKey 安全检查
 */
@Injectable()
export class AiPresetService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * 获取用户所有预设骨架
   */
  async findAll(userId: number): Promise<AIPresetSync[]> {
    const records = await this.prisma.aiPreset.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, presetData: true },
    })

    return records.map((r) => r.presetData as AIPresetSync)
  }

  /**
   * 全量替换预设列表（先删后建，事务保证原子性）
   * 拒绝包含 apiKey 的请求
   */
  async upsertAll(userId: number, presets: readonly AIPresetSync[]): Promise<AIPresetSync[]> {
    // 安全检查：拒绝任何包含 apiKey 的数据
    for (const preset of presets) {
      if ('apiKey' in preset) {
        throw new BadRequestException('Preset data must not contain apiKey field')
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.aiPreset.deleteMany({ where: { userId } })

      if (presets.length > 0) {
        await tx.aiPreset.createMany({
          data: presets.map((preset) => ({
            id: preset.id,
            userId,
            presetData: preset as unknown as object,
          })),
        })
      }
    })

    return [...presets]
  }
}
