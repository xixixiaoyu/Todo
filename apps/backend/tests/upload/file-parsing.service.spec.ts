import { describe, it, expect } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { FileParsingService } from '@/upload/file-parsing.service'
import { MAX_PARSED_CONTENT_CHARS } from '@/upload/upload.constants'
import type { UploadedFile } from '@/upload/storage.service'

function createFile(params: { name: string; content: string; mimetype?: string }): UploadedFile {
  return {
    originalname: params.name,
    mimetype: params.mimetype || 'text/plain',
    size: Buffer.byteLength(params.content),
    buffer: Buffer.from(params.content),
  }
}

describe('FileParsingService', () => {
  const service = new FileParsingService()

  it('rejects unsupported parse file extension', async () => {
    const file = createFile({
      name: 'legacy.doc',
      content: 'unsupported',
      mimetype: 'application/msword',
    })

    await expect(service.parseFile(file)).rejects.toThrow(BadRequestException)
    await expect(service.parseFile(file)).rejects.toThrow('upload.UNSUPPORTED_PARSE_FILE_TYPE')
  })

  it('supports yaml text parsing', async () => {
    const content = 'env:\n  name: test'
    const file = createFile({
      name: 'config.yaml',
      content,
      mimetype: 'application/x-yaml',
    })

    await expect(service.parseFile(file)).resolves.toBe(content)
  })

  it('truncates oversized parsed content', async () => {
    const longText = 'x'.repeat(MAX_PARSED_CONTENT_CHARS + 50)
    const file = createFile({
      name: 'long.txt',
      content: longText,
    })

    const parsed = await service.parseFile(file)
    expect(parsed.length).toBeLessThan(longText.length)
    expect(parsed).toContain('...[truncated]')
  })
})
