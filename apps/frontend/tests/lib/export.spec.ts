import { describe, it, expect } from 'vitest'
import { sessionToMarkdown } from '@/lib/export'
import type { ChatSession } from '@/features/ai/composables/useChatHistory'
import dayjs from '@/lib/dayjs'

describe('sessionToMarkdown', () => {
  it('should convert a simple chat session to markdown', () => {
    const userTime = new Date('2026-01-13T10:01:00Z')
    const aiTime = new Date('2026-01-13T10:02:00Z')
    const session: ChatSession = {
      id: '1',
      title: 'Test Session',
      createdAt: new Date('2026-01-13T10:00:00Z'),
      updatedAt: new Date('2026-01-13T10:05:00Z'),
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Hello AI',
          createdAt: userTime,
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'Hello User',
          thinkingContent: 'The user said hello.',
          createdAt: aiTime,
        },
      ],
    }

    const markdown = sessionToMarkdown(session)

    expect(markdown).toContain('# Test Session')
    expect(markdown).toContain(`### 用户 (${dayjs(userTime).format('HH:mm:ss')})`)
    expect(markdown).toContain('Hello AI')
    expect(markdown).toContain(`### AI 助手 (${dayjs(aiTime).format('HH:mm:ss')})`)
    expect(markdown).toContain('> **思考过程**:')
    expect(markdown).toContain('The user said hello.')
    expect(markdown).toContain('Hello User')
  })

  it('should handle sessions with images', () => {
    const session: ChatSession = {
      id: '2',
      title: 'Image Session',
      createdAt: new Date('2026-01-13T10:00:00Z'),
      updatedAt: new Date('2026-01-13T10:05:00Z'),
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Look at this',
          images: ['https://example.com/image.png'],
          createdAt: new Date('2026-01-13T10:01:00Z'),
        },
      ],
    }

    const markdown = sessionToMarkdown(session)

    expect(markdown).toContain('**图片附件**:')
    expect(markdown).toContain('![图片 1](https://example.com/image.png)')
  })
})
