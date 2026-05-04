import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AIMemoryData } from '@lumina/shared'

const DEFAULT_MEMORY_DATA: AIMemoryData = {
  memories: [],
  enabled: false,
  threshold: 30,
  updatedAt: undefined,
}

/**
 * AI 记忆同步服务
 * 每个用户仅一条记录，整存整取
 */
@Injectable()
export class AiMemoryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * 获取用户记忆数据，不存在返回默认值
   */
  async get(userId: number): Promise<AIMemoryData> {
    const record = await this.prisma.aiMemory.findUnique({
      where: { userId },
      select: { memories: true, enabled: true, threshold: true, updatedAt: true },
    })

    if (!record) return { ...DEFAULT_MEMORY_DATA }

    return {
      memories: record.memories as string[],
      enabled: record.enabled,
      threshold: record.threshold,
      updatedAt: record.updatedAt.toISOString(),
    }
  }

  /**
   * 全量覆盖写入记忆数据
   */
  async upsert(userId: number, data: AIMemoryData): Promise<AIMemoryData> {
    const record = await this.prisma.aiMemory.upsert({
      where: { userId },
      create: {
        userId,
        memories: data.memories,
        enabled: data.enabled,
        threshold: data.threshold,
      },
      update: {
        memories: data.memories,
        enabled: data.enabled,
        threshold: data.threshold,
      },
      select: { memories: true, enabled: true, threshold: true, updatedAt: true },
    })

    return {
      memories: record.memories as string[],
      enabled: record.enabled,
      threshold: record.threshold,
      updatedAt: record.updatedAt.toISOString(),
    }
  }
}
