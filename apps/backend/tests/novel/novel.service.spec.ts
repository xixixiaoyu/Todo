import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import { NovelService } from '@/novel/novel.service'
import { PrismaService } from '@/prisma/prisma.service'

describe('NovelService', () => {
  let service: NovelService

  const mockPrisma = {
    novelDraft: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    novelChapter: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    novelCharacter: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    novelWorldview: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NovelService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile()

    service = module.get<NovelService>(NovelService)
  })

  const mockDraft = {
    id: 'draft-1',
    title: '测试小说',
    genre: 'fantasy',
    status: 'draft',
    userId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe('Drafts', () => {
    it('should create a draft', async () => {
      const draftWithCount = { ...mockDraft, _count: { chapters: 0 } }
      mockPrisma.novelDraft.create.mockResolvedValue(draftWithCount)

      const result = await service.createDraft(1, {
        title: '测试小说',
        genre: 'fantasy',
      })

      expect(result).toBeDefined()
      expect(result.title).toBe('测试小说')
      expect(mockPrisma.novelDraft.create).toHaveBeenCalledWith({
        data: { title: '测试小说', genre: 'fantasy', userId: 1 },
        include: expect.any(Object),
      })
    })

    it('should list drafts for a user', async () => {
      const draftsWithCount = [{ ...mockDraft, _count: { chapters: 2 } }]
      mockPrisma.novelDraft.findMany.mockResolvedValue(draftsWithCount)

      const result = await service.findAllDrafts(1)
      expect(result).toHaveLength(1)
      expect(mockPrisma.novelDraft.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
      })
    })

    it('should find a draft by id', async () => {
      const draftFull = { ...mockDraft, chapters: [], characters: [], worldviews: [] }
      mockPrisma.novelDraft.findFirst.mockResolvedValue(draftFull)

      const result = await service.findDraft(1, 'draft-1')
      expect(result).toBeDefined()
      expect(result.id).toBe('draft-1')
    })

    it('should throw when finding non-existent draft', async () => {
      mockPrisma.novelDraft.findFirst.mockResolvedValue(null)

      await expect(service.findDraft(1, 'nonexistent')).rejects.toThrow()
    })

    it('should delete a draft', async () => {
      mockPrisma.novelDraft.findFirst.mockResolvedValue(mockDraft)
      mockPrisma.novelDraft.delete.mockResolvedValue(mockDraft)

      const result = await service.deleteDraft(1, 'draft-1')
      expect(result).toBeDefined()
      expect(mockPrisma.novelDraft.delete).toHaveBeenCalledWith({
        where: { id: 'draft-1' },
      })
    })

    it('should throw when deleting non-existent draft', async () => {
      mockPrisma.novelDraft.findFirst.mockResolvedValue(null)

      await expect(service.deleteDraft(1, 'nonexistent')).rejects.toThrow()
    })
  })

  describe('Chapters', () => {
    it('should create a chapter', async () => {
      const mockChapter = {
        id: 'ch-1',
        draftId: 'draft-1',
        chapterIndex: 1,
        title: '第一章',
        content: '这是内容',
        wordCount: 4,
      }
      mockPrisma.novelDraft.findFirst.mockResolvedValue(mockDraft)
      mockPrisma.novelChapter.findUnique.mockResolvedValue(null)
      mockPrisma.novelChapter.create.mockResolvedValue(mockChapter)

      const result = await service.createChapter('draft-1', 1, {
        chapterIndex: 1,
        title: '第一章',
        content: '这是内容',
      })

      expect(result).toBeDefined()
      expect(result.title).toBe('第一章')
    })

    it('should upsert a chapter', async () => {
      const mockChapter = {
        id: 'ch-1',
        draftId: 'draft-1',
        chapterIndex: 1,
        title: '第一章',
        content: '这是内容',
        wordCount: 4,
      }
      mockPrisma.novelDraft.findFirst.mockResolvedValue(mockDraft)
      mockPrisma.novelChapter.upsert.mockResolvedValue(mockChapter)

      const result = await service.upsertChapter('draft-1', 1, {
        chapterIndex: 1,
        title: '第一章',
        content: '这是内容',
      })

      expect(result).toBeDefined()
      expect(result.title).toBe('第一章')
      expect(mockPrisma.novelChapter.upsert).toHaveBeenCalledWith({
        where: { draftId_chapterIndex: { draftId: 'draft-1', chapterIndex: 1 } },
        create: expect.objectContaining({ title: '第一章' }),
        update: expect.objectContaining({ title: '第一章' }),
      })
    })

    it('should list chapters', async () => {
      mockPrisma.novelDraft.findFirst.mockResolvedValue(mockDraft)
      mockPrisma.novelChapter.findMany.mockResolvedValue([])

      const result = await service.findChapters(1, 'draft-1')
      expect(result).toEqual([])
    })
  })

  describe('Characters', () => {
    it('should upsert a new character', async () => {
      const mockChar = {
        id: 'char-1',
        draftId: 'draft-1',
        characterId: 'char-a',
        name: '主角',
        role: 'protagonist',
        traits: ['勇敢'],
        version: 1,
        firstChapter: 1,
        lastChapter: 1,
      }
      mockPrisma.novelDraft.findFirst.mockResolvedValue(mockDraft)
      mockPrisma.novelCharacter.findUnique.mockResolvedValue(null)
      mockPrisma.novelCharacter.create.mockResolvedValue(mockChar)

      const result = await service.upsertCharacter('draft-1', 1, {
        characterId: 'char-a',
        name: '主角',
        role: 'protagonist',
        traits: ['勇敢'],
        firstChapter: 1,
      })

      expect(result).toBeDefined()
      expect(result.name).toBe('主角')
    })

    it('should update existing character', async () => {
      const existingChar = {
        id: 'char-1',
        draftId: 'draft-1',
        characterId: 'char-a',
        name: '旧名',
        role: 'protagonist',
        traits: ['勇敢'],
        version: 1,
        firstChapter: 1,
        lastChapter: 2,
      }
      const updatedChar = { ...existingChar, name: '主角', version: 2 }
      mockPrisma.novelDraft.findFirst.mockResolvedValue(mockDraft)
      mockPrisma.novelCharacter.findUnique.mockResolvedValue(existingChar)
      mockPrisma.novelCharacter.update.mockResolvedValue(updatedChar)

      const result = await service.upsertCharacter('draft-1', 1, {
        characterId: 'char-a',
        name: '主角',
        role: 'protagonist',
        traits: ['勇敢'],
        firstChapter: 3,
      })

      expect(result).toBeDefined()
      expect(result.name).toBe('主角')
      expect(result.version).toBe(2)
    })

    it('should list characters', async () => {
      mockPrisma.novelDraft.findFirst.mockResolvedValue(mockDraft)
      mockPrisma.novelCharacter.findMany.mockResolvedValue([])

      const result = await service.findCharacters(1, 'draft-1')
      expect(result).toEqual([])
    })
  })

  describe('Worldviews', () => {
    it('should upsert a new worldview', async () => {
      const mockWorldview = {
        id: 'wv-1',
        draftId: 'draft-1',
        settingId: 'setting-a',
        category: '魔法体系',
        name: '元素魔法',
        description: '使用元素的魔法',
        version: 1,
        firstChapter: 1,
      }
      mockPrisma.novelDraft.findFirst.mockResolvedValue(mockDraft)
      mockPrisma.novelWorldview.findUnique.mockResolvedValue(null)
      mockPrisma.novelWorldview.create.mockResolvedValue(mockWorldview)

      const result = await service.upsertWorldview('draft-1', 1, {
        settingId: 'setting-a',
        category: '魔法体系',
        name: '元素魔法',
        description: '使用元素的魔法',
        firstChapter: 1,
      })

      expect(result).toBeDefined()
      expect(result.name).toBe('元素魔法')
    })

    it('should list worldviews', async () => {
      mockPrisma.novelDraft.findFirst.mockResolvedValue(mockDraft)
      mockPrisma.novelWorldview.findMany.mockResolvedValue([])

      const result = await service.findWorldviews(1, 'draft-1')
      expect(result).toEqual([])
    })
  })

  describe('Bulk export', () => {
    it('should export all drafts for a user', async () => {
      const fullDraft = {
        ...mockDraft,
        chapters: [{ id: 'ch-1', chapterIndex: 1, title: '第一章', content: '内容', wordCount: 2 }],
        characters: [
          {
            id: 'char-1',
            characterId: 'a',
            name: '主角',
            role: 'protagonist',
            traits: [],
            firstChapter: 1,
            lastChapter: 1,
            version: 1,
          },
        ],
        worldviews: [
          {
            id: 'wv-1',
            settingId: 's1',
            category: '地理',
            name: '大陆',
            description: '描述',
            firstChapter: 1,
            version: 1,
          },
        ],
      }
      mockPrisma.novelDraft.findMany.mockResolvedValue([fullDraft])

      const result = await service.exportAll(1)
      expect(result).toHaveLength(1)
      expect(result[0].chapters).toHaveLength(1)
    })
  })
})
