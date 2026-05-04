import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AISkillSync } from '@lumina/shared'

/**
 * AI Skill 同步服务
 * 全量替换策略：每次 PUT 先清空后批量写入
 */
@Injectable()
export class AiSkillService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * 获取用户所有技能
   */
  async findAll(userId: number): Promise<AISkillSync[]> {
    const records = await this.prisma.aiSkill.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, skillData: true },
    })

    return records.map((r) => r.skillData as AISkillSync)
  }

  /**
   * 全量替换技能列表（先删后建，事务保证原子性）
   */
  async upsertAll(userId: number, skills: readonly AISkillSync[]): Promise<AISkillSync[]> {
    await this.prisma.$transaction(async (tx) => {
      // 删除旧数据
      await tx.aiSkill.deleteMany({ where: { userId } })

      // 批量写入新数据
      if (skills.length > 0) {
        await tx.aiSkill.createMany({
          data: skills.map((skill) => ({
            id: skill.id,
            userId,
            skillData: skill as unknown as object,
          })),
        })
      }
    })

    return [...skills]
  }
}
