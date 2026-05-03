import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { TeachingService } from '@/teaching/teaching.service'
import { PrismaService } from '@/prisma/prisma.service'

describe('TeachingService', () => {
  let service: TeachingService

  const mockPrisma = {
    quizRecord: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    learningProgress: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeachingService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile()

    service = module.get<TeachingService>(TeachingService)
  })

  describe('Quiz Records', () => {
    it('should save a quiz record', async () => {
      const mockRecord = {
        id: 'qr-1',
        userId: 1,
        quizId: 'quiz-1',
        stem: 'What is 1+1?',
        kind: 'short_answer',
        userAnswer: '2',
        result: 'correct',
        mastery: 'proficient',
        feedback: 'Great job!',
        nextFocus: null,
        createdAt: new Date(),
      }
      mockPrisma.quizRecord.create.mockResolvedValue(mockRecord)

      const result = await service.saveQuizRecord(1, {
        quizId: 'quiz-1',
        stem: 'What is 1+1?',
        kind: 'short_answer',
        userAnswer: '2',
        result: 'correct',
        mastery: 'proficient',
        feedback: 'Great job!',
      })

      expect(result).toBeDefined()
      expect(result.result).toBe('correct')
      expect(mockPrisma.quizRecord.create).toHaveBeenCalled()
    })

    it('should batch save quiz records', async () => {
      mockPrisma.quizRecord.createMany.mockResolvedValue({ count: 2 })

      const result = await service.saveQuizRecords(1, [
        {
          quizId: 'q1',
          stem: 'Q1',
          kind: 'single_choice',
          userAnswer: 'A',
          result: 'correct',
          mastery: 'proficient',
          feedback: 'ok',
        },
        {
          quizId: 'q2',
          stem: 'Q2',
          kind: 'short_answer',
          userAnswer: 'B',
          result: 'incorrect',
          mastery: 'novice',
          feedback: 'try again',
        },
      ])

      expect(result).toEqual({ count: 2 })
      expect(mockPrisma.quizRecord.createMany).toHaveBeenCalled()
    })

    it('should find quiz records', async () => {
      mockPrisma.quizRecord.findMany.mockResolvedValue([])

      const result = await service.findQuizRecords(1)
      expect(result).toEqual([])
      expect(mockPrisma.quizRecord.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    })
  })

  describe('Learning Progress', () => {
    it('should create new progress', async () => {
      mockPrisma.learningProgress.findUnique.mockResolvedValue(null)
      const mockProgress = {
        id: 'lp-1',
        userId: 1,
        concept: 'math.add',
        masteryLevel: 'developing',
        quizCount: 1,
        correctCount: 1,
      }
      mockPrisma.learningProgress.create.mockResolvedValue(mockProgress)

      const result = await service.upsertProgress(1, {
        concept: 'math.add',
        masteryLevel: 'developing',
        quizCount: 1,
        correctCount: 1,
      })

      expect(result.masteryLevel).toBe('developing')
    })

    it('should update existing progress', async () => {
      const existing = {
        id: 'lp-1',
        userId: 1,
        concept: 'math.add',
        masteryLevel: 'novice',
        quizCount: 2,
        correctCount: 1,
      }
      mockPrisma.learningProgress.findUnique.mockResolvedValue(existing)
      const updated = {
        ...existing,
        masteryLevel: 'proficient',
        quizCount: 3,
        correctCount: 2,
      }
      mockPrisma.learningProgress.update.mockResolvedValue(updated)

      const result = await service.upsertProgress(1, {
        concept: 'math.add',
        masteryLevel: 'proficient',
        quizCount: 1,
        correctCount: 1,
      })

      expect(result.masteryLevel).toBe('proficient')
      expect(result.quizCount).toBe(3)
    })

    it('should find progress', async () => {
      mockPrisma.learningProgress.findMany.mockResolvedValue([])

      const result = await service.findProgress(1)
      expect(result).toEqual([])
    })
  })

  describe('Overview', () => {
    it('should return overview with correct rate', async () => {
      mockPrisma.quizRecord.findMany.mockResolvedValue([
        { id: '1', result: 'correct' },
        { id: '2', result: 'incorrect' },
        { id: '3', result: 'partial' },
        { id: '4', result: 'correct' },
      ])
      mockPrisma.learningProgress.findMany.mockResolvedValue([])

      const result = await service.getOverview(1)
      expect(result.totalQuizzes).toBe(4)
      expect(result.correctRate).toBe(63)
    })
  })

  describe('Export', () => {
    it('should export all teaching data', async () => {
      mockPrisma.quizRecord.findMany.mockResolvedValue([])
      mockPrisma.learningProgress.findMany.mockResolvedValue([])

      const result = await service.exportAll(1)
      expect(result.quizRecords).toBeDefined()
      expect(result.progress).toBeDefined()
    })
  })
})
