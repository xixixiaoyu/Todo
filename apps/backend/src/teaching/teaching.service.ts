import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { Prisma } from '@prisma/client'

@Injectable()
export class TeachingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ---- Quiz Records ----

  async saveQuizRecord(
    userId: number,
    data: {
      quizId: string
      stem: string
      kind: string
      userAnswer: string | string[]
      result: string
      mastery: string
      feedback: string
      nextFocus?: string
    },
  ) {
    return this.prisma.quizRecord.create({
      data: { ...data, userId, userAnswer: data.userAnswer as Prisma.InputJsonValue },
    })
  }

  async saveQuizRecords(
    userId: number,
    quizzes: Array<{
      quizId: string
      stem: string
      kind: string
      userAnswer: string | string[]
      result: string
      mastery: string
      feedback: string
      nextFocus?: string
    }>,
  ) {
    return this.prisma.quizRecord.createMany({
      data: quizzes.map((q) => ({
        ...q,
        userId,
        userAnswer: q.userAnswer as Prisma.InputJsonValue,
      })),
    })
  }

  async findQuizRecords(userId: number, limit = 50) {
    return this.prisma.quizRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  // ---- Learning Progress ----

  async upsertProgress(
    userId: number,
    data: {
      concept: string
      masteryLevel: string
      quizCount?: number
      correctCount?: number
    },
  ) {
    const existing = await this.prisma.learningProgress.findUnique({
      where: { userId_concept: { userId, concept: data.concept } },
    })

    if (existing) {
      return this.prisma.learningProgress.update({
        where: { userId_concept: { userId, concept: data.concept } },
        data: {
          masteryLevel: data.masteryLevel,
          lastQuizAt: new Date(),
          quizCount: existing.quizCount + (data.quizCount ?? 0),
          correctCount: existing.correctCount + (data.correctCount ?? 0),
        },
      })
    }

    return this.prisma.learningProgress.create({
      data: {
        ...data,
        userId,
        quizCount: data.quizCount ?? 0,
        correctCount: data.correctCount ?? 0,
      },
    })
  }

  async upsertProgressBatch(
    userId: number,
    items: Array<{
      concept: string
      masteryLevel: string
      quizCount?: number
      correctCount?: number
    }>,
  ) {
    return Promise.all(items.map((item) => this.upsertProgress(userId, item)))
  }

  async findProgress(userId: number) {
    return this.prisma.learningProgress.findMany({
      where: { userId },
      orderBy: { lastQuizAt: 'desc' },
    })
  }

  // ---- Overview ----

  async getOverview(userId: number) {
    const [quizRecords, progress] = await Promise.all([
      this.prisma.quizRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      this.prisma.learningProgress.findMany({
        where: { userId },
        orderBy: { lastQuizAt: 'desc' },
      }),
    ])

    const totalQuizzes = quizRecords.length
    const correctCount = quizRecords.filter((q) => q.result === 'correct').length
    const partialCount = quizRecords.filter((q) => q.result === 'partial').length
    const correctRate =
      totalQuizzes > 0 ? Math.round(((correctCount + partialCount * 0.5) / totalQuizzes) * 100) : 0

    return {
      totalQuizzes,
      correctRate,
      concepts: progress,
    }
  }

  // ---- Export ----

  async exportAll(userId: number) {
    const [quizRecords, progress] = await Promise.all([
      this.prisma.quizRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.learningProgress.findMany({
        where: { userId },
        orderBy: { lastQuizAt: 'desc' },
      }),
    ])

    return { quizRecords, progress }
  }
}
