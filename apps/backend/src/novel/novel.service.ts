import { Injectable, Inject, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const DRAFT_INCLUDE = {
  _count: { select: { chapters: true } },
} as const

@Injectable()
export class NovelService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // ---- Drafts ----

  async createDraft(
    userId: number,
    data: { title: string; genre?: string; tone?: string; protagonist?: string },
  ) {
    return this.prisma.novelDraft.create({
      data: { ...data, userId },
      include: DRAFT_INCLUDE,
    })
  }

  async findAllDrafts(userId: number) {
    return this.prisma.novelDraft.findMany({
      where: { userId },
      include: DRAFT_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findDraft(userId: number, draftId: string) {
    const draft = await this.prisma.novelDraft.findFirst({
      where: { id: draftId, userId },
      include: DRAFT_INCLUDE,
    })
    if (!draft) throw new NotFoundException('Draft not found')
    return draft
  }

  async updateDraft(userId: number, draftId: string, data: Record<string, unknown>) {
    const draft = await this.prisma.novelDraft.findFirst({ where: { id: draftId, userId } })
    if (!draft) throw new NotFoundException('Draft not found')
    return this.prisma.novelDraft.update({ where: { id: draftId }, data, include: DRAFT_INCLUDE })
  }

  async deleteDraft(userId: number, draftId: string) {
    const draft = await this.prisma.novelDraft.findFirst({ where: { id: draftId, userId } })
    if (!draft) throw new NotFoundException('Draft not found')
    return this.prisma.novelDraft.delete({ where: { id: draftId } })
  }

  // ---- Chapters ----

  async createChapter(
    draftId: string,
    userId: number,
    data: { chapterIndex: number; title: string; content: string; wordCount?: number },
  ) {
    await this.findDraft(userId, draftId)

    const existing = await this.prisma.novelChapter.findUnique({
      where: { draftId_chapterIndex: { draftId, chapterIndex: data.chapterIndex } },
    })
    if (existing) throw new ConflictException('Chapter index already exists in this draft')

    return this.prisma.novelChapter.create({
      data: { ...data, draftId, wordCount: data.wordCount ?? data.content.length },
    })
  }

  async upsertChapter(
    draftId: string,
    userId: number,
    data: { chapterIndex: number; title: string; content: string; wordCount?: number },
  ) {
    await this.findDraft(userId, draftId)

    return this.prisma.novelChapter.upsert({
      where: { draftId_chapterIndex: { draftId, chapterIndex: data.chapterIndex } },
      create: { ...data, draftId, wordCount: data.wordCount ?? data.content.length },
      update: {
        title: data.title,
        content: data.content,
        wordCount: data.wordCount ?? data.content.length,
      },
    })
  }

  async findChapters(userId: number, draftId: string) {
    await this.findDraft(userId, draftId)
    return this.prisma.novelChapter.findMany({
      where: { draftId },
      orderBy: { chapterIndex: 'asc' },
    })
  }

  async findChapter(userId: number, draftId: string, chapterId: string) {
    await this.findDraft(userId, draftId)
    const chapter = await this.prisma.novelChapter.findFirst({
      where: { id: chapterId, draftId },
    })
    if (!chapter) throw new NotFoundException('Chapter not found')
    return chapter
  }

  async updateChapter(
    userId: number,
    draftId: string,
    chapterId: string,
    data: Record<string, unknown>,
  ) {
    await this.findDraft(userId, draftId)
    const chapter = await this.prisma.novelChapter.findFirst({ where: { id: chapterId, draftId } })
    if (!chapter) throw new NotFoundException('Chapter not found')
    return this.prisma.novelChapter.update({ where: { id: chapterId }, data })
  }

  async deleteChapter(userId: number, draftId: string, chapterId: string) {
    await this.findDraft(userId, draftId)
    const chapter = await this.prisma.novelChapter.findFirst({ where: { id: chapterId, draftId } })
    if (!chapter) throw new NotFoundException('Chapter not found')
    return this.prisma.novelChapter.delete({ where: { id: chapterId } })
  }

  // ---- Characters ----

  async upsertCharacter(
    draftId: string,
    userId: number,
    data: {
      characterId: string
      name: string
      role: string
      traits: string[]
      motivation?: string
      backstory?: string
      firstChapter: number
    },
  ) {
    await this.findDraft(userId, draftId)

    const existing = await this.prisma.novelCharacter.findUnique({
      where: { draftId_characterId: { draftId, characterId: data.characterId } },
    })

    if (existing) {
      return this.prisma.novelCharacter.update({
        where: { draftId_characterId: { draftId, characterId: data.characterId } },
        data: {
          name: data.name,
          role: data.role,
          traits: data.traits,
          motivation: data.motivation,
          backstory: data.backstory,
          lastChapter: data.firstChapter,
          version: existing.version + 1,
        },
      })
    }

    return this.prisma.novelCharacter.create({
      data: {
        ...data,
        draftId,
        lastChapter: data.firstChapter,
      },
    })
  }

  async findCharacters(userId: number, draftId: string) {
    await this.findDraft(userId, draftId)
    return this.prisma.novelCharacter.findMany({
      where: { draftId },
      orderBy: { firstChapter: 'asc' },
    })
  }

  async deleteCharacter(userId: number, draftId: string, characterId: string) {
    await this.findDraft(userId, draftId)
    return this.prisma.novelCharacter.deleteMany({
      where: { draftId, characterId },
    })
  }

  // ---- Worldviews ----

  async upsertWorldview(
    draftId: string,
    userId: number,
    data: {
      settingId: string
      category: string
      name: string
      description: string
      firstChapter: number
    },
  ) {
    await this.findDraft(userId, draftId)

    const existing = await this.prisma.novelWorldview.findUnique({
      where: { draftId_settingId: { draftId, settingId: data.settingId } },
    })

    if (existing) {
      return this.prisma.novelWorldview.update({
        where: { draftId_settingId: { draftId, settingId: data.settingId } },
        data: {
          category: data.category,
          name: data.name,
          description: data.description,
          firstChapter: data.firstChapter,
          version: existing.version + 1,
        },
      })
    }

    return this.prisma.novelWorldview.create({
      data: { ...data, draftId },
    })
  }

  async findWorldviews(userId: number, draftId: string) {
    await this.findDraft(userId, draftId)
    return this.prisma.novelWorldview.findMany({
      where: { draftId },
      orderBy: { firstChapter: 'asc' },
    })
  }

  async deleteWorldview(userId: number, draftId: string, settingId: string) {
    await this.findDraft(userId, draftId)
    return this.prisma.novelWorldview.deleteMany({
      where: { draftId, settingId },
    })
  }

  // ---- Bulk export ----

  async exportAll(userId: number) {
    const drafts = await this.prisma.novelDraft.findMany({
      where: { userId },
      include: {
        chapters: { orderBy: { chapterIndex: 'asc' } },
        characters: { orderBy: { firstChapter: 'asc' } },
        worldviews: { orderBy: { firstChapter: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return drafts
  }
}
